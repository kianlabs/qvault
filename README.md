# QVAULT — Local-First Password Vault & Life OS

[![CI](https://github.com/kianlabs/qvault/actions/workflows/ci.yml/badge.svg)](https://github.com/kianlabs/qvault/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-8b6cff.svg)](./LICENSE)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB.svg)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-stable-dea584.svg)](https://www.rust-lang.org)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)

> **Q = Ky.** A private, offline desktop app that keeps passwords, notes, tasks,
> calendar, and income records in one encrypted local workspace.

Built with **Tauri 2 + Rust + React 19 + TypeScript + SQLite**. Encryption at rest
uses **Argon2id** (key derivation) + **AES-256-GCM** (authenticated encryption).
No cloud, no telemetry — your data never leaves the device.

## Features

**Core modules**

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

**Wave 3**

- **Air-gapped Encrypted Backup & Restore** — export and import a zero-knowledge, 100% offline encrypted archive (`.qvault` or `.json`) of your entire vault.
  - **Zero-Knowledge Mechanism**: Encrypted locally with authenticated **AES-256-GCM** using a dedicated key derived from the user's backup password via **Argon2id** (with a fresh 16-byte cryptographic salt). Master passwords and authentication verifiers are never written to the backup archive.
  - **Zero Cloud Reliance**: Operates entirely air-gapped without contacting any remote server, third-party cloud, or external API. Ideal for offline cold storage, hardware security keys, or encrypted USB drives.
  - **Integrity & Tamper Detection**: Embeds an ISO-8601/RFC 3339 UTC timestamp and cryptographic **SHA-256** integrity checksums (verifying both ciphertext archive integrity and decrypted payload table structures) in addition to AEAD authentication tags.
  - **Atomic Restoration**: Guarantees all-or-nothing database restore in a single ACID transaction with automatic rollback on checksum mismatch, authentication failure, or corrupted records.
- **CSV import/export** — move credentials in and out as CSV.
- **Templates** — reusable item templates for fast entry.
- **World clock** — multi-timezone clock in the top bar.
- **Markdown preview** — live-rendered markdown for notes.

**Wave 4**

- **Password health** — a 0–100 health score with weak / reused / stale /
  missing-password / no-2FA breakdowns and one-click jump to fix.
- **Command palette** — `Ctrl/Cmd + K` to search and jump across every module.
- **2FA (TOTP)** — RFC 6238 one-time codes stored encrypted, with live countdown.
- **Backup** — encrypted DB snapshots (`VACUUM INTO`), on demand plus once every 24 hours while the app is running; keeps the last 5.

## Tech stack

| Layer            | Technology                                              |
| ---------------- | ------------------------------------------------------- |
| Desktop shell    | Tauri 2                                                 |
| Backend          | Rust (stable), `rusqlite`, `argon2`, `aes-gcm`, `sha2`, `hmac` |
| Frontend         | React 19, TypeScript, React Router, Zustand             |
| Styling          | Tailwind CSS 4                                          |
| Motion           | Web Animations API + View Transitions API (native)      |
| Icons / charts   | lucide-react, hand-rolled CSS/Tailwind charts           |
| Storage          | SQLite (local file)                                     |
| Build / tooling  | Vite, Bun, Cargo                                        |

## Security model

```
master password ──Argon2id(m=19456, t=2, p=1, salt=16B)──▶ 32-byte master key
random 32-byte DEK ──AES-256-GCM──▶ wrapped by master key (stored)
sensitive fields  ──AES-256-GCM──▶ "nonce_b64:ct_b64" (stored)
backup password ──Argon2id(m=19456, t=2, p=1, salt=16B)──▶ 32-byte backup key ──AES-256-GCM──▶ air-gapped .qvault archive
```

- **KDF** — Argon2id with `m=19456` (19 MiB), `t=2`, `p=1`, 16-byte random salt.
- **Encryption** — AES-256-GCM (authenticated) for every sensitive field and air-gapped archive.
- **Key wrapping** — a random 32-byte data-encryption key (DEK) is wrapped by the
  master key and stored as a verifier + wrapped DEK; the master password is never
  stored.
- **Air-gapped backup** — zero-knowledge archive export/import with SHA-256 integrity checksum and timestamp; independent backup password; no cloud dependency.
- **In-memory only** — the DEK lives only while the vault is unlocked; locking
  clears it.
- **Clipboard safety** — copied secrets are auto-cleared after a configurable delay.
- **Offline** — no network calls, no telemetry; the SQLite file never leaves the device.

## Requirements

- Rust (stable) + Cargo
- Node 20+ and Bun (or npm)
- Linux: `webkit2gtk-4.1`, `gtk3`, `libsoup-3.0` (dev packages)
- Tauri CLI v2 (`@tauri-apps/cli` is a dev dependency; use `bun run tauri`)

## Build & run

```bash
# 1. install JS dependencies
bun install

# 2. run the desktop app in dev (Vite + Rust, hot reload)
bun run tauri dev

# 3. production bundle → src-tauri/target/release/bundle
bun run tauri build
```

Frontend-only build (no Rust): `bun run build`.

## Tests

```bash
# backend unit tests (crypto round-trip, etc.)
cd src-tauri && cargo test

# frontend typecheck
bunx tsc --noEmit
```

CI (GitHub Actions) runs the typecheck + build for the frontend and
`cargo check` + `cargo test` for the backend on every push and pull request to
`main`.

## Project layout

```
src-tauri/                 # Rust backend
  src/
    crypto/                # Argon2id KDF + AES-256-GCM cipher
    db/                    # SQLite open + schema
    commands/              # Tauri commands (security, vault, notes, ...)
    models.rs  state.rs  error.rs
  icons/                   # app icons (source.svg + generated sets)
src/                       # React frontend
  lib/       (types, api, utils, markdown, favicon, motion, accents)
  store/     (zustand stores)
  components/(Sidebar, Topbar, Modal, Toast, ...)
  features/  (dashboard, vault, notes, tasks, calendar, income, folders,
              favorites, generator, health, activity, settings, auth)
tools/                     # headless test harness (Playwright + WebKitGTK)
  qvmock.py           # mock Tauri IPC so the UI runs without the Rust backend
  harness.py          # scroll-jank + View Transition benchmark
  webkit_vt_test.py   # verify View Transitions on the real Tauri webview engine
  check_anims.py      # count lingering animations after idle (must be 0)
  capture_vt.py       # capture circular-reveal frames
SPEC.md / FINAL-CONTRACT.md / WAVE3-CONTRACT.md / WAVE4-CONTRACT.md
QVAULT-MOTION-CONTRACT.md / KEEPR-PARITY-CONTRACT.md
                           # frozen interface contracts used to build this
```

## License

[MIT](./LICENSE) © 2025 Ridzkyan Buti Pratama (Kyan).

## Author

**Kyan** (Ridzkyan). *The **Q** stands for **Ky**.*
