// QVAULT — AppError + Result alias (A1)
//
// CATATAN DEVIASI (dari SPEC §2 baris `#[error(transparent)] Crypto(String)`):
//   Atribut `#[error(transparent)]` pada varian berisi `String` TIDAK bisa dikompilasi
//   (E0599: `String` tidak mengimplementasikan `std::error::Error`).
//   Interface yang dibekukan tetap dipertahankan persis — nama varian (Msg/Io/Db/Crypto),
//   tipe payload (String), impl `Serialize` (sebagai string), dan alias `Result<T>`.
//   Hanya atribut yang mustahil itu yang diubah menjadi `#[error("{0}")]` (menampilkan isi pesan).

use serde::ser::{Serialize, Serializer};

/// Error terpusat aplikasi QVAULT.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    /// Pesan error umum.
    #[error("{0}")]
    Msg(String),

    /// I/O error (transparent → delegasi Display/Error ke sumber).
    #[error(transparent)]
    Io(#[from] std::io::Error),

    /// Database error (transparent → delegasi Display/Error ke rusqlite).
    #[error(transparent)]
    Db(#[from] rusqlite::Error),

    /// Error kriptografi (pesan mentah).
    #[error("{0}")]
    Crypto(String),
}

/// Alias Result untuk seluruh aplikasi.
pub type Result<T> = std::result::Result<T, AppError>;

/// AppError diserialisasi ke frontend sebagai string pesan.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
