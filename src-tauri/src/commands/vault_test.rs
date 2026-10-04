// Test tri-state TOTP: absen → preserve, null → clear, string → set.
#![cfg(test)]

use super::*;
use crate::commands::tests_support::test_state;
use crate::crypto::{random_key, Key};
use crate::models::VaultItemPayload;
use serde_json::json;

fn seed_item_with_totp(state: &AppState, key: &Key, id: &str, totp_secret: &str) -> Result<()> {
    let totp_blob = enc_opt(key, &Some(totp_secret.to_string()))?;
    state.db.with(|conn| {
        ensure_column(conn, "vault_items", "totp_enc", "TEXT")?;
        conn.execute(
            "INSERT INTO vault_items
                (id, title, username_enc, password_enc, url, notes_enc, tags, folder_id, favorite, icon, created_at, updated_at, totp_enc)
             VALUES (?1, ?2, NULL, NULL, NULL, NULL, '[]', NULL, 0, NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ?3)",
            rusqlite::params![id, "Item dengan TOTP", totp_blob],
        )?;
        Ok(())
    })
}

#[test]
fn update_without_totp_preserves_secret() {
    let state = test_state();
    let dek_key = random_key();
    *state.vault_key.lock().unwrap() = Some(dek_key.clone());

    let item_id = "c1";
    seed_item_with_totp(&state, &dek_key, item_id, "GEZDGNBVGY3TQOJQ").unwrap();

    // Payload tanpa field `totp` (deserialize dari JSON tanpa key tersebut).
    let payload: VaultItemPayload = serde_json::from_value(json!({
        "title": "Judul Baru",
        "username": null,
        "password": null,
        "url": null,
        "notes": null,
        "tags": [],
        "folderId": null,
        "favorite": false,
        "icon": null
    }))
    .unwrap();

    let result = update_vault_item_impl(&state, item_id, payload).unwrap();
    assert_eq!(result.title, "Judul Baru");
    assert!(result.has_totp, "TOTP secret harus dipertahankan");
}

#[test]
fn update_with_null_totp_clears_secret() {
    let state = test_state();
    let dek_key = random_key();
    *state.vault_key.lock().unwrap() = Some(dek_key.clone());

    let item_id = "c2";
    seed_item_with_totp(&state, &dek_key, item_id, "GEZDGNBVGY3TQOJQ").unwrap();

    // Payload dengan `totp: null` eksplisit.
    let payload: VaultItemPayload = serde_json::from_value(json!({
        "title": "Item Tanpa 2FA",
        "username": null,
        "password": null,
        "url": null,
        "notes": null,
        "tags": [],
        "folderId": null,
        "favorite": false,
        "icon": null,
        "totp": null
    }))
    .unwrap();

    let result = update_vault_item_impl(&state, item_id, payload).unwrap();
    assert!(!result.has_totp, "TOTP secret harus dihapus");
}

#[test]
fn update_with_totp_sets_secret() {
    let state = test_state();
    let dek_key = random_key();
    *state.vault_key.lock().unwrap() = Some(dek_key.clone());

    let item_id = "c3";
    seed_item_with_totp(&state, &dek_key, item_id, "OLDTOTP").unwrap();

    // Payload dengan secret baru.
    let payload: VaultItemPayload = serde_json::from_value(json!({
        "title": "Item 2FA Baru",
        "username": null,
        "password": null,
        "url": null,
        "notes": null,
        "tags": [],
        "folderId": null,
        "favorite": false,
        "icon": null,
        "totp": "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    }))
    .unwrap();

    let result = update_vault_item_impl(&state, item_id, payload).unwrap();
    assert!(result.has_totp, "TOTP secret baru harus tersimpan");
}

#[test]
fn deserialize_tri_state() {
    // Field absen → None
    let p1: VaultItemPayload = serde_json::from_value(json!({
        "title": "A",
        "username": null,
        "password": null,
        "url": null,
        "notes": null,
        "tags": [],
        "folderId": null,
        "favorite": false,
        "icon": null
    }))
    .unwrap();
    assert_eq!(p1.totp, None, "Field absen → None");

    // `totp: null` → Some(None)
    let p2: VaultItemPayload = serde_json::from_value(json!({
        "title": "B",
        "username": null,
        "password": null,
        "url": null,
        "notes": null,
        "tags": [],
        "folderId": null,
        "favorite": false,
        "icon": null,
        "totp": null
    }))
    .unwrap();
    assert_eq!(p2.totp, Some(None), "null → Some(None)");

    // `totp: "X"` → Some(Some("X"))
    let p3: VaultItemPayload = serde_json::from_value(json!({
        "title": "C",
        "username": null,
        "password": null,
        "url": null,
        "notes": null,
        "tags": [],
        "folderId": null,
        "favorite": false,
        "icon": null,
        "totp": "GEZDGNBVGY3TQOJQ"
    }))
    .unwrap();
    assert_eq!(
        p3.totp,
        Some(Some("GEZDGNBVGY3TQOJQ".to_string())),
        "string → Some(Some(...))"
    );
}
