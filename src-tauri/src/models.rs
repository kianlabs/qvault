// QVAULT — semua struct serde (A2). SPEC §3 (frozen).
//
// Aturan:
//   * Semua struct: #[derive(Serialize, Deserialize)] + #[serde(rename_all = "camelCase")].
//   * Boolean di DB = i64 0/1; di serde = bool (dikonversi di layer command).
//   * Read model menyertakan id, createdAt, updatedAt + field sensitif yang sudah didekripsi.
//   * Timestamp = String RFC3339 UTC. ID = String (uuid v4).

use serde::{Deserialize, Serialize};

// ===========================================================================
// Read models (dikembalikan ke frontend; field sensitif sudah didekripsi)
// ===========================================================================

/// Item vault (password manager) yang sudah didekripsi.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultItem {
    pub id: String,
    pub title: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
    pub folder_id: Option<String>,
    pub favorite: bool,
    pub icon: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    /// Wave 4: true bila item punya secret TOTP (2FA aktif). serde → `hasTotp`.
    pub has_totp: bool,
}

/// Catatan (note) yang sudah didekripsi.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: Option<String>,
    pub tags: Vec<String>,
    pub folder_id: Option<String>,
    pub favorite: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Tugas (task) yang sudah didekripsi.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String, // 'todo' | 'in_progress' | 'done'
    pub priority: String,
    pub due_date: Option<String>,
    pub tags: Vec<String>,
    pub folder_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Catatan pemasukan (income) yang sudah didekripsi.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Income {
    pub id: String,
    pub source: String,
    pub amount: f64,
    pub currency: String,
    pub category: String,
    pub date: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Folder (dipakai untuk password, note, atau keduanya).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub kind: String, // 'password' | 'note' | 'both'
    pub parent_id: Option<String>,
    pub favorite: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Entri log aktivitas.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEntry {
    pub id: String,
    pub module: String,
    pub action: String,
    pub item_name: Option<String>,
    pub created_at: String,
}

/// Wave 6: satu entri riwayat password LAMA untuk sebuah item vault.
/// `password` sudah didekripsi di layer command (kontrak A.4: "" bila gagal).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordHistoryEntry {
    pub id: String,
    pub item_id: String,
    pub password: Option<String>,
    pub created_at: String,
}

/// Wave 6: entri riwayat baru hasil operasi "restore" (dikembalikan ke frontend
/// agar store bisa memperbarui state tanpa memuat ulang seluruh riwayat).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewPasswordHistoryEntry {
    /// ID riwayat LAMA yang dipulihkan (dihapus setelah dipakai).
    pub restored_id: String,
    /// Entri riwayat BARU yang berisi password yang barusan digantikan.
    pub entry: PasswordHistoryEntry,
}

// ===========================================================================
// Payload models (input dari frontend untuk create/update)
// ===========================================================================

/// Payload buat/ubah item vault.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultItemPayload {
    pub title: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub url: Option<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub folder_id: Option<String>,
    #[serde(default)]
    pub favorite: bool,
    pub icon: Option<String>,
    /// Wave 4: secret TOTP (base32) tri-state:
    /// - `None` = field absen (jangan sentuh saat update),
    /// - `Some(None)` = hapus eksplisit,
    /// - `Some(Some(s))` = set secret baru.
    #[serde(
        default,
        deserialize_with = "double_option",
        skip_serializing_if = "Option::is_none"
    )]
    pub totp: Option<Option<String>>,
}

/// Helper serde: field absen → `None`, `null` → `Some(None)`, value → `Some(Some(T))`.
pub fn double_option<'de, T, D>(de: D) -> std::result::Result<Option<Option<T>>, D::Error>
where
    T: serde::Deserialize<'de>,
    D: serde::Deserializer<'de>,
{
    serde::Deserialize::deserialize(de).map(Some)
}

/// Payload buat/ubah catatan.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotePayload {
    pub title: String,
    pub content: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub folder_id: Option<String>,
    #[serde(default)]
    pub favorite: bool,
}

/// Payload buat/ubah tugas.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPayload {
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub due_date: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub folder_id: Option<String>,
}

/// Payload buat/ubah pemasukan.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomePayload {
    pub source: String,
    pub amount: f64,
    pub currency: String,
    pub category: String,
    pub date: String,
    pub notes: Option<String>,
}

/// Payload buat/ubah folder.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderPayload {
    pub name: String,
    pub color: Option<String>,
    pub kind: String,
    pub parent_id: Option<String>,
    #[serde(default)]
    pub favorite: bool,
}

/// Payload update settings (dari halaman Settings).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPayload {
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub theme: Option<String>,
    pub accent: Option<String>,
    pub font_size: Option<i64>,
    pub auto_lock_min: Option<i64>,
    pub clipboard_clear_sec: Option<i64>,
    /// Wave 5 — toggle ikon situs.
    pub show_icons: Option<bool>,
    /// Scheduler backup otomatis (tiap 24 jam selama app berjalan).
    pub auto_backup_enabled: Option<bool>,
}

// ===========================================================================
// Response models (bentuk kembalian command §4)
// ===========================================================================

/// Status vault untuk `vault_status`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub initialized: bool,
    pub locked: bool,
    /// `Some(pesan)` bila backend berjalan dengan DB in-memory sementara.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub degraded: Option<String>,
}

/// Settings yang dikembalikan `get_settings`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub display_name: String,
    pub avatar: Option<String>,
    pub theme: String,
    pub accent: String,
    pub font_size: i64,
    pub auto_lock_min: i64,
    pub clipboard_clear_sec: i64,
    /// Wave 5 — tampilkan ikon situs (favicon) di daftar vault.
    pub show_icons: bool,
    /// Scheduler backup otomatis (tiap 24 jam selama app berjalan).
    pub auto_backup_enabled: bool,
}

/// Statistik dashboard (`dashboard_stats`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub total_items: i64,
    pub total_notes: i64,
    pub tasks_overdue: i64,
    pub tasks_today: i64,
    pub tasks_done: i64,
    pub income_this_month: f64,
    pub recent_activity: Vec<ActivityEntry>,
    pub upcoming_tasks: Vec<Task>,
}

/// Ringkasan pemasukan (`income_summary`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomeSummary {
    pub this_month: f64,
    pub all_time: f64,
    pub by_month: Vec<IncomeMonthTotal>,
}

/// Total pemasukan per bulan (bagian dari `income_summary`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomeMonthTotal {
    pub month: String,
    pub total: f64,
}

// ===========================================================================
// Wave 3 (kontrak A.2) — template + hasil import CSV
// ===========================================================================

/// Template catatan/tugas (`kind` = 'note' | 'task', `body` = JSON string).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Template {
    pub id: String,
    pub name: String,
    pub kind: String, // 'note' | 'task'
    pub body: String, // JSON string
    pub created_at: String,
    pub updated_at: String,
}

/// Payload buat template (input dari frontend).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplatePayload {
    pub name: String,
    pub kind: String,
    pub body: String,
}

/// Hasil `import_csv`: jumlah baris diimpor + dilewati.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: i64,
    pub skipped: i64,
}

// ===========================================================================
// Wave 4 (kontrak E.2) — TOTP 2FA
// ===========================================================================

/// Kode TOTP yang dihitung saat ini (RFC 6238).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TotpCode {
    pub code: String,
    pub seconds_remaining: i64,
    pub period: i64,
}

/// Status 2FA sebuah item vault.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TotpStatus {
    pub has_secret: bool,
}
