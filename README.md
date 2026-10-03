# QVAULT — Local-First Password Vault & Life OS

> **Q = Ky.** A private, offline desktop app that keeps passwords, notes, tasks,
> calendar, and income records in one encrypted local workspace.

Built with **Tauri 2 + Rust + React 19 + TypeScript + SQLite**. Encryption at rest
uses **Argon2id** (key derivation) + **AES-256-GCM** (authenticated encryption).
No cloud, no telemetry — your data never leaves the device.

## Features

- **Vault** — encrypted credential store: username/email, password, website, tags,
  folders, favorites, notes. Grid/list view, copy & reveal.
- **Notes** — markdown-style notepad with write/preview, folders, favorites, search.
- **Tasks** — To Do / In Progress / Done, due dates, priority, tags.
- **Calendar** — week/month/year view of task due dates and income entries.
- **Income** — source, amount, currency, category, date + activity chart.
- **Folders & Favorites** — organize credentials and notes; color folders.
- **Generator** — strong password generator with strength meter.
- **Activity Log** — created / updated / deleted / backup / reset history.
- **Settings** — account, appearance (theme, accent, font size), security
  (auto-lock, recovery code, master password, clipboard safety), data (backup,
  reset), about.

## Security model

```
master password ──Argon2id(m=19456, t=2, p=1, salt=16B)──▶ 32-byte master key
random 32-byte DEK ──AES-256-GCM──▶ wrapped by master key (stored)
sensitive fields  ──AES-256-GCM──▶ "nonce_b64:ct_b64" (stored)
```

The DEK is only held in memory while the vault is unlocked. Locking clears it.

## Requirements

- Rust (stable) + Cargo
- Node 20+ and Bun (or npm)
- Linux: `webkit2gtk-4.1`, `gtk3`, `libsoup-3.0` (dev packages)
- Tauri CLI v2 (`@tauri-apps/cli` is a dev dependency; use `bun run tauri`)

## Development

```bash
bun install
bun run tauri dev      # runs the desktop app (Vite + Rust)
```

## Build

```bash
bun run tauri build    # production bundle in src-tauri/target/release/bundle
```

## Project layout

```
src-tauri/                 # Rust backend
  src/
    crypto/                # Argon2id KDF + AES-256-GCM cipher
    db/                    # SQLite open + schema
    commands/              # 38 Tauri commands (security, vault, notes, ...)
    models.rs  state.rs  error.rs
src/                       # React frontend
  lib/       (types, api, utils)
  store/     (zustand stores)
  components/(Sidebar, Topbar, Modal, Toast, ...)
  features/  (dashboard, vault, notes, tasks, calendar, income, folders,
              favorites, generator, activity, settings, auth)
SPEC.md / FINAL-CONTRACT.md # frozen interface contracts used to build this
```

## Author

**Kyan** (Ridzkyan). *The **Q** stands for **Ky**.*
