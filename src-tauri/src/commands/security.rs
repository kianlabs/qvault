// QVAULT — security.rs (A3). SPEC §4 + FINAL-CONTRACT §A.3 (flow kripto).
//
// Alur kunci:
//   master password --Argon2id--> master_key
//   master_key --AES-GCM--> DEK (disimpan sebagai pwd_salt + dek_wrapped)
//   DEK disimpan di memori (AppState.vault_key) selama unlock; lock → None.
//
// Settings yang dipakai (SPEC §3):
//   pwd_salt        base64 dari salt 16 byte
//   pwd_verifier    encrypt(master_key, b"QVAULT_VERIFY")
//   dek_wrapped     encrypt(master_key, dek.0)
//   recovery_hash   encrypt(key(recovery_code, salt), b"QVAULT_RECOVERY")

use tauri::State;

use crate::crypto::{decrypt, derive_key, encrypt, new_salt, random_key, Key};
use crate::error::{AppError, Result};
use crate::models::VaultStatus;
use crate::state::AppState;

use super::{b64_decode, b64_encode, get_setting, log_activity, set_setting};

const VERIFIER_PLAINTEXT: &[u8] = b"QVAULT_VERIFY";
const RECOVERY_PLAINTEXT: &[u8] = b"QVAULT_RECOVERY";
const RECOVERY_SALT_KEY: &str = "recovery_salt";

// --- helper kripto ---------------------------------------------------------

/// derive_key → `Key` (Key(pub [u8;32]) tersedia dari crate::crypto).
fn derive_key_bytes(password: &str, salt: &[u8]) -> Result<Key> {
    Ok(Key(derive_key(password, salt)?))
}

/// Bungkus (wrap) DEK dengan master key: encrypt(master_key, dek.0) → blob.
fn wrap_dek(master_key: &Key, dek: &Key) -> Result<String> {
    encrypt(master_key, &dek.0)
}

/// Buka (unwrap) DEK dengan master key. Blob rusak / password salah → error.
fn unwrap_dek(master_key: &Key, wrapped: &str) -> Result<Key> {
    let bytes = decrypt(master_key, wrapped).map_err(|_| AppError::Msg("password salah".into()))?;
    if bytes.len() != 32 {
        return Err(AppError::Msg("DEK tidak valid".into()));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(Key(arr))
}

/// Password benar ⟺ dek_wrapped bisa dibuka (AEAD gagal saat kunci salah).
/// pwd_verifier adalah lapis verifikasi eksplisit tambahan (SPEC §2).
fn unlock_dek(password: &str, salt_b64: &str, wrapped: &str, verifier: &str) -> Result<Key> {
    let salt = b64_decode(salt_b64)?;
    let master_key = derive_key_bytes(password, &salt)?;
    let dek = unwrap_dek(&master_key, wrapped)?;
    let ok = decrypt(&master_key, verifier)
        .map(|b| b == VERIFIER_PLAINTEXT)
        .unwrap_or(false);
    if !ok {
        return Err(AppError::Msg("password salah".into()));
    }
    Ok(dek)
}

/// Panjang minimal password master.
const MIN_PW_LEN: usize = 8;

fn validate_password(pw: &str) -> Result<()> {
    if pw.len() < MIN_PW_LEN {
        return Err(AppError::Msg(format!(
            "password master minimal {MIN_PW_LEN} karakter"
        )));
    }
    Ok(())
}

// --- commands --------------------------------------------------------------

#[tauri::command]
pub fn vault_status(state: State<'_, AppState>) -> Result<VaultStatus> {
    state.db.with(|conn| {
        let initialized = get_setting(conn, "dek_wrapped")?.is_some();
        let locked = state
            .vault_key
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .is_none();
        Ok(VaultStatus {
            initialized,
            locked,
            degraded: state.degraded.clone(),
        })
    })
}

#[tauri::command]
pub fn init_vault(state: State<'_, AppState>, master_password: String) -> Result<()> {
    validate_password(&master_password)?;
    // Cek inisialisasi + tulis settings + aktivitas dalam satu guard koneksi.
    let dek = state.db.with(|conn| {
        if get_setting(conn, "dek_wrapped")?.is_some() {
            return Err(AppError::Msg("vault sudah diinisialisasi".into()));
        }

        let salt = new_salt();
        let master_key = derive_key_bytes(&master_password, &salt)?;
        let dek = random_key();

        set_setting(conn, "pwd_salt", &b64_encode(&salt))?;
        set_setting(
            conn,
            "pwd_verifier",
            &encrypt(&master_key, VERIFIER_PLAINTEXT)?,
        )?;
        set_setting(conn, "dek_wrapped", &wrap_dek(&master_key, &dek)?)?;
        log_activity(conn, "security", "init", None)?;
        Ok(dek)
    })?;

    *state
        .vault_key
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(dek);
    Ok(())
}

#[tauri::command]
pub fn unlock_vault(state: State<'_, AppState>, master_password: String) -> Result<()> {
    let dek = state.db.with(|conn| {
        let salt = get_setting(conn, "pwd_salt")?
            .ok_or_else(|| AppError::Msg("vault belum diinisialisasi".into()))?;
        let wrapped = get_setting(conn, "dek_wrapped")?
            .ok_or_else(|| AppError::Msg("vault belum diinisialisasi".into()))?;
        let verifier = get_setting(conn, "pwd_verifier")?
            .ok_or_else(|| AppError::Msg("vault belum diinisialisasi".into()))?;

        let dek = unlock_dek(&master_password, &salt, &wrapped, &verifier)?;
        log_activity(conn, "security", "unlock", None)?;
        Ok(dek)
    })?;

    *state
        .vault_key
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(dek);
    Ok(())
}

#[tauri::command]
pub fn lock_vault(state: State<'_, AppState>) -> Result<()> {
    *state
        .vault_key
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
    state
        .db
        .with(|conn| log_activity(conn, "security", "lock", None))
}

#[tauri::command]
pub fn change_master_password(
    state: State<'_, AppState>,
    current_password: String,
    new_password: String,
) -> Result<()> {
    validate_password(&new_password)?;
    state.db.with(|conn| {
        let salt = get_setting(conn, "pwd_salt")?
            .ok_or_else(|| AppError::Msg("vault belum diinisialisasi".into()))?;
        let wrapped = get_setting(conn, "dek_wrapped")?
            .ok_or_else(|| AppError::Msg("vault belum diinisialisasi".into()))?;
        let verifier = get_setting(conn, "pwd_verifier")?
            .ok_or_else(|| AppError::Msg("vault belum diinisialisasi".into()))?;

        // Verifikasi password lama, lalu ambil DEK-nya.
        let dek = unlock_dek(&current_password, &salt, &wrapped, &verifier)?;

        // Rotasi salt + verifier + wrap DEK dengan kunci baru.
        let new_salt = new_salt();
        let new_key = derive_key_bytes(&new_password, &new_salt)?;
        set_setting(conn, "pwd_salt", &b64_encode(&new_salt))?;
        set_setting(
            conn,
            "pwd_verifier",
            &encrypt(&new_key, VERIFIER_PLAINTEXT)?,
        )?;
        set_setting(conn, "dek_wrapped", &wrap_dek(&new_key, &dek)?)?;
        log_activity(conn, "security", "change_master_password", None)?;
        Ok(())
    })
}

#[tauri::command]
pub fn generate_recovery_code(state: State<'_, AppState>) -> Result<String> {
    // 4 grup × 4 karakter base32-ish (tanpa karakter ambigu).
    const ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut bytes = [0u8; 16];
    rand::RngCore::fill_bytes(&mut rand::rngs::OsRng, &mut bytes);
    let mut code = String::new();
    for (i, b) in bytes.iter().enumerate() {
        if i > 0 && i % 4 == 0 {
            code.push('-');
        }
        code.push(ALPHABET[*b as usize % ALPHABET.len()] as char);
    }

    state.db.with(|conn| {
        let salt = new_salt();
        let key = derive_key_bytes(&code, &salt)?;
        set_setting(conn, RECOVERY_SALT_KEY, &b64_encode(&salt))?;
        set_setting(conn, "recovery_hash", &encrypt(&key, RECOVERY_PLAINTEXT)?)?;
        log_activity(conn, "security", "generate_recovery_code", None)?;
        Ok(code.clone())
    })
}

#[tauri::command]
pub fn reset_vault(state: State<'_, AppState>, recovery_code: String) -> Result<()> {
    state.db.with(|conn| {
        let salt = get_setting(conn, RECOVERY_SALT_KEY)?
            .ok_or_else(|| AppError::Msg("kode pemulihan belum dibuat".into()))?;
        let hash = get_setting(conn, "recovery_hash")?
            .ok_or_else(|| AppError::Msg("kode pemulihan belum dibuat".into()))?;

        let salt_bytes = b64_decode(&salt)?;
        let key = derive_key_bytes(&recovery_code, &salt_bytes)?;
        let ok = decrypt(&key, &hash)
            .map(|b| b == RECOVERY_PLAINTEXT)
            .unwrap_or(false);
        if !ok {
            return Err(AppError::Msg("kode pemulihan salah".into()));
        }

        // Wipe seluruh tabel data + settings, lalu catat aktivitas reset.
        conn.execute_batch(
            "DELETE FROM vault_items;
             DELETE FROM notes;
             DELETE FROM tasks;
             DELETE FROM income;
             DELETE FROM folders;
             DELETE FROM activity_log;
             DELETE FROM settings;",
        )?;
        log_activity(conn, "security", "reset", None)?;
        Ok(())
    })?;

    // Kunci di memori dibuang; frontend diminta init ulang.
    *state
        .vault_key
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
    Ok(())
}
