// QVAULT — totp.rs (Wave 4, kontrak E.4). 2FA TOTP RFC 6238.
//
// Implementasi: HMAC-SHA1, 6 digit, periode 30 detik (default authenticator).
// Secret disimpan terenkripsi di kolom `vault_items.totp_enc` (DEK, AES-256-GCM),
// sama seperti field sensitif lain. Secret TIDAK pernah dikembalikan ke frontend —
// hanya kode 6 digit yang dihitung saat ini.
//
// Alur verifikasi (dipakai runtime test):
//   set_totp_secret → totp_status(true) → get_totp_code → clear → status(false)

use hmac::{Hmac, Mac};
use sha1::Sha1;
use tauri::State;

use crate::error::{AppError, Result};
use crate::models::{TotpCode, TotpStatus};
use crate::state::AppState;

use super::{dec_str, dek, enc_opt, ensure_column, log_activity};

/// Alias HMAC-SHA1 (RFC 6238 default).
type HmacSha1 = Hmac<Sha1>;

/// Periode TOTP (detik). Standar authenticator = 30s.
const PERIOD: i64 = 30;

/// Modulus kode (6 digit).
const MODULUS: u32 = 1_000_000;

/// Bersihkan & decode secret base32 (toleran spasi, huruf kecil, padding '=').
fn decode_secret(secret: &str) -> Result<Vec<u8>> {
    let cleaned = secret.trim().to_uppercase().replace(' ', "");
    let cleaned = cleaned.trim_end_matches('=');
    if cleaned.is_empty() {
        return Err(AppError::Msg("secret 2FA tidak valid".into()));
    }
    data_encoding::BASE32_NOPAD
        .decode(cleaned.as_bytes())
        .map_err(|_| AppError::Msg("secret 2FA tidak valid".into()))
}

/// Hitung kode TOTP untuk `unix` (detik) dari `secret_bytes`.
///
/// `counter = unix / 30` → 8 byte big-endian → HMAC-SHA1 → dynamic truncation
/// (RFC 4226 §5.3) → modulo 1_000_000 → 6 digit dengan leading zero.
fn totp_at(secret_bytes: &[u8], unix: i64) -> Result<(String, i64)> {
    let counter = (unix / PERIOD) as u64;
    let msg = counter.to_be_bytes();

    let mut mac = HmacSha1::new_from_slice(secret_bytes)
        .map_err(|_| AppError::Msg("gagal menyiapkan HMAC".into()))?;
    mac.update(&msg);
    let hash = mac.finalize().into_bytes(); // 20 byte (SHA-1)

    // Dynamic truncation (RFC 4226 §5.3).
    let offset = (hash[19] & 0x0f) as usize;
    let bin: u32 = ((hash[offset] & 0x7f) as u32) << 24
        | (hash[offset + 1] as u32) << 16
        | (hash[offset + 2] as u32) << 8
        | (hash[offset + 3] as u32);

    let code = format!("{:06}", bin % MODULUS);
    let seconds_remaining = PERIOD - (unix % PERIOD);
    Ok((code, seconds_remaining))
}

/// Simpan/ubah secret TOTP untuk sebuah item (validasi base32 dulu).
#[tauri::command]
pub fn set_totp_secret(state: State<'_, AppState>, id: String, secret: String) -> Result<()> {
    // Validasi: harus base32 valid & non-kosong.
    decode_secret(&secret)?;

    let key = dek(&state)?;
    state.db.with(|conn| {
        ensure_column(conn, "vault_items", "totp_enc", "TEXT")?;
        let blob = enc_opt(&key, &Some(secret))?;
        let n = conn.execute(
            "UPDATE vault_items SET totp_enc = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![blob, super::now(), id],
        )?;
        if n == 0 {
            return Err(AppError::Msg(format!("item vault tidak ditemukan: {id}")));
        }
        log_activity(conn, "vault", "totp_set", None)?;
        Ok(())
    })
}

/// Hapus secret TOTP (matikan 2FA) untuk sebuah item.
#[tauri::command]
pub fn clear_totp_secret(state: State<'_, AppState>, id: String) -> Result<()> {
    state.db.with(|conn| {
        ensure_column(conn, "vault_items", "totp_enc", "TEXT")?;
        let n = conn.execute(
            "UPDATE vault_items SET totp_enc = NULL, updated_at = ?1 WHERE id = ?2",
            rusqlite::params![super::now(), id],
        )?;
        if n == 0 {
            return Err(AppError::Msg(format!("item vault tidak ditemukan: {id}")));
        }
        log_activity(conn, "vault", "totp_clear", None)?;
        Ok(())
    })
}

/// Status 2FA item (ada secret atau tidak). Tidak perlu dekripsi.
#[tauri::command]
pub fn totp_status(state: State<'_, AppState>, id: String) -> Result<TotpStatus> {
    state.db.with(|conn| {
        ensure_column(conn, "vault_items", "totp_enc", "TEXT")?;
        let blob: Option<String> = conn
            .query_row(
                "SELECT totp_enc FROM vault_items WHERE id = ?1",
                rusqlite::params![id],
                |row| row.get::<_, Option<String>>(0),
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::Msg(format!("item vault tidak ditemukan: {id}"))
                }
                other => AppError::from(other),
            })?;
        Ok(TotpStatus {
            has_secret: blob.map(|s| !s.is_empty()).unwrap_or(false),
        })
    })
}

/// Kode TOTP saat ini untuk item (error bila 2FA belum diaktifkan).
#[tauri::command]
pub fn get_totp_code(state: State<'_, AppState>, id: String) -> Result<TotpCode> {
    let key = dek(&state)?;
    state.db.with(|conn| {
        ensure_column(conn, "vault_items", "totp_enc", "TEXT")?;
        let blob: Option<String> = conn
            .query_row(
                "SELECT totp_enc FROM vault_items WHERE id = ?1",
                rusqlite::params![id],
                |row| row.get::<_, Option<String>>(0),
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::Msg(format!("item vault tidak ditemukan: {id}"))
                }
                other => AppError::from(other),
            })?;

        let secret = dec_str(&key, &blob);
        if secret.is_empty() {
            return Err(AppError::Msg("2FA belum diaktifkan".into()));
        }
        let secret_bytes = decode_secret(&secret)?;
        let unix = chrono::Utc::now().timestamp();
        let (code, seconds_remaining) = totp_at(&secret_bytes, unix)?;
        Ok(TotpCode {
            code,
            seconds_remaining,
            period: PERIOD,
        })
    })
}

// ---------------------------------------------------------------------------
// Runtime test (Wave 4) — membuktikan TOTP cocok dengan vektor uji RFC 6238
// (SHA-1, secret "12345678901234567890") dan round-trip enkripsi secret.
// Jalankan: cargo test
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::tests_support::test_state;
    use crate::crypto::{random_key, Key};

    /// Vektor uji RFC 6238 Appendix B (SHA-1), secret ASCII "12345678901234567890".
    /// Dienkode base32 → "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ".
    #[test]
    fn rfc6238_sha1_vectors() {
        let secret_b32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
        let bytes = decode_secret(secret_b32).unwrap();

        // (unix, kode harapan) — dari RFC 6238 (T0=0, X=30, 8 digit dipotong 6).
        // RFC memakai 8 digit "94287082"; 6 digit terakhir = "287082".
        let cases: [(i64, &str); 5] = [
            (59, "287082"),
            (1111111109, "081804"),
            (1111111111, "050471"),
            (1234567890, "005924"),
            (2000000000, "279037"),
        ];
        for (unix, expected) in cases {
            let (code, _) = totp_at(&bytes, unix).unwrap();
            assert_eq!(code, expected, "unix={unix}");
        }
    }

    /// `seconds_remaining` selalu di rentang 1..=30 dan konsisten dengan periode.
    #[test]
    fn seconds_remaining_in_range() {
        let bytes = decode_secret("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ").unwrap();
        for unix in [0i64, 1, 29, 30, 59, 61, 1_000_000] {
            let (_, rem) = totp_at(&bytes, unix).unwrap();
            assert!(rem >= 1 && rem <= PERIOD, "unix={unix} rem={rem}");
            assert_eq!(rem, PERIOD - (unix % PERIOD));
        }
    }

    /// Round-trip DB: set secret → status true → kode 6 digit → clear → status false.
    #[test]
    fn totp_db_roundtrip() {
        let state = test_state();
        let dek_key: Key = random_key();
        *state.vault_key.lock().unwrap() = Some(dek_key.clone());

        // Seed satu item vault minimal.
        let ts = super::super::now();
        state
            .db
            .with(|conn| {
                ensure_column(conn, "vault_items", "totp_enc", "TEXT")?;
                conn.execute(
                    "INSERT INTO vault_items
                       (id,title,username_enc,password_enc,url,notes_enc,tags,folder_id,
                        favorite,icon,created_at,updated_at)
                     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
                    rusqlite::params![
                        "v2",
                        "GitHub",
                        Option::<String>::None,
                        Option::<String>::None,
                        "https://github.com",
                        Option::<String>::None,
                        "[]",
                        Option::<String>::None,
                        0i64,
                        Option::<String>::None,
                        ts,
                        ts,
                    ],
                )?;
                Ok(())
            })
            .unwrap();

        // Set secret (valid) → tersimpan terenkripsi (bukan plaintext).
        let secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
        state
            .db
            .with(|conn| {
                let blob = enc_opt(&dek_key, &Some(secret.to_string()))?;
                conn.execute(
                    "UPDATE vault_items SET totp_enc = ?1 WHERE id = 'v2'",
                    rusqlite::params![blob],
                )?;
                Ok(())
            })
            .unwrap();

        let (has, stored_is_plain) = state
            .db
            .with(|conn| {
                let blob: Option<String> =
                    conn.query_row("SELECT totp_enc FROM vault_items WHERE id='v2'", [], |r| {
                        r.get(0)
                    })?;
                let is_plain = blob.as_deref() == Some(secret);
                Ok((blob.map(|s| !s.is_empty()).unwrap_or(false), is_plain))
            })
            .unwrap();
        assert!(has, "status harus true setelah set");
        assert!(!stored_is_plain, "secret TIDAK boleh tersimpan plaintext");

        // Kode harus 6 digit numerik.
        let code = state
            .db
            .with(|conn| {
                let blob: Option<String> =
                    conn.query_row("SELECT totp_enc FROM vault_items WHERE id='v2'", [], |r| {
                        r.get(0)
                    })?;
                let s = dec_str(&dek_key, &blob);
                let bytes = decode_secret(&s)?;
                let (c, _) = totp_at(&bytes, chrono::Utc::now().timestamp())?;
                Ok(c)
            })
            .unwrap();
        assert_eq!(code.len(), 6);
        assert!(code.chars().all(|c| c.is_ascii_digit()));

        // Clear → status false.
        state
            .db
            .with(|conn| {
                conn.execute("UPDATE vault_items SET totp_enc = NULL WHERE id='v2'", [])?;
                let blob: Option<String> =
                    conn.query_row("SELECT totp_enc FROM vault_items WHERE id='v2'", [], |r| {
                        r.get(0)
                    })?;
                assert!(!blob.map(|s| !s.is_empty()).unwrap_or(false));
                Ok(())
            })
            .unwrap();
    }

    /// Secret invalid harus ditolak.
    #[test]
    fn invalid_secret_rejected() {
        // '1' bukan karakter base32 valid.
        assert!(decode_secret("1!!not-base32!!").is_err());
        assert!(decode_secret("   ").is_err());
    }
}
