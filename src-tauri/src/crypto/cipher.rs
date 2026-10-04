// QVAULT — AES-256-GCM cipher (A1)
//
// Format blob: "{nonce_b64}:{ciphertext_b64}" (SPEC §2).
// Nonce = 96-bit (12 byte) acak per operasi; ciphertext termasuk tag GCM 16 byte.

use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use rand::RngCore;
use zeroize::Zeroize;

use crate::error::{AppError, Result};

/// Panjang nonce AES-GCM (byte).
const NONCE_LEN: usize = 12;

/// Kunci 32 byte. Di-zeroize saat drop (SPEC §2: "zeroize on drop").
#[derive(Clone)]
pub struct Key(pub [u8; 32]);

impl Drop for Key {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

/// Kunci acak 32 byte (CSPRNG) — dipakai untuk DEK saat init vault.
pub fn random_key() -> Key {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    Key(bytes)
}

/// Enkripsi `plaintext` dengan `key`. Hasil: "nonce_b64:ct_b64".
pub fn encrypt(key: &Key, plaintext: &[u8]) -> Result<String> {
    let cipher = Aes256Gcm::new_from_slice(&key.0)
        .map_err(|e| AppError::Crypto(format!("cipher init: {e}")))?;

    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| AppError::Crypto(format!("encrypt: {e}")))?;

    Ok(format!(
        "{}:{}",
        B64.encode(nonce_bytes),
        B64.encode(ciphertext)
    ))
}

/// Dekripsi blob "nonce_b64:ct_b64" dengan `key`.
pub fn decrypt(key: &Key, blob: &str) -> Result<Vec<u8>> {
    let (nonce_b64, ct_b64) = blob
        .split_once(':')
        .ok_or_else(|| AppError::Crypto("blob format tidak valid (butuh 'nonce:ct')".into()))?;

    let nonce_bytes = B64
        .decode(nonce_b64)
        .map_err(|e| AppError::Crypto(format!("nonce b64: {e}")))?;
    if nonce_bytes.len() != NONCE_LEN {
        return Err(AppError::Crypto("panjang nonce tidak valid".into()));
    }

    let ciphertext = B64
        .decode(ct_b64)
        .map_err(|e| AppError::Crypto(format!("ct b64: {e}")))?;

    let cipher = Aes256Gcm::new_from_slice(&key.0)
        .map_err(|e| AppError::Crypto(format!("cipher init: {e}")))?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| AppError::Crypto("dekripsi gagal (kunci salah atau data rusak)".into()))
}
