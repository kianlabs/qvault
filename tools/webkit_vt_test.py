"""Uji View Transitions di engine WebKitGTK SUNGGUHAN (sama dengan webview Tauri)
tanpa perlu Playwright WebKit (yang butuh lib Ubuntu tak tersedia di Arch).

Cara: jalankan server HTTP kecil yang menyajikan halaman tes + menangkap hasil
POST dari halaman, lalu buka halaman itu di MiniBrowser (browser contoh resmi
WebKitGTK) di dalam Xvfb (display virtual headless).

Pakai: python tools/webkit_vt_test.py
"""
import http.server, json, socketserver, subprocess, sys, threading, time, os

PORT = 8799
RESULT: dict = {}
DONE = threading.Event()

PAGE = r"""<!doctype html>
<html><head><meta charset="utf-8"><title>VT</title>
<style>
  html{background:#121417;} html.light{background:#f4f1ea;}
  ::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal;}
</style></head><body>
<script>
(async () => {
  const res = { hasVT: typeof document.startViewTransition === 'function',
                clipOK: !!(window.CSS && CSS.supports('clip-path','circle(10px at 1px 1px)')) };
  const origAnim = Element.prototype.animate;
  res.animCalls = [];
  Element.prototype.animate = function(kf, opts) {
    res.animCalls.push({ pseudo:(opts&&opts.pseudoElement)||null,
                         clip: !!(kf && kf.clipPath), dur:(opts&&opts.duration)||0 });
    return origAnim.call(this, kf, opts);
  };
  if (!res.hasVT) { res.error = 'no startViewTransition'; }
  else {
    let applied = 0;
    const vt = document.startViewTransition(() => {
      document.documentElement.classList.add('light'); applied++;
    });
    try {
      await vt.ready;
      res.readyOK = true;
      const a = document.documentElement.animate(
        { clipPath:['circle(0px at 40px 40px)','circle(1200px at 40px 40px)'] },
        { duration:400, easing:'ease-in-out', pseudoElement:'::view-transition-new(root)' });
      res.animCreated = !!a;
      await a.finished;
      res.animFinished = true;
    } catch(e) { res.err = String(e); }
    try { await vt.finished; res.finishedOK = true; } catch(e){ res.err2 = String(e); }
    res.applied = applied;
  }
  await fetch('/__result', { method:'POST', body: JSON.stringify(res) });
  document.title = 'DONE';
})();
</script></body></html>"""

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        body = PAGE.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(n).decode()
        try: RESULT.update(json.loads(raw))
        except Exception as e: RESULT["parseError"] = str(e)
        body = b"ok"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        DONE.set()

def main():
    srv = socketserver.TCPServer(("127.0.0.1", PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    time.sleep(0.3)

    mini = "/usr/lib/webkit2gtk-4.1/MiniBrowser"
    if not os.path.exists(mini):
        print("MiniBrowser tidak ada"); srv.shutdown(); sys.exit(1)

    env = dict(os.environ)
    env["DISPLAY"] = ":99"
    # JANGAN pakai --exit-after-load: MiniBrowser akan keluar sebelum JS async
    # selesai. Biarkan terbuka, kita yang menghentikannya setelah hasil masuk.
    cmd = [mini, f"http://127.0.0.1:{PORT}/"]
    proc = subprocess.Popen(cmd, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    got = DONE.wait(timeout=40)
    try: proc.terminate()
    except Exception: pass
    try: out, _ = proc.communicate(timeout=5)
    except Exception: out = ""
    if not got and out:
        print("--- MiniBrowser output ---"); print(out[:1500])
    srv.shutdown()

    print("=== WebKitGTK (engine webview Tauri) — View Transitions ===")
    if not got:
        print("!! tidak menerima hasil (timeout)"); sys.exit(2)
    print(json.dumps(RESULT, indent=2))

asyncio_note = "noop"
if __name__ == "__main__":
    main()
