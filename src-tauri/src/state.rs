// QVAULT — AppState (A2). SPEC §1: AppState { db, vault_key: Mutex<Option<Key32>> }.
//
// PENTING: `lib.rs` (parent, frozen) memanggil `AppState::new()` tanpa argumen,
// sehingga `new()` harus infallible. Jika DB gagal dibuka (mis. I/O), kita fallback
// ke database in-memory agar aplikasi tetap start, dan mencatat kegagalan ke stderr.

use std::sync::Mutex;

use crate::crypto::cipher::Key;
use crate::db::Db;

/// Guard untuk rate-limiting unlock attempts (M1, WAVE5).
#[derive(Default)]
pub struct UnlockGuard {
    pub fails: u32,
    pub locked_until: Option<std::time::Instant>,
}

/// State aplikasi global (di-`manage` oleh Tauri).
pub struct AppState {
    /// Koneksi database.
    pub db: Db,
    /// DEK (data encryption key) di memori; `None` = vault terkunci.
    pub vault_key: Mutex<Option<Key>>,
    /// `Some(pesan)` bila DB default gagal dibuka dan app berjalan dengan
    /// database in-memory sementara (data TIDAK persisten). Diteruskan ke UI
    /// lewat `vault_status` agar pengguna tidak salah sangka "data hilang".
    pub degraded: Option<String>,
    /// Rate-limit untuk unlock attempts (M1).
    pub unlock_fails: Mutex<UnlockGuard>,
}

impl AppState {
    /// Bangun state: buka DB default lalu init schema.
    pub fn new() -> Self {
        let (db, degraded) = match default_db() {
            Ok(db) => (db, None),
            Err(e) => {
                eprintln!(
                    "[qvault] gagal membuka database default: {e}; memakai database in-memory (SEMENTARA, data tidak persisten)"
                );
                let msg = format!(
                    "Database lokal gagal dibuka ({e}). Aplikasi berjalan dengan penyimpanan SEMENTARA — perubahan tidak akan tersimpan."
                );
                (
                    crate::db::open_in_memory().expect("gagal membuka database in-memory"),
                    Some(msg),
                )
            }
        };

        Self {
            db,
            vault_key: Mutex::new(None),
            degraded,
            unlock_fails: Mutex::new(UnlockGuard::default()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// Path database default: `<data_dir>/qvault/qvault.db`.
///
/// Prioritas: `QVAULT_DB_PATH` → `$XDG_DATA_HOME`/`$HOME` → direktori kerja.
fn default_db() -> crate::error::Result<Db> {
    if let Ok(path) = std::env::var("QVAULT_DB_PATH") {
        if !path.trim().is_empty() {
            return crate::db::open(path);
        }
    }

    let base = std::env::var("XDG_DATA_HOME")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .or_else(|| {
            std::env::var("HOME")
                .ok()
                .filter(|s| !s.trim().is_empty())
                .map(|home| format!("{home}/.local/share"))
        })
        .unwrap_or_else(|| ".".to_string());

    let dir = std::path::Path::new(&base).join("qvault");
    std::fs::create_dir_all(&dir)?;

    crate::db::open(dir.join("qvault.db"))
}
