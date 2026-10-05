-- QVAULT — schema SQLite (A2). SPEC §3 (frozen).
-- ID = TEXT (uuid v4). Timestamp = TEXT (RFC3339 UTC). Boolean = INTEGER 0/1.
-- Kolom *_enc menyimpan "{nonce_b64}:ct_b64" (AES-256-GCM dengan DEK).

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS folders (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    color      TEXT,
    kind       TEXT NOT NULL DEFAULT 'password', -- 'password' | 'note' | 'both'
    parent_id  TEXT,
    favorite   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vault_items (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    username_enc TEXT,
    password_enc TEXT,
    url          TEXT,
    notes_enc    TEXT,
    tags         TEXT,
    folder_id    TEXT,
    favorite     INTEGER NOT NULL DEFAULT 0,
    icon         TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    totp_enc     TEXT -- Wave 4: secret TOTP terenkripsi (DEK), NULL bila 2FA mati
);

CREATE TABLE IF NOT EXISTS notes (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    content_enc TEXT,
    tags        TEXT,
    folder_id   TEXT,
    favorite    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    description_enc TEXT,
    status          TEXT NOT NULL DEFAULT 'todo', -- 'todo' | 'in_progress' | 'done'
    priority        TEXT,
    due_date        TEXT,
    tags            TEXT,
    folder_id       TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS income (
    id         TEXT PRIMARY KEY,
    source     TEXT NOT NULL,
    amount     REAL NOT NULL DEFAULT 0,
    currency   TEXT,
    category   TEXT,
    date       TEXT,
    notes_enc  TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_log (
    id         TEXT PRIMARY KEY,
    module     TEXT NOT NULL,
    action     TEXT NOT NULL,
    item_name  TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vault_items_folder   ON vault_items(folder_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_favorite ON vault_items(favorite);
CREATE INDEX IF NOT EXISTS idx_notes_folder         ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_favorite       ON notes(favorite);
CREATE INDEX IF NOT EXISTS idx_tasks_status         ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_folder         ON tasks(folder_id);
CREATE INDEX IF NOT EXISTS idx_income_date          ON income(date);
CREATE INDEX IF NOT EXISTS idx_folders_kind         ON folders(kind);
CREATE INDEX IF NOT EXISTS idx_activity_created     ON activity_log(created_at);

-- Wave 3 (kontrak A.1): template catatan/tugas. `body` = JSON payload (string).
CREATE TABLE IF NOT EXISTS templates (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    kind       TEXT NOT NULL, -- 'note' | 'task'
    body       TEXT NOT NULL, -- JSON payload
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_templates_kind ON templates(kind);

-- Wave 6: riwayat password per item vault. Menyimpan blob password LAMA
-- ("nonce_b64:ct_b64") setiap kali password diganti, agar bisa dikembalikan.
CREATE TABLE IF NOT EXISTS password_history (
    id           TEXT PRIMARY KEY,
    item_id      TEXT NOT NULL,
    password_enc TEXT NOT NULL,
    created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_history_item ON password_history(item_id);
