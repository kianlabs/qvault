// QVAULT — vault.rs (A3). SPEC §4: list/create/update/delete/toggle/reveal.
//
// Field sensitif (username_enc, password_enc, notes_enc) didekripsi ke `String`
// (kontrak A.4: emit "" bila NULL/kosong/gagal, tidak pernah null).

use rusqlite::{Connection, OptionalExtension, Row};
use tauri::State;

use crate::crypto::Key;
use crate::error::{AppError, Result};
use crate::models::{NewPasswordHistoryEntry, PasswordHistoryEntry, VaultItem, VaultItemPayload};
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

/// Implementasi testable untuk create_vault_item.
pub(crate) fn create_vault_item_impl(
    state: &AppState,
    payload: VaultItemPayload,
) -> Result<VaultItem> {
    let key = dek(state)?;
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
                // Tri-state: None/Some(None) → NULL, Some(Some(s)) → encrypted.
                enc_opt(&key, &payload.totp.flatten())?,
            ],
        )?;
        log_activity(conn, "vault", "create", Some(&payload.title))?;
        fetch_item(conn, &key, &id)
    })
}

#[tauri::command]
pub fn create_vault_item(
    state: State<'_, AppState>,
    payload: VaultItemPayload,
) -> Result<VaultItem> {
    create_vault_item_impl(&state, payload)
}

/// Implementasi testable untuk update_vault_item.
pub(crate) fn update_vault_item_impl(
    state: &AppState,
    id: &str,
    payload: VaultItemPayload,
) -> Result<VaultItem> {
    let key = dek(state)?;
    let ts = now();
    let title = payload.title.clone(); // Clone untuk log_activity setelah payload di-move.
    state.db.with(|conn| {
        // Wave 4: kolom totp_enc wajib ada sebelum UPDATE.
        ensure_column(conn, "vault_items", "totp_enc", "TEXT")?;

        // Wave 6: sebelum menimpa password, simpan password LAMA ke riwayat.
        // Hanya bila password baru non-kosong DAN berbeda dari yang lama —
        // sehingga riwayat berisi nilai yang benar-benar pernah dipakai.
        let new_password = payload.password.clone().unwrap_or_default();
        if !new_password.is_empty() {
            let old_blob: Option<Option<String>> = conn
                .query_row(
                    "SELECT password_enc FROM vault_items WHERE id = ?1",
                    rusqlite::params![id],
                    |row| row.get(0),
                )
                .optional()?;
            if let Some(Some(old_blob)) = old_blob {
                if !old_blob.is_empty() {
                    let old_plain = dec_str(&key, &Some(old_blob.clone()));
                    if !old_plain.is_empty() && old_plain != new_password {
                        conn.execute(
                            "INSERT INTO password_history (id, item_id, password_enc, created_at)
                             VALUES (?1, ?2, ?3, ?4)",
                            rusqlite::params![new_id(), id, old_blob, ts],
                        )?;
                    }
                }
            }
        }

        // Tri-state TOTP:
        // - None → field absen, JANGAN sentuh kolom totp_enc (preserve).
        // - Some(v) → update totp_enc = enc_opt(&key, &v).
        let n = match &payload.totp {
            None => {
                // Field absen → JANGAN sertakan totp_enc di UPDATE.
                conn.execute(
                    "UPDATE vault_items SET
                        title = ?1, username_enc = ?2, password_enc = ?3, url = ?4, notes_enc = ?5,
                        tags = ?6, folder_id = ?7, favorite = ?8, icon = ?9, updated_at = ?10
                     WHERE id = ?11",
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
                        id,
                    ],
                )?
            }
            Some(v) => {
                // Some(None) → NULL, Some(Some(s)) → encrypted.
                conn.execute(
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
                        enc_opt(&key, v)?,
                        id,
                    ],
                )?
            }
        };

        if n == 0 {
            return Err(AppError::Msg(format!("item vault tidak ditemukan: {id}")));
        }
        log_activity(conn, "vault", "update", Some(&title))?;
        fetch_item(conn, &key, id)
    })
}

#[tauri::command]
pub fn update_vault_item(
    state: State<'_, AppState>,
    id: String,
    payload: VaultItemPayload,
) -> Result<VaultItem> {
    update_vault_item_impl(&state, &id, payload)
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

/// Wave 6: daftar riwayat password LAMA sebuah item (terbaru dulu).
pub(crate) fn list_password_history_impl(
    state: &AppState,
    id: &str,
) -> Result<Vec<PasswordHistoryEntry>> {
    let key = dek(state)?;
    state.db.with(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, item_id, password_enc, created_at
               FROM password_history WHERE item_id = ?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt
            .query_map(rusqlite::params![id], |row| {
                let blob: String = row.get(2)?;
                Ok(PasswordHistoryEntry {
                    id: row.get(0)?,
                    item_id: row.get(1)?,
                    password: Some(dec_str(&key, &Some(blob))),
                    created_at: row.get(3)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    })
}

#[tauri::command]
pub fn list_password_history(
    state: State<'_, AppState>,
    id: String,
) -> Result<Vec<PasswordHistoryEntry>> {
    list_password_history_impl(&state, &id)
}

/// Wave 6: pulihkan password dari riwayat. Password saat ini disimpan ke riwayat
/// lebih dulu, lalu entri riwayat yang dipulihkan dihapus (riwayat bergeser, tidak
/// menggandakan nilai).
pub(crate) fn restore_password_history_impl(
    state: &AppState,
    history_id: &str,
) -> Result<NewPasswordHistoryEntry> {
    let key = dek(state)?;
    let ts = now();
    state.db.with(|conn| {
        let (item_id, old_blob): (String, String) = conn
            .query_row(
                "SELECT item_id, password_enc FROM password_history WHERE id = ?1",
                rusqlite::params![history_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?
            .ok_or_else(|| AppError::Msg(format!("entri riwayat tidak ditemukan: {history_id}")))?;

        // Password saat ini (yang akan digantikan) → simpan ke riwayat baru.
        let current_blob: Option<String> = conn.query_row(
            "SELECT password_enc FROM vault_items WHERE id = ?1",
            rusqlite::params![item_id],
            |row| row.get::<_, Option<String>>(0),
        )?;
        let new_history_id = new_id();
        if let Some(cur) = current_blob.as_ref().filter(|s| !s.is_empty()) {
            conn.execute(
                "INSERT INTO password_history (id, item_id, password_enc, created_at)
                 VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![new_history_id, item_id, cur, ts],
            )?;
        }

        // Pasang password lama sebagai password aktif.
        conn.execute(
            "UPDATE vault_items SET password_enc = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![old_blob, ts, item_id],
        )?;

        // Entri yang dipulihkan sudah tidak relevan → hapus.
        conn.execute(
            "DELETE FROM password_history WHERE id = ?1",
            rusqlite::params![history_id],
        )?;

        log_activity(conn, "vault", "restore_password", None)?;
        Ok(NewPasswordHistoryEntry {
            restored_id: history_id.to_string(),
            entry: PasswordHistoryEntry {
                id: new_history_id,
                item_id,
                password: current_blob.map(|blob| dec_str(&key, &Some(blob))),
                created_at: ts,
            },
        })
    })
}

#[tauri::command]
pub fn restore_password_history(
    state: State<'_, AppState>,
    history_id: String,
) -> Result<NewPasswordHistoryEntry> {
    restore_password_history_impl(&state, &history_id)
}

#[cfg(test)]
#[path = "vault_test.rs"]
mod tests;
