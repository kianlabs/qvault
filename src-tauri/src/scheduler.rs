// QVAULT — scheduler.rs (Wave 5, L1). Timer auto-backup sekali per 24 jam.
//
// Desain:
//   * Thread background yang cek tiap jam; bila perlu backup (sudah >= 24 jam
//     dari terakhir atau belum pernah), jalankan backup_now_impl lalu simpan
//     timestamp di setting `last_auto_backup_at` (RFC3339 UTC).
//   * Fungsi pure `should_run(last, now)` → mudah diuji tanpa I/O.
//   * Backup bisa dinonaktifkan via setting `auto_backup_enabled`.

use chrono::{DateTime, Utc};
use tauri::Manager;

use crate::commands::{get_setting, set_setting};
use crate::error::Result;
use crate::state::AppState;

/// Interval minimum antara auto-backup (24 jam dalam detik).
const BACKUP_INTERVAL_SEC: i64 = 24 * 3600;

/// True bila perlu backup: belum pernah (None) atau sudah >= 24 jam.
pub(crate) fn should_run(last: Option<&str>, now: DateTime<Utc>) -> bool {
    let Some(last_str) = last else {
        return true; // belum pernah backup
    };
    let Ok(last_dt) = DateTime::parse_from_rfc3339(last_str) else {
        return true; // gagal parse → anggap perlu backup
    };
    let elapsed = now.signed_duration_since(last_dt).num_seconds();
    elapsed >= BACKUP_INTERVAL_SEC
}

/// Jalankan backup bila enabled dan sudah >= 24 jam. Return Some(result) bila
/// backup dijalankan, None bila disabled atau belum waktunya.
pub(crate) fn run_backup_tick(state: &AppState) -> Option<Result<String>> {
    // Baca setting enabled (default true).
    let enabled = state
        .db
        .with(|conn| {
            get_setting(conn, "auto_backup_enabled")
                .map(|v| v.map(|s| s != "0" && s != "false").unwrap_or(true))
        })
        .unwrap_or(true);

    if !enabled {
        return None;
    }

    // Baca last_auto_backup_at.
    let last = state
        .db
        .with(|conn| get_setting(conn, "last_auto_backup_at"))
        .ok()
        .flatten();

    let now = Utc::now();
    if !should_run(last.as_deref(), now) {
        return None;
    }

    // Jalankan backup.
    let result = crate::commands::data::auto_backup_now_impl(state);

    // Bila berhasil, simpan timestamp.
    if result.is_ok() {
        let _ = state
            .db
            .with(|conn| set_setting(conn, "last_auto_backup_at", &now.to_rfc3339()));
    }

    Some(result)
}

/// Spawn thread background yang cek tiap jam dan jalankan backup bila perlu.
pub fn spawn(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        // Drop state sebelum sleep agar tidak lock mutex lama.
        {
            let state = app.state::<AppState>();
            let _ = run_backup_tick(&state);
        }
        std::thread::sleep(std::time::Duration::from_secs(3600));
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_run_never_backed_up() {
        let now = Utc::now();
        assert!(should_run(None, now));
    }

    #[test]
    fn should_run_25_hours_ago() {
        let now = Utc::now();
        let last = (now - chrono::Duration::hours(25)).to_rfc3339();
        assert!(should_run(Some(&last), now));
    }

    #[test]
    fn should_run_exactly_24_hours() {
        let now = Utc::now();
        let last = (now - chrono::Duration::hours(24)).to_rfc3339();
        assert!(should_run(Some(&last), now));
    }

    #[test]
    fn should_not_run_1_hour_ago() {
        let now = Utc::now();
        let last = (now - chrono::Duration::hours(1)).to_rfc3339();
        assert!(!should_run(Some(&last), now));
    }

    #[test]
    fn should_run_invalid_timestamp() {
        let now = Utc::now();
        assert!(should_run(Some("invalid"), now));
    }

    /// Test disabled → None (tidak jalankan backup).
    #[test]
    fn tick_disabled_returns_none() {
        let state = crate::commands::tests_support::test_state();
        // Set disabled.
        state
            .db
            .with(|conn| set_setting(conn, "auto_backup_enabled", "0"))
            .unwrap();
        let result = run_backup_tick(&state);
        assert!(result.is_none());
    }
}
