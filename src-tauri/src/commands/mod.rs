// QVAULT — command layer (A3). Wiring + helper bersama.
//
// FINAL-CONTRACT §A: setiap command wajib `pub` dengan nama persis yang sudah
// direferensikan `lib.rs::generate_handler!`. Helper di sini dipakai lintas
// submodule (`super::...`) — tidak ada file di luar `commands/` yang disentuh.

pub mod activity;
pub mod data;
pub mod folders;
pub mod income;
pub mod notes;
pub mod security;
pub mod settings;
pub mod tasks;
pub mod totp;
pub mod vault;

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use rusqlite::Connection;

use crate::crypto::{decrypt, encrypt, Key};
use crate::error::{AppError, Result};
use crate::state::AppState;

// ---------------------------------------------------------------------------
// State / waktu / id
// ---------------------------------------------------------------------------

/// Ambil DEK dari state. Error bila vault terkunci (SPEC §2, kontrak A.2).
pub(crate) fn dek(state: &AppState) -> Result<Key> {
    state
        .vault_key
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone()
        .ok_or_else(|| AppError::Msg("vault is locked".into()))
}

/// Timestamp RFC3339 UTC (SPEC §3).
pub(crate) fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// ID uuid v4 (SPEC §3).
pub(crate) fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

// ---------------------------------------------------------------------------
// migrasi kolom (Wave 4, kontrak E.1) — SQLite tidak punya "ADD COLUMN IF NOT
// EXISTS", jadi cek dulu via PRAGMA table_info, baru ALTER bila belum ada.
// Idempoten & murah → aman dipanggil tiap command yang menyentuh tabel.
// ---------------------------------------------------------------------------

/// Pastikan `table.col` ada; tambahkan `ALTER TABLE ... ADD COLUMN` bila belum.
pub(crate) fn ensure_column(
    conn: &Connection,
    table: &str,
    col: &str,
    decl: &str,
) -> Result<()> {
    // PRAGMA tidak menerima bound parameter untuk nama tabel → pakai format!.
    // Nama tabel/kolom di sini konstanta internal (bukan input user).
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let mut exists = false;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?; // kolom ke-1 = nama kolom
        if name.eq_ignore_ascii_case(col) {
            exists = true;
            break;
        }
    }
    drop(rows);
    drop(stmt);

    if !exists {
        conn.execute(
            &format!("ALTER TABLE {table} ADD COLUMN {col} {decl}"),
            [],
        )?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// base64 (dipakai untuk salt kripto, bukan blob cipher yang sudah punya format
// "nonce:ct" sendiri dari crate::crypto)
// ---------------------------------------------------------------------------

pub(crate) fn b64_encode(bytes: &[u8]) -> String {
    B64.encode(bytes)
}

pub(crate) fn b64_decode(s: &str) -> Result<Vec<u8>> {
    B64.decode(s)
        .map_err(|e| AppError::Crypto(format!("base64: {e}")))
}

// ---------------------------------------------------------------------------
// settings table helpers (SPEC §3: settings(key TEXT PRIMARY KEY, value TEXT))
// ---------------------------------------------------------------------------

pub(crate) fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query(rusqlite::params![key])?;
    match rows.next()? {
        Some(row) => Ok(row.get::<_, Option<String>>(0)?),
        None => Ok(None),
    }
}

pub(crate) fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// activity logging (kontrak A.5) — dipanggil setiap command yang mengubah data
// ---------------------------------------------------------------------------

pub(crate) fn log_activity(
    conn: &Connection,
    module: &str,
    action: &str,
    item_name: Option<&str>,
) -> Result<()> {
    conn.execute(
        "INSERT INTO activity_log (id, module, action, item_name, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![new_id(), module, action, item_name, now()],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// tags: kolom TEXT menyimpan JSON array string (kontrak A.4, default "[]")
// ---------------------------------------------------------------------------

pub(crate) fn tags_to_json(tags: &[String]) -> String {
    serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string())
}

pub(crate) fn tags_from_json(raw: &Option<String>) -> Vec<String> {
    raw.as_deref()
        .filter(|s| !s.trim().is_empty())
        .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
        .unwrap_or_default()
}

// ---------------------------------------------------------------------------
// Enkripsi/dekripsi field sensitif (SPEC §2: blob "nonce_b64:ct_b64" dengan DEK)
// ---------------------------------------------------------------------------

/// Enkripsi string sensitif dari payload. String kosong / None → NULL (kolom kosong).
pub(crate) fn enc_opt(key: &Key, value: &Option<String>) -> Result<Option<String>> {
    match value {
        Some(s) if !s.is_empty() => Ok(Some(encrypt(key, s.as_bytes())?)),
        _ => Ok(None),
    }
}

/// Dekripsi kolom sensitif → `String`.
///
/// Kontrak A.4: field sensitif yang di TS bertipe `string` (non-null) HARUS
/// diserialisasi sebagai `""`, tidak pernah `null`. Karena itu NULL, kosong,
/// atau gagal-dekripsi semuanya menjadi `String::new()`.
pub(crate) fn dec_str(key: &Key, value: &Option<String>) -> String {
    match value {
        Some(blob) if !blob.is_empty() => decrypt(key, blob)
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())
            .unwrap_or_default(),
        _ => String::new(),
    }
}

// ---------------------------------------------------------------------------
// Runtime smoke test (ditambahkan parent) — membuktikan crypto + SQL benar-benar
// bekerja end-to-end, bukan sekadar "compile". Jalankan: cargo test
// ---------------------------------------------------------------------------
#[cfg(test)]
pub(crate) mod tests_support {
    use crate::state::AppState;

    /// AppState dengan DB in-memory + vault terkunci (DEK belum di-set).
    pub(crate) fn test_state() -> AppState {
        AppState {
            db: crate::db::open_in_memory().expect("in-memory db"),
            vault_key: std::sync::Mutex::new(None),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::{decrypt, derive_key, encrypt, new_salt, random_key, Key};

    const VERIFIER: &[u8] = b"QVAULT_VERIFY";

    fn to_key(bytes: &[u8]) -> Key {
        let mut a = [0u8; 32];
        a.copy_from_slice(bytes);
        Key(a)
    }

    fn test_state() -> AppState {
        AppState {
            db: crate::db::open_in_memory().expect("in-memory db"),
            vault_key: std::sync::Mutex::new(None),
        }
    }

    #[test]
    fn full_vault_flow_init_unlock_create_reveal() {
        let password = "correct horse battery";

        // --- INIT: derive master key, generate DEK, wrap it ---
        let salt = new_salt();
        assert_eq!(salt.len(), 16);
        let master = to_key(&derive_key(password, &salt).unwrap());
        let dek = random_key();
        let wrapped = encrypt(&master, &dek.0).unwrap();
        let verifier = encrypt(&master, VERIFIER).unwrap();
        assert!(wrapped.contains(':')); // "nonce_b64:ct_b64"

        // --- UNLOCK with the correct password ---
        let master2 = to_key(&derive_key(password, &salt).unwrap());
        let dek_bytes = decrypt(&master2, &wrapped).unwrap();
        assert_eq!(dek_bytes.len(), 32);
        assert_eq!(dek_bytes, dek.0.to_vec());
        assert_eq!(decrypt(&master2, &verifier).unwrap(), VERIFIER);
        let key = to_key(&dek_bytes);

        // --- UNLOCK with a WRONG password must fail (AEAD auth) ---
        let wrong = to_key(&derive_key("wrong-password", &salt).unwrap());
        assert!(decrypt(&wrong, &wrapped).is_err());

        // --- CREATE an item (encrypt sensitive fields) ---
        let state = test_state();
        let id = new_id();
        let ts = now();
        let pw_blob = enc_opt(&key, &Some("s3cr3t-pw".to_string())).unwrap();
        let user_blob = enc_opt(&key, &Some("kyan".to_string())).unwrap();
        assert!(pw_blob.is_some());
        state
            .db
            .with(|conn| {
                conn.execute(
                    "INSERT INTO vault_items
                       (id, title, username_enc, password_enc, url, notes_enc, tags,
                        folder_id, favorite, icon, created_at, updated_at)
                     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
                    rusqlite::params![
                        id,
                        "GitHub",
                        user_blob,
                        pw_blob,
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

        // --- READ BACK + decrypt ---
        let revealed = state
            .db
            .with(|conn| {
                let stored: Option<String> = conn.query_row(
                    "SELECT password_enc FROM vault_items WHERE id = ?1",
                    rusqlite::params![id],
                    |r| r.get(0),
                )?;
                Ok(dec_str(&key, &stored))
            })
            .unwrap();
        assert_eq!(revealed, "s3cr3t-pw");

        // --- ACTIVITY log written ---
        state
            .db
            .with(|conn| log_activity(conn, "vault", "create", Some("GitHub")))
            .unwrap();
        let acts = state
            .db
            .with(|conn| crate::commands::activity::fetch_activity(conn, 10))
            .unwrap();
        assert_eq!(acts.len(), 1);
        assert_eq!(acts[0].module, "vault");
        assert_eq!(acts[0].action, "create");

        // --- SETTINGS round-trip (init/unlock persistence) ---
        state
            .db
            .with(|conn| {
                set_setting(conn, "pwd_salt", &b64_encode(&salt))?;
                set_setting(conn, "dek_wrapped", &wrapped)?;
                set_setting(conn, "pwd_verifier", &verifier)?;
                Ok(())
            })
            .unwrap();
        let back = state
            .db
            .with(|conn| get_setting(conn, "dek_wrapped"))
            .unwrap();
        assert!(back.is_some());
    }
}
