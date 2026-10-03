// QVAULT — parser markdown minimal & AMAN (tanpa dangerouslySetInnerHTML).
// Semua output berupa elemen React, jadi tidak ada HTML mentah yang di-inject.
// Dukung: # ## ### heading, **bold**, *italic*, `code`, list -/* dan 1.,
// link [text](url) (dibuka via plugin-opener), baris kosong = pemisah paragraf.
import { Fragment, type ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

// Regex gabungan inline — urutan alternatif PENTING (code → link → bold → italic)
// supaya `**bold**` tidak keburu ditangkap sebagai `*italic*`.
const INLINE_RE =
  /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const BULLET_RE = /^\s*[-*]\s+(.*)$/;
const ORDERED_RE = /^\s*\d+\.\s+(.*)$/;

/** Ubah satu baris teks jadi node React (bold/italic/code/link). */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${i++}`;
    if (m[1] !== undefined) {
      // `code`
      nodes.push(
        <code
          key={key}
          className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.85em] text-accent"
        >
          {m[1]}
        </code>,
      );
    } else if (m[2] !== undefined && m[3] !== undefined) {
      // [text](url) — buka di browser luar, jangan navigasi webview.
      const href = m[3];
      nodes.push(
        <a
          key={key}
          href={href}
          onClick={(e) => {
            e.preventDefault();
            void openUrl(href).catch(() => {});
          }}
          className="text-accent underline underline-offset-2 hover:opacity-80"
        >
          {m[2]}
        </a>,
      );
    } else if (m[4] !== undefined) {
      // **bold**
      nodes.push(
        <strong key={key} className="font-semibold text-ink">
          {m[4]}
        </strong>,
      );
    } else if (m[5] !== undefined) {
      // *italic*
      nodes.push(
        <em key={key} className="italic">
          {m[5]}
        </em>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * Render markdown jadi ReactNode. Aman: tidak pernah memakai
 * dangerouslySetInnerHTML — hanya membuat elemen React.
 */
export function renderMarkdown(src: string): ReactNode {
  const lines = (src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let b = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Baris kosong = pemisah blok.
    if (!line.trim()) {
      i++;
      continue;
    }

    // Heading # ## ###
    const h = HEADING_RE.exec(line);
    if (h) {
      const key = `h${b++}`;
      const content = renderInline(h[2], key);
      if (h[1].length === 1) {
        blocks.push(
          <h1 key={key} className="mt-4 mb-2 text-xl font-bold text-ink first:mt-0">
            {content}
          </h1>,
        );
      } else if (h[1].length === 2) {
        blocks.push(
          <h2 key={key} className="mt-4 mb-2 text-lg font-semibold text-ink first:mt-0">
            {content}
          </h2>,
        );
      } else {
        blocks.push(
          <h3 key={key} className="mt-3 mb-1.5 text-base font-semibold text-ink first:mt-0">
            {content}
          </h3>,
        );
      }
      i++;
      continue;
    }

    // List bullet (- / *)
    if (BULLET_RE.test(line)) {
      const key = `ul${b++}`;
      const items: ReactNode[] = [];
      let j = 0;
      while (i < lines.length && BULLET_RE.test(lines[i])) {
        const text = BULLET_RE.exec(lines[i])?.[1] ?? "";
        const ikey = `${key}-${j++}`;
        items.push(<li key={ikey}>{renderInline(text, ikey)}</li>);
        i++;
      }
      blocks.push(
        <ul
          key={key}
          className="my-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink"
        >
          {items}
        </ul>,
      );
      continue;
    }

    // List berurut (1. 2. ...)
    if (ORDERED_RE.test(line)) {
      const key = `ol${b++}`;
      const items: ReactNode[] = [];
      let j = 0;
      while (i < lines.length && ORDERED_RE.test(lines[i])) {
        const text = ORDERED_RE.exec(lines[i])?.[1] ?? "";
        const ikey = `${key}-${j++}`;
        items.push(<li key={ikey}>{renderInline(text, ikey)}</li>);
        i++;
      }
      blocks.push(
        <ol
          key={key}
          className="my-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink"
        >
          {items}
        </ol>,
      );
      continue;
    }

    // Paragraf: kumpulkan baris teks berurutan (soft break jadi spasi).
    const key = `p${b++}`;
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) break;
      if (HEADING_RE.test(l) || BULLET_RE.test(l) || ORDERED_RE.test(l)) break;
      para.push(l.trim());
      i++;
    }
    blocks.push(
      <p key={key} className="my-2 text-sm leading-relaxed text-ink first:mt-0">
        {renderInline(para.join(" "), key)}
      </p>,
    );
  }

  return <Fragment>{blocks}</Fragment>;
}
