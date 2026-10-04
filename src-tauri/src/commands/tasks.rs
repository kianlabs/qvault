// QVAULT — tasks.rs (A3). SPEC §4: list/create/update/delete/set_status + dashboard.
//
// `description_enc` didekripsi ke `String` (kontrak A.4).
// `priority` & `due_date`: priority di TS `string` → emit ""; dueDate `string|null`
// → tetap None (kontrak A.4).

use rusqlite::{Connection, OptionalExtension, Row};
use tauri::State;

use crate::crypto::Key;
use crate::error::{AppError, Result};
use crate::models::{DashboardStats, Task, TaskPayload};
use crate::state::AppState;

use super::activity::fetch_activity;
use super::{dec_str, dek, enc_opt, log_activity, new_id, now, tags_from_json, tags_to_json};

const COLS: &str = "id, title, description_enc, status, priority, due_date, tags, \
                    folder_id, created_at, updated_at";

fn map_row(row: &Row<'_>, key: &Key) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        description: Some(dec_str(key, &row.get(2)?)),
        status: row.get(3)?,
        priority: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
        due_date: row.get(5)?,
        tags: tags_from_json(&row.get(6)?),
        folder_id: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

fn fetch_task(conn: &Connection, key: &Key, id: &str) -> Result<Task> {
    let sql = format!("SELECT {COLS} FROM tasks WHERE id = ?1");
    conn.query_row(&sql, rusqlite::params![id], |row| map_row(row, key))
        .optional()?
        .ok_or_else(|| AppError::Msg(format!("tugas tidak ditemukan: {id}")))
}

#[tauri::command]
pub fn list_tasks(
    state: State<'_, AppState>,
    status: Option<String>,
    folder_id: Option<String>,
) -> Result<Vec<Task>> {
    let key = dek(&state)?;
    state.db.with(|conn| {
        let status_filter = status.as_deref().filter(|s| !s.is_empty());
        let folder_filter = folder_id.as_deref().filter(|s| !s.is_empty());

        let sql = format!("SELECT {COLS} FROM tasks ORDER BY updated_at DESC");
        let mut stmt = conn.prepare(&sql)?;
        let mut items = stmt
            .query_map([], |row| map_row(row, &key))?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        if let Some(st) = status_filter {
            items.retain(|t| t.status == st);
        }
        if let Some(fid) = folder_filter {
            items.retain(|t| t.folder_id.as_deref() == Some(fid));
        }
        Ok(items)
    })
}

#[tauri::command]
pub fn create_task(state: State<'_, AppState>, payload: TaskPayload) -> Result<Task> {
    let key = dek(&state)?;
    let id = new_id();
    let ts = now();
    state.db.with(|conn| {
        conn.execute(
            "INSERT INTO tasks
                (id, title, description_enc, status, priority, due_date, tags, folder_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                id,
                payload.title,
                enc_opt(&key, &payload.description)?,
                payload.status,
                payload.priority,
                payload.due_date,
                tags_to_json(&payload.tags),
                payload.folder_id,
                ts,
                ts,
            ],
        )?;
        log_activity(conn, "tasks", "create", Some(&payload.title))?;
        fetch_task(conn, &key, &id)
    })
}

#[tauri::command]
pub fn update_task(state: State<'_, AppState>, id: String, payload: TaskPayload) -> Result<Task> {
    let key = dek(&state)?;
    let ts = now();
    state.db.with(|conn| {
        let n = conn.execute(
            "UPDATE tasks SET
                title = ?1, description_enc = ?2, status = ?3, priority = ?4, due_date = ?5,
                tags = ?6, folder_id = ?7, updated_at = ?8
             WHERE id = ?9",
            rusqlite::params![
                payload.title,
                enc_opt(&key, &payload.description)?,
                payload.status,
                payload.priority,
                payload.due_date,
                tags_to_json(&payload.tags),
                payload.folder_id,
                ts,
                id,
            ],
        )?;
        if n == 0 {
            return Err(AppError::Msg(format!("tugas tidak ditemukan: {id}")));
        }
        log_activity(conn, "tasks", "update", Some(&payload.title))?;
        fetch_task(conn, &key, &id)
    })
}

#[tauri::command]
pub fn delete_task(state: State<'_, AppState>, id: String) -> Result<()> {
    state.db.with(|conn| {
        let title = conn
            .query_row(
                "SELECT title FROM tasks WHERE id = ?1",
                rusqlite::params![id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        conn.execute("DELETE FROM tasks WHERE id = ?1", rusqlite::params![id])?;
        log_activity(conn, "tasks", "delete", title.as_deref())?;
        Ok(())
    })
}

#[tauri::command]
pub fn set_task_status(state: State<'_, AppState>, id: String, status: String) -> Result<Task> {
    let key = dek(&state)?;
    state.db.with(|conn| {
        let n = conn.execute(
            "UPDATE tasks SET status = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![status, now(), id],
        )?;
        if n == 0 {
            return Err(AppError::Msg(format!("tugas tidak ditemukan: {id}")));
        }
        log_activity(conn, "tasks", "status", None)?;
        fetch_task(conn, &key, &id)
    })
}

#[tauri::command]
pub fn dashboard_stats(state: State<'_, AppState>) -> Result<DashboardStats> {
    let key = dek(&state)?;
    state.db.with(|conn| {
        let total_items: i64 =
            conn.query_row("SELECT COUNT(*) FROM vault_items", [], |r| r.get(0))?;
        let total_notes: i64 = conn.query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))?;

        // Overdue: belum selesai & jatuh tempo sebelum hari ini.
        let tasks_overdue: i64 = conn.query_row(
            "SELECT COUNT(*) FROM tasks
             WHERE status <> 'done' AND due_date IS NOT NULL AND due_date <> ''
               AND date(due_date) < date('now')",
            [],
            |r| r.get(0),
        )?;

        // Jatuh tempo hari ini (belum selesai).
        let tasks_today: i64 = conn.query_row(
            "SELECT COUNT(*) FROM tasks
             WHERE status <> 'done' AND due_date IS NOT NULL AND due_date <> ''
               AND date(due_date) = date('now')",
            [],
            |r| r.get(0),
        )?;

        let tasks_done: i64 = conn.query_row(
            "SELECT COUNT(*) FROM tasks WHERE status = 'done'",
            [],
            |r| r.get(0),
        )?;

        // Pemasukan bulan berjalan.
        let income_this_month: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM income
             WHERE substr(date, 1, 7) = strftime('%Y-%m', 'now')",
            [],
            |r| r.get(0),
        )?;

        // ~8 aktivitas terbaru + 5 tugas terdekat yang belum selesai.
        let recent_activity = fetch_activity(conn, 8)?;
        let sql = format!(
            "SELECT {COLS} FROM tasks
             WHERE status <> 'done' AND due_date IS NOT NULL AND due_date <> ''
             ORDER BY date(due_date) ASC LIMIT 5"
        );
        let mut stmt = conn.prepare(&sql)?;
        let upcoming_tasks = stmt
            .query_map([], |row| map_row(row, &key))?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(DashboardStats {
            total_items,
            total_notes,
            tasks_overdue,
            tasks_today,
            tasks_done,
            income_this_month,
            recent_activity,
            upcoming_tasks,
        })
    })
}
