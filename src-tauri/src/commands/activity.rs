// QVAULT — activity.rs (A3). SPEC §4: list_activity, clear_activity.

use rusqlite::{Connection, Row};
use tauri::State;

use crate::error::Result;
use crate::models::ActivityEntry;
use crate::state::AppState;

const COLS: &str = "id, module, action, item_name, created_at";

/// `item_name` di TS bertipe `string` (non-null) → emit `""` bila NULL (kontrak A.4).
fn map_row(row: &Row<'_>) -> rusqlite::Result<ActivityEntry> {
    Ok(ActivityEntry {
        id: row.get(0)?,
        module: row.get(1)?,
        action: row.get(2)?,
        item_name: Some(row.get::<_, Option<String>>(3)?.unwrap_or_default()),
        created_at: row.get(4)?,
    })
}

/// Ambil `limit` entri terbaru. Dipakai `list_activity` dan `dashboard_stats`.
pub(crate) fn fetch_activity(conn: &Connection, limit: i64) -> Result<Vec<ActivityEntry>> {
    let sql = format!("SELECT {COLS} FROM activity_log ORDER BY created_at DESC, rowid DESC LIMIT ?1");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(rusqlite::params![limit], map_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

#[tauri::command]
pub fn list_activity(state: State<'_, AppState>, limit: Option<i64>) -> Result<Vec<ActivityEntry>> {
    let lim = limit.unwrap_or(100).clamp(1, 1000);
    state.db.with(|conn| fetch_activity(conn, lim))
}

#[tauri::command]
pub fn clear_activity(state: State<'_, AppState>) -> Result<()> {
    state.db.with(|conn| {
        conn.execute("DELETE FROM activity_log", [])?;
        Ok(())
    })
}
