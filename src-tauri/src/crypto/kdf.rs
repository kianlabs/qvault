// QVAULT — Argon2id KDF (A1)
//
// Parameter WAJIB (SPEC §2): m = 19456 KiB, t = 2, p = 1.
// derive_key() selalu memakai parameter ini; salt diberikan pemanggil.

use argon2::{Algorithm, Argon2, Params, Version};
use rand::RngCore;

use crate::error::{AppError, Result};

/// Parameter Argon2id yang dibekukan oleh SPEC.
const M_COST_KIB: u32 = 19_456; // 19456 KiB = 19 MiB
const T_COST: u32 = 2;
const P_COST: u32 = 1;

/// Salt acak 16 byte (CSPRNG).
pub fn new_salt() -> [u8; 16] {
    let mut salt = [0u8; 16];
    rand::rngs::OsRng.fill_bytes(&mut salt);
    salt
}

/// Turunkan kunci 32 byte dari `password` + `salt` memakai Argon2id.
pub fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32]> {
    let params = Params::new(M_COST_KIB, T_COST, P_COST, Some(32))
        .map_err(|e| AppError::Crypto(format!("argon2 params: {e}")))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key = [0u8; 32];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| AppError::Crypto(format!("argon2 derive: {e}")))?;

    Ok(key)
}
