// QVAULT — folders.rs (A3). SPEC §4: list/create/update/delete/toggle.
//
// `color` di TS bertipe `string` (non-null) → emit "" bila NULL (kontrak A.4).
// `parent_id` bertipe `string | null` → tetap None.

use rusqlite::{Connection, OptionalExtension, Row};
use tauri::State;

use crate::error::{AppError, Result};
use crate::models::{Folder, FolderPayload};
use crate::state::AppState;

use super::{log_activity, new_id, now};

const COLS: &str = "id, name, color, kind, parent_id, favorite, created_at, updated_at";

fn map_row(row: &Row<'_>) -> rusqlite::Result<Folder> {
    Ok(Folder {
        id: row.get(0)?,
        name: row.get(1)?,
        color: Some(row.get::<_, Option<String>>(2)?.unwrap_or_default()),
        kind: row.get(3)?,
        parent_id: row.get(4)?,
        favorite: row.get::<_, i64>(5)? != 0,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn fetch_folder(conn: &Connection, id: &str) -> Result<Folder> {
    let sql = format!("SELECT {COLS} FROM folders WHERE id = ?1");
    conn.query_row(&sql, rusqlite::params![id], map_row)
        .optional()?
        .ok_or_else(|| AppError::Msg(format!("folder tidak ditemukan: {id}")))
}

#[tauri::command]
pub fn list_folders(state: State<'_, AppState>, kind: Option<String>) -> Result<Vec<Folder>> {
    state.db.with(|conn| {
        let kind_filter = kind.as_deref().filter(|s| !s.is_empty());
        let sql = format!("SELECT {COLS} FROM folders ORDER BY name COLLATE NOCASE ASC");
        let mut stmt = conn.prepare(&sql)?;
        let mut items = stmt
            .query_map([], map_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        if let Some(k) = kind_filter {
            // Folder cocok bila kind sama atau 'both'.
            items.retain(|f| f.kind == k || f.kind == "both");
        }
        Ok(items)
    })
}

#[tauri::command]
pub fn create_folder(state: State<'_, AppState>, payload: FolderPayload) -> Result<Folder> {
    let id = new_id();
    let ts = now();
    state.db.with(|conn| {
        conn.execute(
            "INSERT INTO folders
                (id, name, color, kind, parent_id, favorite, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                id,
                payload.name,
                payload.color,
                payload.kind,
                payload.parent_id,
                payload.favorite as i64,
                ts,
                ts,
            ],
        )?;
        log_activity(conn, "folders", "create", Some(&payload.name))?;
        fetch_folder(conn, &id)
    })
}

#[tauri::command]
pub fn update_folder(
    state: State<'_, AppState>,
    id: String,
    payload: FolderPayload,
) -> Result<Folder> {
    let ts = now();
    state.db.with(|conn| {
        let n = conn.execute(
            "UPDATE folders SET
                name = ?1, color = ?2, kind = ?3, parent_id = ?4, favorite = ?5, updated_at = ?6
             WHERE id = ?7",
            rusqlite::params![
                payload.name,
                payload.color,
                payload.kind,
                payload.parent_id,
                payload.favorite as i64,
                ts,
                id,
            ],
        )?;
        if n == 0 {
            return Err(AppError::Msg(format!("folder tidak ditemukan: {id}")));
        }
        log_activity(conn, "folders", "update", Some(&payload.name))?;
        fetch_folder(conn, &id)
    })
}

#[tauri::command]
pub fn delete_folder(state: State<'_, AppState>, id: String) -> Result<()> {
    state.db.with(|conn| {
        let name = conn
            .query_row(
                "SELECT name FROM folders WHERE id = ?1",
                rusqlite::params![id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        conn.execute("DELETE FROM folders WHERE id = ?1", rusqlite::params![id])?;
        log_activity(conn, "folders", "delete", name.as_deref())?;
        Ok(())
    })
}

#[tauri::command]
pub fn toggle_folder_favorite(state: State<'_, AppState>, id: String) -> Result<()> {
    state.db.with(|conn| {
        let n = conn.execute(
            "UPDATE folders
                SET favorite = CASE favorite WHEN 1 THEN 0 ELSE 1 END, updated_at = ?1
             WHERE id = ?2",
            rusqlite::params![now(), id],
        )?;
        if n == 0 {
            return Err(AppError::Msg(format!("folder tidak ditemukan: {id}")));
        }
        log_activity(conn, "folders", "favorite", None)?;
        Ok(())
    })
}
