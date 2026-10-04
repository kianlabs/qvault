// QVAULT — vault.rs (A3). SPEC §4: list/create/update/delete/toggle/reveal.
//
// Field sensitif (username_enc, password_enc, notes_enc) didekripsi ke `String`
// (kontrak A.4: emit "" bila NULL/kosong/gagal, tidak pernah null).

use rusqlite::{Connection, OptionalExtension, Row};
use tauri::State;

use crate::crypto::Key;
use crate::error::{AppError, Result};
use crate::models::{VaultItem, VaultItemPayload};
use crate::state::AppState;

use super::{
    dec_str, dek, enc_opt, ensure_column, log_activity, new_id, now, tags_from_json, tags_to_json,
};

const COLS: &str = "id, title, username_enc, password_enc, url, notes_enc, tags, \
                    folder_id, favorite, icon, created_at, updated_at, totp_enc";

fn map_row(row: &Row<'_>, key: &Key) -> rusqlite::Result<VaultItem> {
    Ok(VaultItem {
        id: row.get(0)?,
        title: row.get(1)?,
        username: Some(dec_str(key, &row.get(2)?)),
        password: Some(dec_str(key, &row.get(3)?)),
        url: Some(row.get::<_, Option<String>>(4)?.unwrap_or_default()),
        notes: Some(dec_str(key, &row.get(5)?)),
        tags: tags_from_json(&row.get(6)?),
        folder_id: row.get(7)?,
        favorite: row.get::<_, i64>(8)? != 0,
        icon: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        // Wave 4: 2FA aktif bila kolom totp_enc berisi (bukan NULL/kosong).
        has_totp: row
            .get::<_, Option<String>>(12)?
            .map(|s| !s.is_empty())
            .unwrap_or(false),
    })
}

fn fetch_item(conn: &Connection, key: &Key, id: &str) -> Result<VaultItem> {
    let sql = format!("SELECT {COLS} FROM vault_items WHERE id = ?1");
    conn.query_row(&sql, rusqlite::params![id], |row| map_row(row, key))
        .optional()?
        .ok_or_else(|| AppError::Msg(format!("item vault tidak ditemukan: {id}")))
}

#[tauri::command]
pub fn list_vault_items(
    state: State<'_, AppState>,
    search: Option<String>,
    folder_id: Option<String>,
    favorite_only: Option<bool>,
) -> Result<Vec<VaultItem>> {
    let key = dek(&state)?;
    state.db.with(|conn| {
        // Wave 4: pastikan kolom totp_enc ada (DB lama) sebelum SELECT * COLS.
        ensure_column(conn, "vault_items", "totp_enc", "TEXT")?;
        // title tidak terenkripsi → bisa difilter di SQL. Search atas username
        // dilakukan setelah dekripsi (field sensitif tidak bisa di-query).
        let search_term = search
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_lowercase);
        let folder_filter = folder_id.as_deref().filter(|s| !s.is_empty());
        let fav = favorite_only.unwrap_or(false);

        let sql = format!("SELECT {COLS} FROM vault_items ORDER BY updated_at DESC");
        let mut stmt = conn.prepare(&sql)?;
        let mut items = stmt
            .query_map([], |row| map_row(row, &key))?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        if let Some(term) = &search_term {
            items.retain(|it| {
                it.title.to_lowercase().contains(term)
                    || it
                        .username
                        .as_deref()
                        .unwrap_or("")
                        .to_lowercase()
                        .contains(term)
                    || it
                        .url
                        .as_deref()
                        .unwrap_or("")
                        .to_lowercase()
                        .contains(term)
            });
        }
        if let Some(fid) = folder_filter {
            items.retain(|it| it.folder_id.as_deref() == Some(fid));
        }
        if fav {
            items.retain(|it| it.favorite);
        }
        Ok(items)
    })
}

#[tauri::command]
pub fn create_vault_item(
    state: State<'_, AppState>,
    payload: VaultItemPayload,
) -> Result<VaultItem> {
    let key = dek(&state)?;
    let id = new_id();
    let ts = now();
    state.db.with(|conn| {
        // Wave 4: kolom totp_enc wajib ada sebelum INSERT.
        ensure_column(conn, "vault_items", "totp_enc", "TEXT")?;
        conn.execute(
            "INSERT INTO vault_items
                (id, title, username_enc, password_enc, url, notes_enc, tags, folder_id, favorite, icon, created_at, updated_at, totp_enc)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            rusqlite::params![
                id,
                payload.title,
                enc_opt(&key, &payload.username)?,
                enc_opt(&key, &payload.password)?,
                payload.url,
                enc_opt(&key, &payload.notes)?,
                tags_to_json(&payload.tags),
                payload.folder_id,
                payload.favorite as i64,
                payload.icon,
                ts,
                ts,
                enc_opt(&key, &payload.totp)?,
            ],
        )?;
        log_activity(conn, "vault", "create", Some(&payload.title))?;
        fetch_item(conn, &key, &id)
    })
}

#[tauri::command]
pub fn update_vault_item(
    state: State<'_, AppState>,
    id: String,
    payload: VaultItemPayload,
) -> Result<VaultItem> {
    let key = dek(&state)?;
    let ts = now();
    state.db.with(|conn| {
        // Wave 4: kolom totp_enc wajib ada sebelum UPDATE.
        ensure_column(conn, "vault_items", "totp_enc", "TEXT")?;
        let n = conn.execute(
            "UPDATE vault_items SET
                title = ?1, username_enc = ?2, password_enc = ?3, url = ?4, notes_enc = ?5,
                tags = ?6, folder_id = ?7, favorite = ?8, icon = ?9, updated_at = ?10,
                totp_enc = ?11
             WHERE id = ?12",
            rusqlite::params![
                payload.title,
                enc_opt(&key, &payload.username)?,
                enc_opt(&key, &payload.password)?,
                payload.url,
                enc_opt(&key, &payload.notes)?,
                tags_to_json(&payload.tags),
                payload.folder_id,
                payload.favorite as i64,
                payload.icon,
                ts,
                // Kontrak E.3: tulis apa adanya (None → NULL).
                enc_opt(&key, &payload.totp)?,
                id,
            ],
        )?;
        if n == 0 {
            return Err(AppError::Msg(format!("item vault tidak ditemukan: {id}")));
        }
        log_activity(conn, "vault", "update", Some(&payload.title))?;
        fetch_item(conn, &key, &id)
    })
}

#[tauri::command]
pub fn delete_vault_item(state: State<'_, AppState>, id: String) -> Result<()> {
    state.db.with(|conn| {
        let title = conn
            .query_row(
                "SELECT title FROM vault_items WHERE id = ?1",
                rusqlite::params![id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        conn.execute(
            "DELETE FROM vault_items WHERE id = ?1",
            rusqlite::params![id],
        )?;
        log_activity(conn, "vault", "delete", title.as_deref())?;
        Ok(())
    })
}

#[tauri::command]
pub fn toggle_vault_favorite(state: State<'_, AppState>, id: String) -> Result<()> {
    state.db.with(|conn| {
        let n = conn.execute(
            "UPDATE vault_items
                SET favorite = CASE favorite WHEN 1 THEN 0 ELSE 1 END, updated_at = ?1
             WHERE id = ?2",
            rusqlite::params![now(), id],
        )?;
        if n == 0 {
            return Err(AppError::Msg(format!("item vault tidak ditemukan: {id}")));
        }
        log_activity(conn, "vault", "favorite", None)?;
        Ok(())
    })
}

#[tauri::command]
pub fn reveal_vault_password(state: State<'_, AppState>, id: String) -> Result<String> {
    let key = dek(&state)?;
    state.db.with(|conn| {
        let blob = conn
            .query_row(
                "SELECT password_enc FROM vault_items WHERE id = ?1",
                rusqlite::params![id],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()?
            .ok_or_else(|| AppError::Msg(format!("item vault tidak ditemukan: {id}")))?;
        Ok(dec_str(&key, &blob))
    })
}
