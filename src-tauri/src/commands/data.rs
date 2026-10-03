// QVAULT — data.rs (Wave 3, kontrak A). Backup/restore terenkripsi, CSV
// import/export, dan CRUD template.
//
// Prinsip (kontrak A.4):
//   * Backup = seluruh isi tabel sebagai JSON apa adanya (kolom *_enc tetap
//     terenkripsi DEK), lalu dienkripsi lagi dengan key dari password backup.
//     Format file satu baris: "QVLTBK1:<salt_b64>:<nonce_b64>:<ct_b64>".
//   * CSV = plaintext (username/password/notes dikeluarkan via dec_str); saat
//     import field sensitif dienkripsi ulang dengan DEK.
//   * Semua akses DB lewat `state.db.with(|conn| ...)` supaya aman antar thread.

use rusqlite::{Connection, Row};
use serde_json::{json, Map, Value};
use tauri::State;

use crate::crypto::{decrypt, derive_key, encrypt, new_salt, Key};
use crate::error::{AppError, Result};
use crate::models::{ImportResult, Template, TemplatePayload};
use crate::state::AppState;

use super::{
    b64_decode, b64_encode, dec_str, dek, enc_opt, log_activity, new_id, now, tags_to_json,
};

/// Prefix format file backup (kontrak A.4). Satu baris teks.
const BACKUP_PREFIX: &str = "QVLTBK1:";

// ---------------------------------------------------------------------------
// util kecil
// ---------------------------------------------------------------------------

/// Ubah Value apa pun menjadi String mentah untuk bind SQL.
/// Null → None (kolom NULL); angka/bool/objek → representasi JSON-nya.
fn vstr(v: &Value) -> Option<String> {
    match v {
        Value::Null => None,
        Value::String(s) => Some(s.clone()),
        other => Some(other.to_string()),
    }
}

/// Baca seluruh baris `table` sebagai array JSON (nilai kolom apa adanya).
fn read_table(conn: &Connection, table: &str) -> Result<Vec<Value>> {
    let mut stmt = conn.prepare(&format!("SELECT * FROM {table}"))?;
    let col_names: Vec<String> = stmt.column_names().iter().map(|c| c.to_string()).collect();
    let rows = stmt
        .query_map([], |row| row_to_json(row, &col_names))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// Satu baris SQLite → object JSON { nama_kolom: nilai }.
fn row_to_json(row: &Row<'_>, cols: &[String]) -> rusqlite::Result<Value> {
    let mut map = Map::with_capacity(cols.len());
    for (i, name) in cols.iter().enumerate() {
        let v = match row.get_ref(i)? {
            rusqlite::types::ValueRef::Null => Value::Null,
            rusqlite::types::ValueRef::Integer(n) => Value::from(n),
            rusqlite::types::ValueRef::Real(f) => Value::from(f),
            rusqlite::types::ValueRef::Text(t) => {
                Value::String(String::from_utf8_lossy(t).into_owned())
            }
            rusqlite::types::ValueRef::Blob(b) => {
                Value::String(String::from_utf8_lossy(b).into_owned())
            }
        };
        map.insert(name.clone(), v);
    }
    Ok(Value::Object(map))
}

// ---------------------------------------------------------------------------
// A.3 — backup / restore
// ---------------------------------------------------------------------------

/// Tabel yang disertakan dalam backup, urut aman untuk restore
/// (folders sebelum item yang mereferensikannya).
const BACKUP_TABLES: [&str; 7] = [
    "folders",
    "vault_items",
    "notes",
    "tasks",
    "income",
    "activity_log",
    "templates",
];

/// Backup terenkripsi: seluruh DB → JSON → AES-256-GCM dengan key dari password.
#[tauri::command]
pub fn export_backup(state: State<'_, AppState>, path: String, password: String) -> Result<()> {
    export_backup_impl(&state, path, password)
}

/// Isi `export_backup` tanpa wrapper `State` (agar bisa diuji runtime).
pub(crate) fn export_backup_impl(state: &AppState, path: String, password: String) -> Result<()> {
    // Bangun JSON dari semua tabel.
    let payload = state.db.with(|conn| {
        let mut tables = Map::new();
        for t in BACKUP_TABLES {
            tables.insert(t.to_string(), Value::Array(read_table(conn, t)?));
        }
        Ok(json!({
            "version": 1,
            "exportedAt": now(),
            "tables": Value::Object(tables),
        }))
    })?;

    let json_bytes = serde_json::to_vec(&payload)
        .map_err(|e| AppError::Msg(format!("gagal serialisasi backup: {e}")))?;

    // Enkripsi dengan key turunan password.
    let salt = new_salt();
    let key_bytes = derive_key(&password, &salt)?;
    let key = Key(key_bytes);
    let blob = encrypt(&key, &json_bytes)?; // "nonce_b64:ct_b64"

    let contents = format!("{BACKUP_PREFIX}{}:{}", b64_encode(&salt), blob);
    std::fs::write(&path, contents)?;

    state.db.with(|conn| {
        log_activity(conn, "data", "backup", Some(&path))?;
        Ok(())
    })
}

/// Restore: baca file, verifikasi password (AEAD), wipe tabel data, insert ulang.
#[tauri::command]
pub fn import_backup(state: State<'_, AppState>, path: String, password: String) -> Result<()> {
    import_backup_impl(&state, path, password)
}

/// Isi `import_backup` tanpa wrapper `State` (agar bisa diuji runtime).
pub(crate) fn import_backup_impl(state: &AppState, path: String, password: String) -> Result<()> {
    let contents = std::fs::read_to_string(&path)?;
    let rest = contents
        .trim()
        .strip_prefix(BACKUP_PREFIX)
        .ok_or_else(|| AppError::Msg("file backup tidak valid".into()))?;

    let (salt_b64, blob) = rest
        .split_once(':')
        .ok_or_else(|| AppError::Msg("file backup tidak valid".into()))?;

    let salt = b64_decode(salt_b64)?;
    let key_bytes = derive_key(&password, &salt)?;
    let key = Key(key_bytes);

    // AEAD: password salah → dekripsi gagal.
    let plain = decrypt(&key, blob).map_err(|_| AppError::Msg("password backup salah".into()))?;

    let root: Value = serde_json::from_slice(&plain)
        .map_err(|e| AppError::Msg(format!("isi backup tidak valid: {e}")))?;
    let tables = root
        .get("tables")
        .and_then(Value::as_object)
        .ok_or_else(|| AppError::Msg("file backup tidak valid".into()))?;

    state.db.with(|conn| {
        // Satu transaksi: hapus lalu isi ulang. Rollback otomatis bila error.
        conn.execute_batch("BEGIN")?;
        let result = (|| -> Result<()> {
            for t in BACKUP_TABLES {
                conn.execute(&format!("DELETE FROM {t}"), [])?;
            }
            for t in BACKUP_TABLES {
                if let Some(Value::Array(rows)) = tables.get(t) {
                    insert_rows(conn, t, rows)?;
                }
            }
            Ok(())
        })();

        match result {
            Ok(()) => {
                conn.execute_batch("COMMIT")?;
                log_activity(conn, "data", "restore", Some(&path))?;
                Ok(())
            }
            Err(e) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(e)
            }
        }
    })
}

/// INSERT generik satu tabel dari array object JSON (kolom dinamis).
fn insert_rows(conn: &Connection, table: &str, rows: &[Value]) -> Result<()> {
    for row in rows {
        let obj = match row.as_object() {
            Some(o) if !o.is_empty() => o,
            _ => continue,
        };
        let mut cols: Vec<String> = Vec::with_capacity(obj.len());
        let mut vals: Vec<Option<String>> = Vec::with_capacity(obj.len());
        for (k, v) in obj {
            cols.push(k.clone());
            vals.push(vstr(v));
        }
        let placeholders: Vec<String> = (1..=cols.len()).map(|i| format!("?{i}")).collect();
        let sql = format!(
            "INSERT OR REPLACE INTO {table} ({}) VALUES ({})",
            cols.join(", "),
            placeholders.join(", ")
        );
        let params: Vec<&dyn rusqlite::ToSql> =
            vals.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
        conn.execute(&sql, params.as_slice())?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// A.3 — CSV export / import
// ---------------------------------------------------------------------------

/// Definisi kolom CSV per kind (urutan header PERSIS kontrak A.4).
struct CsvSpec {
    headers: &'static [&'static str],
    /// SQL SELECT dengan alias = nama header (nilai mentah / *_enc mentah).
    select: &'static str,
}

fn spec_for(kind: &str) -> Result<CsvSpec> {
    match kind {
        "vault" => Ok(CsvSpec {
            headers: &[
                "id",
                "title",
                "username",
                "password",
                "url",
                "notes",
                "tags",
                "folder_id",
                "favorite",
                "icon",
                "created_at",
                "updated_at",
            ],
            select: "SELECT id, title, username_enc AS username, password_enc AS password, \
                     url, notes_enc AS notes, tags, folder_id, favorite, icon, \
                     created_at, updated_at FROM vault_items",
        }),
        "notes" => Ok(CsvSpec {
            headers: &[
                "id",
                "title",
                "content",
                "tags",
                "folder_id",
                "favorite",
                "created_at",
                "updated_at",
            ],
            select: "SELECT id, title, content_enc AS content, tags, folder_id, favorite, \
                     created_at, updated_at FROM notes",
        }),
        "tasks" => Ok(CsvSpec {
            headers: &[
                "id",
                "title",
                "description",
                "status",
                "priority",
                "due_date",
                "tags",
                "folder_id",
                "created_at",
                "updated_at",
            ],
            select: "SELECT id, title, description_enc AS description, status, priority, \
                     due_date, tags, folder_id, created_at, updated_at FROM tasks",
        }),
        "income" => Ok(CsvSpec {
            headers: &[
                "id",
                "source",
                "amount",
                "currency",
                "category",
                "date",
                "notes",
                "created_at",
                "updated_at",
            ],
            select: "SELECT id, source, amount, currency, category, date, notes_enc AS notes, \
                     created_at, updated_at FROM income",
        }),
        other => Err(AppError::Msg(format!("kind tidak dikenal: {other}"))),
    }
}

/// Indeks kolom sensitif (yang perlu di-dekripsi) untuk tiap kind.
fn sensitive_cols(kind: &str) -> &'static [usize] {
    match kind {
        "vault" => &[2, 3, 5],  // username, password, notes
        "notes" => &[2],        // content
        "tasks" => &[2],        // description
        "income" => &[6],       // notes
        _ => &[],
    }
}

/// Baca satu tabel untuk export CSV → baris kolom mentah (urutan = spec.headers).
fn read_csv_rows(conn: &Connection, kind: &str) -> Result<Vec<Vec<String>>> {
    let spec = spec_for(kind)?;
    let ncols = spec.headers.len();
    let mut stmt = conn.prepare(spec.select)?;
    let rows = stmt
        .query_map([], |row| {
            let mut out = Vec::with_capacity(ncols);
            for i in 0..ncols {
                let v = match row.get_ref(i)? {
                    rusqlite::types::ValueRef::Null => String::new(),
                    rusqlite::types::ValueRef::Integer(n) => n.to_string(),
                    rusqlite::types::ValueRef::Real(f) => f.to_string(),
                    rusqlite::types::ValueRef::Text(t) => {
                        String::from_utf8_lossy(t).into_owned()
                    }
                    rusqlite::types::ValueRef::Blob(b) => {
                        String::from_utf8_lossy(b).into_owned()
                    }
                };
                out.push(v);
            }
            Ok(out)
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// kind = "vault" | "notes" | "tasks" | "income".
#[tauri::command]
pub fn export_csv(state: State<'_, AppState>, kind: String, path: String) -> Result<()> {
    export_csv_impl(&state, kind, path)
}

/// Isi `export_csv` tanpa wrapper `State` (agar bisa diuji runtime).
pub(crate) fn export_csv_impl(state: &AppState, kind: String, path: String) -> Result<()> {
    let key = dek(state)?;
    state.db.with(|conn| {
        let spec = spec_for(&kind)?;
        let mut rows = read_csv_rows(conn, &kind)?;

        // Dekripsi kolom sensitif → plaintext di CSV.
        for row in rows.iter_mut() {
            for &idx in sensitive_cols(&kind) {
                if let Some(cell) = row.get(idx) {
                    let blob = if cell.is_empty() {
                        None
                    } else {
                        Some(cell.clone())
                    };
                    row[idx] = dec_str(&key, &blob);
                }
            }
        }

        let mut wtr = csv::Writer::from_path(&path)
            .map_err(|e| AppError::Msg(format!("gagal membuka CSV: {e}")))?;
        wtr.write_record(spec.headers)
            .map_err(|e| AppError::Msg(format!("gagal tulis header CSV: {e}")))?;
        for row in &rows {
            wtr.write_record(row)
                .map_err(|e| AppError::Msg(format!("gagal tulis CSV: {e}")))?;
        }
        wtr.flush()
            .map_err(|e| AppError::Msg(format!("gagal flush CSV: {e}")))?;

        log_activity(conn, "data", "export", Some(&kind))?;
        Ok(())
    })
}

#[tauri::command]
pub fn import_csv(state: State<'_, AppState>, kind: String, path: String) -> Result<ImportResult> {
    import_csv_impl(&state, kind, path)
}

/// Isi `import_csv` tanpa wrapper `State` (agar bisa diuji runtime).
pub(crate) fn import_csv_impl(state: &AppState, kind: String, path: String) -> Result<ImportResult> {
    let key = dek(state)?;
    state.db.with(|conn| {
        // Pastikan kind dikenal (juga menentukan kolom wajib).
        spec_for(&kind)?;

        let mut rdr = csv::ReaderBuilder::new()
            .flexible(true)
            .from_path(&path)
            .map_err(|e| AppError::Msg(format!("gagal membuka CSV: {e}")))?;

        // Petakan header → indeks. Header di-trim agar toleran spasi.
        let headers: Vec<String> = match rdr.headers() {
            Ok(h) => h.iter().map(|s| s.trim().to_string()).collect(),
            Err(_) => Vec::new(),
        };
        let col = |name: &str| headers.iter().position(|h| h == name);

        let mut imported: i64 = 0;
        let mut skipped: i64 = 0;

        for rec in rdr.records() {
            let rec = match rec {
                Ok(r) => r,
                Err(_) => {
                    skipped += 1;
                    continue;
                }
            };
            // Ambil sel berdasarkan nama kolom (fallback posisi tetap).
            let get = |name: &str, fallback: usize| -> String {
                col(name)
                    .and_then(|i| rec.get(i))
                    .or_else(|| rec.get(fallback))
                    .unwrap_or("")
                    .trim()
                    .to_string()
            };

            match kind.as_str() {
                "vault" => {
                    let title = get("title", 1);
                    if title.is_empty() {
                        skipped += 1;
                        continue;
                    }
                    let id = non_empty_or(get("id", 0), new_id);
                    let ts = now();
                    let created = non_empty_or(get("created_at", 10), || ts.clone());
                    let updated = non_empty_or(get("updated_at", 11), || ts.clone());
                    let username = get("username", 2);
                    let password = get("password", 3);
                    let notes = get("notes", 5);
                    conn.execute(
                        "INSERT OR REPLACE INTO vault_items
                            (id, title, username_enc, password_enc, url, notes_enc, tags,
                             folder_id, favorite, icon, created_at, updated_at)
                         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
                        rusqlite::params![
                            id,
                            title,
                            enc_opt(&key, &Some(username))?,
                            enc_opt(&key, &Some(password))?,
                            none_if_empty(get("url", 4)),
                            enc_opt(&key, &Some(notes))?,
                            tags_cell(get("tags", 6)),
                            none_if_empty(get("folder_id", 7)),
                            truthy(&get("favorite", 8)),
                            none_if_empty(get("icon", 9)),
                            created,
                            updated,
                        ],
                    )?;
                    imported += 1;
                }
                "notes" => {
                    let title = get("title", 1);
                    if title.is_empty() {
                        skipped += 1;
                        continue;
                    }
                    let id = non_empty_or(get("id", 0), new_id);
                    let ts = now();
                    let created = non_empty_or(get("created_at", 6), || ts.clone());
                    let updated = non_empty_or(get("updated_at", 7), || ts.clone());
                    let content = get("content", 2);
                    conn.execute(
                        "INSERT OR REPLACE INTO notes
                            (id, title, content_enc, tags, folder_id, favorite, created_at, updated_at)
                         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                        rusqlite::params![
                            id,
                            title,
                            enc_opt(&key, &Some(content))?,
                            tags_cell(get("tags", 3)),
                            none_if_empty(get("folder_id", 4)),
                            truthy(&get("favorite", 5)),
                            created,
                            updated,
                        ],
                    )?;
                    imported += 1;
                }
                "tasks" => {
                    let title = get("title", 1);
                    if title.is_empty() {
                        skipped += 1;
                        continue;
                    }
                    let id = non_empty_or(get("id", 0), new_id);
                    let ts = now();
                    let created = non_empty_or(get("created_at", 8), || ts.clone());
                    let updated = non_empty_or(get("updated_at", 9), || ts.clone());
                    let description = get("description", 2);
                    let status = non_empty_or(get("status", 3), || "todo".to_string());
                    conn.execute(
                        "INSERT OR REPLACE INTO tasks
                            (id, title, description_enc, status, priority, due_date, tags,
                             folder_id, created_at, updated_at)
                         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
                        rusqlite::params![
                            id,
                            title,
                            enc_opt(&key, &Some(description))?,
                            status,
                            none_if_empty(get("priority", 4)),
                            none_if_empty(get("due_date", 5)),
                            tags_cell(get("tags", 6)),
                            none_if_empty(get("folder_id", 7)),
                            created,
                            updated,
                        ],
                    )?;
                    imported += 1;
                }
                "income" => {
                    let source = get("source", 1);
                    if source.is_empty() {
                        skipped += 1;
                        continue;
                    }
                    let id = non_empty_or(get("id", 0), new_id);
                    let ts = now();
                    let created = non_empty_or(get("created_at", 7), || ts.clone());
                    let updated = non_empty_or(get("updated_at", 8), || ts.clone());
                    let amount = get("amount", 2).parse::<f64>().unwrap_or(0.0);
                    let notes = get("notes", 6);
                    conn.execute(
                        "INSERT OR REPLACE INTO income
                            (id, source, amount, currency, category, date, notes_enc,
                             created_at, updated_at)
                         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
                        rusqlite::params![
                            id,
                            source,
                            amount,
                            none_if_empty(get("currency", 3)),
                            none_if_empty(get("category", 4)),
                            none_if_empty(get("date", 5)),
                            enc_opt(&key, &Some(notes))?,
                            created,
                            updated,
                        ],
                    )?;
                    imported += 1;
                }
                _ => unreachable!("kind sudah divalidasi spec_for"),
            }
        }

        log_activity(conn, "data", "import", Some(&kind))?;
        Ok(ImportResult { imported, skipped })
    })
}

/// Pakai `fallback()` bila string kosong.
fn non_empty_or(s: String, fallback: impl FnOnce() -> String) -> String {
    if s.is_empty() {
        fallback()
    } else {
        s
    }
}

/// "" → None (kolom NULL).
fn none_if_empty(s: String) -> Option<String> {
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

/// Kolom tags: jaga agar selalu JSON array string. Kosong → "[]".
fn tags_cell(s: String) -> String {
    if s.trim().is_empty() {
        "[]".to_string()
    } else if serde_json::from_str::<Vec<String>>(&s).is_ok() {
        s
    } else {
        // Bukan JSON valid → perlakukan sebagai satu tag.
        tags_to_json(&[s])
    }
}

/// "1"/"true"/"yes" → 1, selainnya 0 (untuk kolom favorite).
fn truthy(s: &str) -> i64 {
    if matches!(s.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes") {
        1
    } else {
        0
    }
}

// ---------------------------------------------------------------------------
// A.3 — templates CRUD
// ---------------------------------------------------------------------------

fn map_template(row: &Row<'_>) -> rusqlite::Result<Template> {
    Ok(Template {
        id: row.get(0)?,
        name: row.get(1)?,
        kind: row.get(2)?,
        body: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

#[tauri::command]
pub fn list_templates(state: State<'_, AppState>) -> Result<Vec<Template>> {
    state.db.with(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, kind, body, created_at, updated_at
             FROM templates ORDER BY updated_at DESC",
        )?;
        let items = stmt
            .query_map([], map_template)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(items)
    })
}

#[tauri::command]
pub fn save_template(state: State<'_, AppState>, payload: TemplatePayload) -> Result<Template> {
    let id = new_id();
    let ts = now();
    state.db.with(|conn| {
        conn.execute(
            "INSERT INTO templates (id, name, kind, body, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![id, payload.name, payload.kind, payload.body, ts, ts],
        )?;
        log_activity(conn, "template", "create", Some(&payload.name))?;
        conn.query_row(
            "SELECT id, name, kind, body, created_at, updated_at FROM templates WHERE id = ?1",
            rusqlite::params![id],
            map_template,
        )
        .map_err(AppError::from)
    })
}

#[tauri::command]
pub fn delete_template(state: State<'_, AppState>, id: String) -> Result<()> {
    state.db.with(|conn| {
        conn.execute("DELETE FROM templates WHERE id = ?1", rusqlite::params![id])?;
        log_activity(conn, "template", "delete", None)?;
        Ok(())
    })
}

// ---------------------------------------------------------------------------
// Runtime test (ditambahkan parent) — membuktikan backup/restore + CSV
// benar-benar bekerja end-to-end, bukan sekadar "compile".
// Jalankan: cargo test
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::{derive_key, random_key, Key};

    fn test_state() -> AppState {
        AppState {
            db: crate::db::open_in_memory().expect("in-memory db"),
            vault_key: std::sync::Mutex::new(None),
        }
    }

    /// Seed: isi vault + note + task + income dengan field sensitif terenkripsi.
    fn seed(state: &AppState, key: &Key) {
        state
            .db
            .with(|conn| {
                let ts = now();
                conn.execute(
                    "INSERT INTO vault_items
                       (id,title,username_enc,password_enc,url,notes_enc,tags,folder_id,
                        favorite,icon,created_at,updated_at)
                     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
                    rusqlite::params![
                        "v1",
                        "GitHub",
                        enc_opt(key, &Some("kyan".into()))?,
                        enc_opt(key, &Some("s3cr3t".into()))?,
                        "https://github.com",
                        Option::<String>::None,
                        "[\"dev\"]",
                        Option::<String>::None,
                        1i64,
                        Option::<String>::None,
                        ts,
                        ts,
                    ],
                )?;
                conn.execute(
                    "INSERT INTO notes (id,title,content_enc,tags,folder_id,favorite,created_at,updated_at)
                     VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                    rusqlite::params![
                        "n1", "Idea", enc_opt(key, &Some("rahasia note".into()))?,
                        "[]", Option::<String>::None, 0i64, ts, ts,
                    ],
                )?;
                conn.execute(
                    "INSERT INTO tasks (id,title,description_enc,status,priority,due_date,tags,folder_id,created_at,updated_at)
                     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
                    rusqlite::params![
                        "t1", "Belajar", enc_opt(key, &Some("desc".into()))?,
                        "todo", "high", "2025-12-31", "[]", Option::<String>::None, ts, ts,
                    ],
                )?;
                conn.execute(
                    "INSERT INTO income (id,source,amount,currency,category,date,notes_enc,created_at,updated_at)
                     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
                    rusqlite::params![
                        "i1", "Freelance", 1500.0f64, "USD", "work", "2025-11-01",
                        enc_opt(key, &Some("bonus".into()))?, ts, ts,
                    ],
                )?;
                Ok(())
            })
            .unwrap();
    }

    #[test]
    fn backup_roundtrip_and_wrong_password() {
        let state = test_state();
        let dek_key = random_key();
        *state.vault_key.lock().unwrap() = Some(dek_key.clone());
        seed(&state, &dek_key);

        let path = std::env::temp_dir().join("qvault_test_backup.qvlt");
        let path = path.to_string_lossy().to_string();

        // Export → file terenkripsi.
        export_backup_impl(&state, path.clone(), "backup-pw".into()).unwrap();
        let raw = std::fs::read_to_string(&path).unwrap();
        assert!(raw.starts_with("QVLTBK1:"));
        assert!(!raw.contains("s3cr3t"), "plaintext bocor ke file backup!");

        // Wipe data → restore → data kembali.
        state
            .db
            .with(|conn| {
                conn.execute_batch("DELETE FROM vault_items; DELETE FROM notes;")?;
                Ok(())
            })
            .unwrap();

        // Password salah → harus gagal (AEAD) dan TIDAK merusak data.
        assert!(import_backup_impl(&state, path.clone(), "WRONG".into()).is_err());

        // Password benar → data kembali.
        import_backup_impl(&state, path.clone(), "backup-pw".into()).unwrap();
        let (n_items, pw_plain) = state
            .db
            .with(|conn| {
                let n: i64 =
                    conn.query_row("SELECT COUNT(*) FROM vault_items", [], |r| r.get(0))?;
                let blob: Option<String> = conn.query_row(
                    "SELECT password_enc FROM vault_items WHERE id='v1'",
                    [],
                    |r| r.get(0),
                )?;
                Ok((n, dec_str(&dek_key, &blob)))
            })
            .unwrap();
        assert_eq!(n_items, 1);
        assert_eq!(pw_plain, "s3cr3t");

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn csv_roundtrip_vault() {
        let state = test_state();
        let dek_key = random_key();
        *state.vault_key.lock().unwrap() = Some(dek_key.clone());
        seed(&state, &dek_key);

        let path = std::env::temp_dir().join("qvault_test_vault.csv");
        let path = path.to_string_lossy().to_string();

        // Export CSV → plaintext (username/password terlihat).
        export_csv_impl(&state, "vault".into(), path.clone()).unwrap();
        let csv_text = std::fs::read_to_string(&path).unwrap();
        assert!(csv_text.contains("s3cr3t"), "CSV harus plaintext");
        assert!(csv_text.starts_with("id,title,username,password"));

        // Wipe, lalu import balik.
        state
            .db
            .with(|conn| {
                conn.execute("DELETE FROM vault_items", [])?;
                Ok(())
            })
            .unwrap();
        let res = import_csv_impl(&state, "vault".into(), path.clone()).unwrap();
        assert_eq!(res.imported, 1);
        assert_eq!(res.skipped, 0);

        // Terenkripsi ulang dengan DEK → dekripsi cocok.
        let back = state
            .db
            .with(|conn| {
                let blob: Option<String> = conn.query_row(
                    "SELECT password_enc FROM vault_items WHERE id='v1'",
                    [],
                    |r| r.get(0),
                )?;
                Ok(dec_str(&dek_key, &blob))
            })
            .unwrap();
        assert_eq!(back, "s3cr3t");

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn templates_crud() {
        let state = test_state();
        let ts = now();
        state
            .db
            .with(|conn| {
                conn.execute(
                    "INSERT INTO templates (id,name,kind,body,created_at,updated_at)
                     VALUES (?1,?2,?3,?4,?5,?6)",
                    rusqlite::params!["tp1", "Weekly", "note", "{\"x\":1}", ts, ts],
                )?;
                Ok(())
            })
            .unwrap();
        let n: i64 = state
            .db
            .with(|conn| {
                let n: i64 = conn.query_row("SELECT COUNT(*) FROM templates", [], |r| r.get(0))?;
                Ok(n)
            })
            .unwrap();
        assert_eq!(n, 1);

        // Sanity: derive_key deterministik untuk salt yang sama.
        let salt = new_salt();
        assert_eq!(derive_key("x", &salt).unwrap(), derive_key("x", &salt).unwrap());
    }
}
