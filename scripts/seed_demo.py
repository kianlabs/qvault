#!/usr/bin/env python3
"""QVAULT — dev seeder untuk vault UJI (bukan data asli pengguna).

Membuat DB terpisah yang siap dipakai `QVAULT_DB_PATH=<path>` supaya kita bisa
melihat semua layar dengan data realistis tanpa menyentuh ~/.local/share/qvault.

Format yang harus cocok dengan src-tauri:
  master key = Argon2id(pw, salt, m=19456, t=2, p=1, out=32)
  blob       = base64(nonce12) + ":" + base64(ciphertext||tag16)   (AES-256-GCM)
  settings   = pwd_salt(b64), pwd_verifier=enc("QVAULT_VERIFY"), dek_wrapped=enc(dek)
"""
import base64, json, os, sqlite3, sys, uuid
from datetime import datetime, timedelta, timezone
from argon2.low_level import hash_secret_raw, Type
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

M_COST, T_COST, P_COST = 19456, 2, 1
VERIFIER = b"QVAULT_VERIFY"


def b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def derive_key(pw: str, salt: bytes) -> bytes:
    return hash_secret_raw(pw.encode(), salt, time_cost=T_COST, memory_cost=M_COST,
                           parallelism=P_COST, hash_len=32, type=Type.ID)


def enc(key: bytes, pt: bytes) -> str:
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, pt, None)
    return f"{b64(nonce)}:{b64(ct)}"


def enc_opt(key: bytes, s):
    if not s:
        return None
    return enc(key, s.encode())


def now(days_ago=0, hours_ago=0) -> str:
    t = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=hours_ago)
    return t.isoformat().replace("+00:00", "Z")


def uid() -> str:
    return str(uuid.uuid4())


def main(path: str, password: str):
    if os.path.exists(path):
        os.remove(path)
    conn = sqlite3.connect(path)
    schema = open(os.path.join(os.path.dirname(__file__), "..", "src-tauri",
                               "src", "db", "schema.sql")).read()
    conn.executescript(schema)

    # --- init vault ---
    salt = os.urandom(16)
    master = derive_key(password, salt)
    dek = os.urandom(32)
    conn.executemany("INSERT INTO settings (key,value) VALUES (?,?)", [
        ("pwd_salt", b64(salt)),
        ("pwd_verifier", enc(master, VERIFIER)),
        ("dek_wrapped", enc(master, dek)),
        ("display_name", "Kyan"),
        ("theme", "dark"),
        ("accent", "#7c5cff"),
        ("font_size", "16"),
        ("auto_lock_min", "15"),
        ("clipboard_clear_sec", "30"),
        ("show_icons", "1"),
    ])

    # --- folders ---
    folders = [
        ("Personal", "#7c5cff", "password"),
        ("Work", "#22d3ee", "password"),
        ("Finance", "#34d399", "both"),
        ("Development", "#f472b6", "password"),
        ("Reading", "#f59e0b", "note"),
    ]
    fid = {}
    for name, color, kind in folders:
        i = uid()
        fid[name] = i
        conn.execute("INSERT INTO folders (id,name,color,kind,parent_id,favorite,created_at,updated_at)"
                     " VALUES (?,?,?,?,?,?,?,?)",
                     (i, name, color, kind, None, 1 if name in ("Personal", "Work") else 0,
                      now(40), now(3)))

    # --- vault items ---
    items = [
        ("GitHub", "kyan@dev.io", "Tr0ub4dor&3xK!", "https://github.com", "Personal",
         ["dev", "git"], 1, "Main developer account with 2FA enabled."),
        ("Google", "ridzkyan.buti@gmail.com", "c0rrect-horse-battery", "https://google.com", "Personal",
         ["email"], 1, "Primary email and cloud storage."),
        ("AWS Console", "kyan-admin", "Zx9$mVq2Lp7#Rn", "https://aws.amazon.com", "Work",
         ["cloud", "infra"], 1, "Production root account. Use IAM for daily."),
        ("Stripe", "acct_kyanlabs", "Bv7!kQ2wZs9@Yt", "https://dashboard.stripe.com", "Finance",
         ["payment"], 1, "Payments dashboard."),
        ("Figma", "kyan@design.io", "Design123", "https://figma.com", "Work",
         ["design"], 0, "UI mockups for QVAULT."),
        ("DigitalOcean", "kyan", "do-password-2024", "https://cloud.digitalocean.com", "Work",
         ["cloud"], 0, "Droplets for side projects."),
        ("Bank BCA", "1234567890", "mybirthday2001", "https://ibank.klikbca.com", "Finance",
         ["bank"], 0, "Personal savings account."),
        ("Netflix", "kyan.family", "netflix2024", "https://netflix.com", "Personal",
         ["media"], 0, ""),
        ("Vercel", "kianlabs", "vcl_9mK2pQ7x", "https://vercel.com", "Development",
         ["deploy"], 0, "Frontend deployments."),
        ("Cloudflare", "kyan@dev.io", "cf-Str0ng-Pass!", "https://dash.cloudflare.com", "Development",
         ["dns"], 0, "DNS for kianlabs domains."),
        ("LinkedIn", "ridzkyan", "linkedin-pass", "https://linkedin.com", "Personal",
         ["social"], 0, ""),
        ("Notion", "kyan@dev.io", "notion-notes-1", "https://notion.so", "Work",
         ["docs"], 0, "Team wiki and notes."),
        ("Proxmox", "root@pam", "pve-Str0ng-2024", "https://proxmox.local:8006", "Development",
         ["homelab"], 0, "Home lab hypervisor."),
        ("X (Twitter)", "ridzkyan", "twitter-pass-99", "https://x.com", "Personal",
         ["social"], 0, ""),
        ("PostgreSQL Prod", "qvault_app", "pg_Pr0d_P@ss!", "https://db.kianlabs.io", "Development",
         ["database"], 0, "Production database credentials."),
        ("Spotify", "ridzkyan", "spotify123", "https://spotify.com", "Personal",
         ["media"], 0, ""),
        ("Namecheap", "kianlabs", "nc-D0main-2024", "https://namecheap.com", "Development",
         ["domain"], 0, "Domain registrar."),
        ("1Password (legacy)", "kyan", "old-vault-pass", "https://1password.com", "Work",
         ["legacy"], 0, "Migrated to QVAULT."),
    ]
    for title, user, pw, url, folder, tags, fav, notes in items:
        conn.execute(
            "INSERT INTO vault_items (id,title,username_enc,password_enc,url,notes_enc,tags,"
            "folder_id,favorite,icon,created_at,updated_at,totp_enc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (uid(), title, enc_opt(dek, user), enc_opt(dek, pw), url, enc_opt(dek, notes),
             json.dumps(tags), fid.get(folder), fav, None,
             now(35), now(2 if fav else 30), None))

    # --- notes ---
    notes = [
        ("QVAULT roadmap", "## QVAULT roadmap\n\n- [x] Wave 1-3 core\n- [x] Wave 4 security\n"
         "- [ ] **Wave 5** UI polish\n- [ ] Sync (optional)\n\n> Local-first forever.", "Work", 1),
        ("Server setup", "# Homelab\n\nProxmox node `pve-01`:\n\n```bash\nssh root@10.0.0.10\n"
         "pct list\n```\n\nUptime target: **99%**.", "Development", 1),
        ("Design tokens", "# Colors\n\n- accent `#7c5cff`\n- surface `#0e1015`\n"
         "- ink `#e8eaf0`\n\nUse *consistent* spacing.", "Work", 0),
        ("Reading list", "1. Refactoring UI\n2. The Design of Everyday Things\n"
         "3. Don't Make Me Think\n4. Atomic Habits", "Reading", 1),
        ("Meeting notes", "**2024-10-01 — Client call**\n\n- Scope: landing page\n"
         "- Deadline: 2 weeks\n- Budget approved ✅", "Work", 0),
        ("Passwords policy", "Rules:\n\n1. Min 16 chars\n2. Unique per site\n3. 2FA where possible\n"
         "4. Rotate quarterly", "Personal", 0),
    ]
    for title, content, folder, fav in notes:
        conn.execute("INSERT INTO notes (id,title,content_enc,tags,folder_id,favorite,created_at,updated_at)"
                     " VALUES (?,?,?,?,?,?,?,?)",
                     (uid(), title, enc_opt(dek, content), json.dumps(["note"]),
                      fid.get(folder), fav, now(20), now(1 if fav else 10)))

    # --- tasks ---
    tasks = [
        ("Ship QVAULT Wave 5", "Polish UI and close final gaps.", "in_progress", "high", 2, 0),
        ("Review PR #42", "Password health improvements.", "todo", "medium", 1, 0),
        ("Pay hosting invoice", "DigitalOcean monthly.", "todo", "high", -1, 0),
        ("Rotate API keys", "Quarterly security task.", "todo", "high", 5, 0),
        ("Write blog post", "About local-first design.", "todo", "low", 14, 0),
        ("Fix login bug", "Reported by user.", "done", "high", -5, 0),
        ("Design system audit", "Check spacing + colors.", "in_progress", "medium", 3, 0),
        ("Backup test", "Verify restore flow.", "done", "medium", -3, 0),
        ("Update dependencies", "Run cargo update + bun update.", "todo", "low", 7, 0),
        ("Team standup", "Weekly sync.", "todo", "medium", 0, 0),
    ]
    for title, desc, status, prio, due_off, _ in tasks:
        due = (datetime.now(timezone.utc) + timedelta(days=due_off)).isoformat().replace("+00:00", "Z") if due_off is not None else None
        conn.execute("INSERT INTO tasks (id,title,description_enc,status,priority,due_date,tags,"
                     "folder_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                     (uid(), title, enc_opt(dek, desc), status, prio, due,
                      json.dumps(["task"]), None, now(15), now(1)))

    # --- income ---
    income = [
        ("Freelance — Landing page", 1500.0, "USD", "Freelance", 0),
        ("QVAULT consulting", 800.0, "USD", "Consulting", 3),
        ("App maintenance", 450.0, "USD", "Retainer", 10),
        ("Freelance — API integration", 2200.0, "USD", "Freelance", 25),
        ("Design workshop", 600.0, "USD", "Training", 40),
        ("Domain resale", 120.0, "USD", "Other", 55),
        ("Freelance — Dashboard", 1800.0, "USD", "Freelance", 70),
        ("Bug bounty", 300.0, "USD", "Security", 90),
    ]
    for src, amt, cur, cat, days_ago in income:
        conn.execute("INSERT INTO income (id,source,amount,currency,category,date,notes_enc,"
                     "created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                     (uid(), src, amt, cur, cat, now(days_ago), enc_opt(dek, "Invoice paid."),
                      now(days_ago), now(days_ago)))

    # --- activity ---
    acts = [
        ("security", "init", None), ("vault", "create", "GitHub"),
        ("vault", "create", "AWS Console"), ("notes", "create", "QVAULT roadmap"),
        ("tasks", "create", "Ship QVAULT Wave 5"), ("income", "create", "Freelance — Landing page"),
        ("folders", "create", "Work"), ("vault", "update", "GitHub"),
        ("security", "unlock", None), ("data", "backup", None),
    ]
    for module, action, name in acts:
        conn.execute("INSERT INTO activity_log (id,module,action,item_name,created_at)"
                     " VALUES (?,?,?,?,?)", (uid(), module, action, name, now(0, hours_ago=len(acts) * 2)))

    conn.commit()
    conn.close()
    print(f"seeded {path}: {len(items)} items, {len(notes)} notes, {len(tasks)} tasks, "
          f"{len(income)} income, {len(folders)} folders")
    print(f"master password: {password}")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "/tmp/qvault-demo/qvault.db"
    pw = sys.argv[2] if len(sys.argv) > 2 else "demo-password"
    os.makedirs(os.path.dirname(target), exist_ok=True)
    main(target, pw)
