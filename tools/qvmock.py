"""Mock __TAURI_INTERNALS__ bersama untuk harness headless QVAULT.

App QVAULT memanggil Tauri `invoke()`; di browser headless kita sediakan
implementasi palsu yang mengembalikan data dashboard sehingga UI bisa
dirender penuh tanpa backend Rust.
"""

APP = "http://127.0.0.1:1420/"

MOCK = r"""
() => {
  const now = new Date().toISOString();
  const vault = Array.from({length: 40}, (_,i)=>({
    id:'id'+i, title:'Item '+i, username:'user'+i, url:'', notes:'',
    folderId:null, favorite:false, tags:[], createdAt:now, updatedAt:now,
  }));
  const tasks = Array.from({length: 12}, (_,i)=>({
    id:'t'+i, title:'Task '+i, description:'', status: i%3===0?'done':'pending',
    priority:'normal', dueDate:now, folderId:null, createdAt:now, updatedAt:now,
  }));
  const activity = Array.from({length: 20}, (_,i)=>({
    id:'a'+i, module:['vault','notes','tasks','income'][i%4], action:'updated',
    itemName:'Thing '+i, createdAt:now,
  }));
  const settings = {displayName:'Kian', avatar:null, theme:'dark', accent:'#887bab',
    fontSize:16, autoLockMin:0, clipboardClearSec:30, showIcons:true};
  const responses = {
    vault_status:{initialized:true, locked:false}, get_settings:settings,
    update_settings:null,
    dashboard_stats:{totalItems:40,totalNotes:12,tasksOverdue:2,tasksToday:3,
      tasksDone:5,incomeThisMonth:4200000,recentActivity:activity,upcomingTasks:tasks.slice(0,6)},
    income_summary:{thisMonth:4200000,lastMonth:3100000,total:20000000,count:12},
    list_activity:activity, list_vault_items:vault, list_tasks:tasks,
    list_notes:[], list_income:[], list_folders:[], list_templates:[], list_auto_backups:[],
    totp_status:{hasSecret:false},
  };
  window.__QV_CALLS = [];
  window.__TAURI_INTERNALS__ = {
    invoke: async (cmd) => { window.__QV_CALLS.push(cmd); return responses[cmd] ?? null; },
    transformCallback: () => Math.random(), unregisterCallback: () => {}, convertFileSrc: (p)=>p,
  };
}
"""


async def open_dashboard(pw, browser_type="chromium", width=1400, height=900):
    """Luncurkan browser, mock Tauri, dan buka dashboard QVAULT.

    Mengembalikan (browser, page, errors). Pemanggil bertanggung jawab menutup
    browser. `errors` adalah list pesan error konsol/halaman.
    """
    if browser_type == "webkit":
        browser = await pw.webkit.launch()
    else:
        browser = await pw.chromium.launch(
            executable_path="/usr/bin/chromium",
            args=["--no-sandbox", "--disable-gpu", "--headless=new"],
        )
    page = await browser.new_page(viewport={"width": width, "height": height})
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on(
        "console",
        lambda m: errors.append("console:" + m.text) if m.type == "error" else None,
    )
    await page.add_init_script("(" + MOCK + ")()")
    await page.goto(APP, wait_until="networkidle")
    await page.wait_for_timeout(1500)
    # Setelah vault_status termuat (locked=false), app masih di /unlock karena
    # redirect awal. Paksa kembali ke "/" seperti setelah unlock sungguhan.
    await page.evaluate(
        "() => { history.pushState({},'','/');"
        " window.dispatchEvent(new PopStateEvent('popstate')); }"
    )
    await page.wait_for_timeout(1200)
    return browser, page, errors
