// QVAULT — Dialog auto-update ("tanya user dulu").
// Saat app dibuka, cek rilis baru diam-diam. Bila ada, tampilkan modal dengan
// tombol "Restart & Update". Pengguna yang memutuskan kapan memasang.
import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import Modal from "./Modal";
import Button from "./ui/Button";
import { useToast } from "./Toast";
import { useUpdaterStore } from "../store/useUpdaterStore";
import { checkForUpdate, installUpdate } from "../lib/updater";

export default function UpdateDialog() {
  const toast = useToast();
  const info = useUpdaterStore((s) => s.info);
  const open = useUpdaterStore((s) => s.open);
  const show = useUpdaterStore((s) => s.show);
  const dismiss = useUpdaterStore((s) => s.dismiss);
  const [installing, setInstalling] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Beri jeda singkat supaya tidak berebut dengan pemuatan awal app.
    const timer = window.setTimeout(async () => {
      try {
        const result = await checkForUpdate();
        if (!cancelled && result) show(result);
      } catch (err) {
        // Gagal cek update bukan kondisi fatal — cukup catat di console.
        console.warn("Gagal memeriksa update:", err);
      }
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [show]);

  async function handleInstall() {
    setInstalling(true);
    try {
      await installUpdate(setPercent);
      // relaunch() akan menggantikan proses; baris berikut hanya jaring aman.
      toast.info("Update terpasang. Menjalankan ulang…");
    } catch (err) {
      setInstalling(false);
      setPercent(null);
      toast.error(`Gagal memasang update: ${String(err)}`);
    }
  }

  if (!info) return null;

  return (
    <Modal
      open={open}
      onClose={() => !installing && dismiss()}
      title="Update tersedia"
      description={`Versi ${info.version} sudah siap dipasang (sekarang ${info.currentVersion}).`}
    >
      <div className="space-y-4">
        {info.body && (
          <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
            {info.body}
          </div>
        )}

        {installing && percent !== null && (
          <div className="space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-all duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-xs text-muted">Mengunduh… {percent}%</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={dismiss} disabled={installing}>
            Nanti
          </Button>
          <Button onClick={handleInstall} disabled={installing}>
            {installing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {installing ? "Memasang…" : "Restart & Update"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
