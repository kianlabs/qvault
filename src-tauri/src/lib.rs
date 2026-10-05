// QVAULT — Local-First Password Vault & Life OS
// Wired by the parent agent. Modules are implemented per SPEC.md.
mod commands;
mod crypto;
mod db;
mod error;
mod models;
mod scheduler;
mod state;

use state::AppState;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState::new())
        .setup(|app| {
            scheduler::spawn(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // security
            commands::security::vault_status,
            commands::security::init_vault,
            commands::security::unlock_vault,
            commands::security::lock_vault,
            commands::security::change_master_password,
            commands::security::generate_recovery_code,
            commands::security::reset_vault,
            // vault
            commands::vault::list_vault_items,
            commands::vault::create_vault_item,
            commands::vault::update_vault_item,
            commands::vault::delete_vault_item,
            commands::vault::toggle_vault_favorite,
            commands::vault::reveal_vault_password,
            // vault — Wave 6 (riwayat password)
            commands::vault::list_password_history,
            commands::vault::restore_password_history,
            // notes
            commands::notes::list_notes,
            commands::notes::create_note,
            commands::notes::update_note,
            commands::notes::delete_note,
            commands::notes::duplicate_note,
            commands::notes::toggle_note_favorite,
            // tasks
            commands::tasks::list_tasks,
            commands::tasks::create_task,
            commands::tasks::update_task,
            commands::tasks::delete_task,
            commands::tasks::set_task_status,
            commands::tasks::dashboard_stats,
            // income
            commands::income::list_income,
            commands::income::create_income,
            commands::income::update_income,
            commands::income::delete_income,
            commands::income::income_summary,
            // folders
            commands::folders::list_folders,
            commands::folders::create_folder,
            commands::folders::update_folder,
            commands::folders::delete_folder,
            commands::folders::toggle_folder_favorite,
            // activity
            commands::activity::list_activity,
            commands::activity::clear_activity,
            // settings
            commands::settings::get_settings,
            commands::settings::update_settings,
            // data
            commands::data::export_backup,
            commands::data::import_backup,
            commands::data::export_csv,
            commands::data::import_csv,
            commands::data::list_templates,
            commands::data::save_template,
            commands::data::delete_template,
            // totp (wave 4)
            commands::totp::set_totp_secret,
            commands::totp::clear_totp_secret,
            commands::totp::totp_status,
            commands::totp::get_totp_code,
            // data (wave 4)
            commands::data::auto_backup_now,
            commands::data::list_auto_backups,
            commands::data::import_browser_csv,
        ])
        .run(tauri::generate_context!())
        .expect("error while running QVAULT");
}
