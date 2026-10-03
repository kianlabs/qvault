// QVAULT — kriptografi (A1)
//
// Kontrak (SPEC §2):
//   master password --Argon2id(m=19456,t=2,p=1, salt 16B)--> key 32B
//   DEK acak 32B dienkripsi dengan master key via AES-256-GCM.
//   Semua field sensitif disimpan sebagai "nonce_b64:ct_b64".

pub mod cipher;
pub mod kdf;

// Re-export API publik crypto (§2). `allow(unused_imports)` karena modul ini masih
// privat sampai `commands/*` (A3) mengonsumsinya; nama tetap dibekukan oleh SPEC.
#[allow(unused_imports)]
pub use cipher::{decrypt, encrypt, random_key, Key};
#[allow(unused_imports)]
pub use kdf::{derive_key, new_salt};

/// Panjang salt (byte) untuk Argon2id.
pub const SALT_LEN: usize = 16;

/// Panjang kunci (byte) — 32 byte = AES-256.
pub const KEY_LEN: usize = 32;
