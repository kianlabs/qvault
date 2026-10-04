// QVAULT — income.rs (A3). SPEC §4: list/create/update/delete + income_summary.
//
// `notes_enc` didekripsi ke `String` (kontrak A.4).
// `currency`/`category`/`date` di TS bertipe `string` (non-null) → emit "" bila NULL.

use chrono::{Datelike, Utc};
use rusqlite::{Connection, OptionalExtension, Row};
use tauri::State;

use crate::crypto::Key;
use crate::error::{AppError, Result};
use crate::models::{Income, IncomeMonthTotal, IncomePayload, IncomeSummary};
use crate::state::AppState;

use super::{dec_str, dek, enc_opt, log_activity, new_id, now};

const COLS: &str =
    "id, source, amount, currency, category, date, notes_enc, created_at, updated_at";

fn map_row(row: &Row<'_>, key: &Key) -> rusqlite::Result<Income> {
    Ok(Income {
        id: row.get(0)?,
        source: row.get(1)?,
        amount: row.get(2)?,
        currency: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
        category: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
        date: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
        notes: Some(dec_str(key, &row.get(6)?)),
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

fn fetch_income(conn: &Connection, key: &Key, id: &str) -> Result<Income> {
    let sql = format!("SELECT {COLS} FROM income WHERE id = ?1");
    conn.query_row(&sql, rusqlite::params![id], |row| map_row(row, key))
        .optional()?
        .ok_or_else(|| AppError::Msg(format!("pemasukan tidak ditemukan: {id}")))
}

/// 6 bulan terakhir (termasuk bulan berjalan), urut lama → baru, format "YYYY-MM".
fn last_six_months() -> Vec<String> {
    let now = Utc::now();
    let mut year = now.year();
    let mut month = now.month() as i32;

    let mut months = Vec::with_capacity(6);
    for _ in 0..6 {
        months.push(format!("{year:04}-{month:02}"));
        month -= 1;
        if month == 0 {
            month = 12;
            year -= 1;
        }
    }
    months.reverse();
    months
}

#[tauri::command]
pub fn list_income(state: State<'_, AppState>, search: Option<String>) -> Result<Vec<Income>> {
    let key = dek(&state)?;
    state.db.with(|conn| {
        let search_term = search
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_lowercase);

        let sql = format!("SELECT {COLS} FROM income ORDER BY date DESC, created_at DESC");
        let mut stmt = conn.prepare(&sql)?;
        let mut items = stmt
            .query_map([], |row| map_row(row, &key))?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        if let Some(term) = &search_term {
            items.retain(|i| {
                i.source.to_lowercase().contains(term)
                    || i.category.to_lowercase().contains(term)
                    || i.notes
                        .as_deref()
                        .unwrap_or("")
                        .to_lowercase()
                        .contains(term)
            });
        }
        Ok(items)
    })
}

#[tauri::command]
pub fn create_income(state: State<'_, AppState>, payload: IncomePayload) -> Result<Income> {
    let key = dek(&state)?;
    let id = new_id();
    let ts = now();
    state.db.with(|conn| {
        conn.execute(
            "INSERT INTO income
                (id, source, amount, currency, category, date, notes_enc, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                id,
                payload.source,
                payload.amount,
                payload.currency,
                payload.category,
                payload.date,
                enc_opt(&key, &payload.notes)?,
                ts,
                ts,
            ],
        )?;
        log_activity(conn, "income", "create", Some(&payload.source))?;
        fetch_income(conn, &key, &id)
    })
}

#[tauri::command]
pub fn update_income(
    state: State<'_, AppState>,
    id: String,
    payload: IncomePayload,
) -> Result<Income> {
    let key = dek(&state)?;
    let ts = now();
    state.db.with(|conn| {
        let n = conn.execute(
            "UPDATE income SET
                source = ?1, amount = ?2, currency = ?3, category = ?4, date = ?5,
                notes_enc = ?6, updated_at = ?7
             WHERE id = ?8",
            rusqlite::params![
                payload.source,
                payload.amount,
                payload.currency,
                payload.category,
                payload.date,
                enc_opt(&key, &payload.notes)?,
                ts,
                id,
            ],
        )?;
        if n == 0 {
            return Err(AppError::Msg(format!("pemasukan tidak ditemukan: {id}")));
        }
        log_activity(conn, "income", "update", Some(&payload.source))?;
        fetch_income(conn, &key, &id)
    })
}

#[tauri::command]
pub fn delete_income(state: State<'_, AppState>, id: String) -> Result<()> {
    state.db.with(|conn| {
        let source = conn
            .query_row(
                "SELECT source FROM income WHERE id = ?1",
                rusqlite::params![id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        conn.execute("DELETE FROM income WHERE id = ?1", rusqlite::params![id])?;
        log_activity(conn, "income", "delete", source.as_deref())?;
        Ok(())
    })
}

#[tauri::command]
pub fn income_summary(state: State<'_, AppState>) -> Result<IncomeSummary> {
    state.db.with(|conn| {
        let all_time: f64 =
            conn.query_row("SELECT COALESCE(SUM(amount), 0) FROM income", [], |r| {
                r.get(0)
            })?;

        let months = last_six_months();
        let mut by_month = Vec::with_capacity(months.len());
        for m in &months {
            let total: f64 = conn.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM income WHERE substr(date, 1, 7) = ?1",
                rusqlite::params![m],
                |r| r.get(0),
            )?;
            by_month.push(IncomeMonthTotal {
                month: m.clone(),
                total,
            });
        }

        let this_month = by_month.last().map(|m| m.total).unwrap_or(0.0);
        Ok(IncomeSummary {
            this_month,
            all_time,
            by_month,
        })
    })
}
