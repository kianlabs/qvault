// QVAULT — settings.rs (A3). SPEC §4: get_settings, update_settings.

use tauri::State;

use crate::error::Result;
use crate::models::{Settings, SettingsPayload};
use crate::state::AppState;

use super::{get_setting, log_activity, set_setting};

/// Parse `Option<String>` → `Option<i64>` (toleran terhadap spasi).
fn parse_i64(v: Option<String>) -> Option<i64> {
    v.and_then(|s| s.trim().parse::<i64>().ok())
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<Settings> {
    state.db.with(|conn| {
        let display_name = get_setting(conn, "display_name")?.unwrap_or_default();
        let avatar = get_setting(conn, "avatar")?;
        let theme = get_setting(conn, "theme")?.unwrap_or_else(|| "dark".to_string());
        let accent = get_setting(conn, "accent")?.unwrap_or_else(|| "slate".to_string());
        let font_size = parse_i64(get_setting(conn, "font_size")?).unwrap_or(14);
        let auto_lock_min = parse_i64(get_setting(conn, "auto_lock_min")?).unwrap_or(15);
        let clipboard_clear_sec =
            parse_i64(get_setting(conn, "clipboard_clear_sec")?).unwrap_or(30);
        let show_icons = get_setting(conn, "show_icons")?
            .map(|s| s != "0" && s != "false")
            .unwrap_or(true);

        Ok(Settings {
            display_name,
            avatar,
            theme,
            accent,
            font_size,
            auto_lock_min,
            clipboard_clear_sec,
            show_icons,
        })
    })
}

#[tauri::command]
pub fn update_settings(state: State<'_, AppState>, payload: SettingsPayload) -> Result<()> {
    state.db.with(|conn| {
        // Partial merge: hanya field yang dikirim (Some) yang ditulis.
        if let Some(v) = payload.display_name.as_deref() {
            set_setting(conn, "display_name", v)?;
        }
        if let Some(v) = payload.avatar.as_deref() {
            set_setting(conn, "avatar", v)?;
        }
        if let Some(v) = payload.theme.as_deref() {
            set_setting(conn, "theme", v)?;
        }
        if let Some(v) = payload.accent.as_deref() {
            set_setting(conn, "accent", v)?;
        }
        if let Some(v) = payload.font_size {
            set_setting(conn, "font_size", &v.to_string())?;
        }
        if let Some(v) = payload.auto_lock_min {
            set_setting(conn, "auto_lock_min", &v.to_string())?;
        }
        if let Some(v) = payload.clipboard_clear_sec {
            set_setting(conn, "clipboard_clear_sec", &v.to_string())?;
        }
        if let Some(v) = payload.show_icons {
            set_setting(conn, "show_icons", if v { "1" } else { "0" })?;
        }
        log_activity(conn, "settings", "update", None)?;
        Ok(())
    })
}
