// QVAULT — notes.rs (A3). SPEC §4: list/create/update/delete/duplicate/toggle.
//
// `content_enc` didekripsi ke `String` (kontrak A.4).

use rusqlite::{Connection, OptionalExtension, Row};
use tauri::State;

use crate::crypto::Key;
use crate::error::{AppError, Result};
use crate::models::{Note, NotePayload};
use crate::state::AppState;

use super::{
    dec_str, dek, enc_opt, log_activity, new_id, now, tags_from_json, tags_to_json,
};

const COLS: &str = "id, title, content_enc, tags, folder_id, favorite, created_at, updated_at";

fn map_row(row: &Row<'_>, key: &Key) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get(0)?,
        title: row.get(1)?,
        content: Some(dec_str(key, &row.get(2)?)),
        tags: tags_from_json(&row.get(3)?),
        folder_id: row.get(4)?,
        favorite: row.get::<_, i64>(5)? != 0,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn fetch_note(conn: &Connection, key: &Key, id: &str) -> Result<Note> {
    let sql = format!("SELECT {COLS} FROM notes WHERE id = ?1");
    conn.query_row(&sql, rusqlite::params![id], |row| map_row(row, key))
        .optional()?
        .ok_or_else(|| AppError::Msg(format!("catatan tidak ditemukan: {id}")))
}

#[tauri::command]
pub fn list_notes(
    state: State<'_, AppState>,
    search: Option<String>,
    folder_id: Option<String>,
    favorite_only: Option<bool>,
) -> Result<Vec<Note>> {
    let key = dek(&state)?;
    state.db.with(|conn| {
        let search_term = search
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_lowercase);
        let folder_filter = folder_id.as_deref().filter(|s| !s.is_empty());
        let fav = favorite_only.unwrap_or(false);

        let sql = format!("SELECT {COLS} FROM notes ORDER BY updated_at DESC");
        let mut stmt = conn.prepare(&sql)?;
        let mut items = stmt
            .query_map([], |row| map_row(row, &key))?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        if let Some(term) = &search_term {
            items.retain(|n| {
                n.title.to_lowercase().contains(term)
                    || n.content.as_deref().unwrap_or("").to_lowercase().contains(term)
            });
        }
        if let Some(fid) = folder_filter {
            items.retain(|n| n.folder_id.as_deref() == Some(fid));
        }
        if fav {
            items.retain(|n| n.favorite);
        }
        Ok(items)
    })
}

#[tauri::command]
pub fn create_note(state: State<'_, AppState>, payload: NotePayload) -> Result<Note> {
    let key = dek(&state)?;
    let id = new_id();
    let ts = now();
    state.db.with(|conn| {
        conn.execute(
            "INSERT INTO notes
                (id, title, content_enc, tags, folder_id, favorite, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                id,
                payload.title,
                enc_opt(&key, &payload.content)?,
                tags_to_json(&payload.tags),
                payload.folder_id,
                payload.favorite as i64,
                ts,
                ts,
            ],
        )?;
        log_activity(conn, "notes", "create", Some(&payload.title))?;
        fetch_note(conn, &key, &id)
    })
}

#[tauri::command]
pub fn update_note(state: State<'_, AppState>, id: String, payload: NotePayload) -> Result<Note> {
    let key = dek(&state)?;
    let ts = now();
    state.db.with(|conn| {
        let n = conn.execute(
            "UPDATE notes SET
                title = ?1, content_enc = ?2, tags = ?3, folder_id = ?4,
                favorite = ?5, updated_at = ?6
             WHERE id = ?7",
            rusqlite::params![
                payload.title,
                enc_opt(&key, &payload.content)?,
                tags_to_json(&payload.tags),
                payload.folder_id,
                payload.favorite as i64,
                ts,
                id,
            ],
        )?;
        if n == 0 {
            return Err(AppError::Msg(format!("catatan tidak ditemukan: {id}")));
        }
        log_activity(conn, "notes", "update", Some(&payload.title))?;
        fetch_note(conn, &key, &id)
    })
}

#[tauri::command]
pub fn delete_note(state: State<'_, AppState>, id: String) -> Result<()> {
    state.db.with(|conn| {
        let title = conn
            .query_row(
                "SELECT title FROM notes WHERE id = ?1",
                rusqlite::params![id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        conn.execute("DELETE FROM notes WHERE id = ?1", rusqlite::params![id])?;
        log_activity(conn, "notes", "delete", title.as_deref())?;
        Ok(())
    })
}

#[tauri::command]
pub fn duplicate_note(state: State<'_, AppState>, id: String) -> Result<Note> {
    let key = dek(&state)?;
    state.db.with(|conn| {
        let src = fetch_note(conn, &key, &id)?;
        let new_id_v = new_id();
        let ts = now();
        let title = format!("{} (copy)", src.title);
        conn.execute(
            "INSERT INTO notes
                (id, title, content_enc, tags, folder_id, favorite, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                new_id_v,
                title,
                enc_opt(&key, &src.content)?,
                tags_to_json(&src.tags),
                src.folder_id,
                src.favorite as i64,
                ts,
                ts,
            ],
        )?;
        log_activity(conn, "notes", "duplicate", Some(&title))?;
        fetch_note(conn, &key, &new_id_v)
    })
}

#[tauri::command]
pub fn toggle_note_favorite(state: State<'_, AppState>, id: String) -> Result<()> {
    state.db.with(|conn| {
        let n = conn.execute(
            "UPDATE notes
                SET favorite = CASE favorite WHEN 1 THEN 0 ELSE 1 END, updated_at = ?1
             WHERE id = ?2",
            rusqlite::params![now(), id],
        )?;
        if n == 0 {
            return Err(AppError::Msg(format!("catatan tidak ditemukan: {id}")));
        }
        log_activity(conn, "notes", "favorite", None)?;
        Ok(())
    })
}
