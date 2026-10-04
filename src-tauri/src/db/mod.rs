// QVAULT — database pool + schema init (A2).
//
// Kontrak SPEC §1: `pool/open + init_schema`.
// Catatan: `lib.rs` (parent, frozen) memanggil `AppState::new()` TANPA argumen,
// sehingga `open()` di sini membuka DB pada path default aplikasi (lihat `state.rs`).

use std::path::Path;
use std::sync::{Arc, Mutex};

use rusqlite::Connection;

use crate::error::Result;

/// Pool koneksi SQLite yang aman dibagikan ke thread command Tauri.
///
/// `Connection` bersifat `!Sync`, jadi dibungkus `Mutex`; `Arc` untuk clone ke state.
#[derive(Clone)]
pub struct Db {
    conn: Arc<Mutex<Connection>>,
}

impl Db {
    /// Jalankan closure dengan akses ke `Connection`.
    ///
    /// Menangani poisoning mutex (jika satu command panik) agar command berikutnya
    /// tetap dapat berjalan, bukan ikut panik.
    pub fn with<T>(&self, f: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        let guard = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        f(&guard)
    }
}
/// Buka (atau buat) database pada `path` lalu inisialisasi schema.
pub fn open(path: impl AsRef<Path>) -> Result<Db> {
    let path = path.as_ref();
    let conn = Connection::open(path)?;
    init_schema(&conn)?;
    // Batasi izin file DB ke 0600 (pemilik saja). Metadata vault (title/url/tags)
    // tidak terenkripsi, jadi file tidak boleh world-readable. Best-effort: bila
    // gagal, catat ke stderr tapi jangan gagalkan startup.
    if let Err(e) = restrict_permissions(path) {
        eprintln!("[qvault] gagal membatasi izin file DB: {e}");
    }
    Ok(Db {
        conn: Arc::new(Mutex::new(conn)),
    })
}

/// Batasi izin file ke 0600 (hanya pemilik) di Unix. No-op di platform lain.
/// Dipakai untuk DB, backup, dan file ekspor agar tidak world-readable.
pub fn restrict_permissions(path: impl AsRef<Path>) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path.as_ref(), std::fs::Permissions::from_mode(0o600))?;
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
    Ok(())
}

/// Buka database in-memory (dipakai untuk test).
pub fn open_in_memory() -> Result<Db> {
    let conn = Connection::open_in_memory()?;
    init_schema(&conn)?;
    Ok(Db {
        conn: Arc::new(Mutex::new(conn)),
    })
}

/// Jalankan schema dari `src/db/schema.sql` (embedded saat kompilasi).
pub fn init_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(include_str!("schema.sql"))?;
    Ok(())
}
