import fs from 'node:fs';
import path from 'node:path';

/**
 * Render static hosting serves directory indexes, but not `chat.html` for `/chat`.
 * Next `trailingSlash: true` already emits `chat/index.html`; this copy is a
 * fallback if a nested `.html` file is still present after the export.
 */
const outDir = path.resolve('out');

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!name.endsWith('.html') || name === 'index.html' || name === '404.html') continue;
    const destDir = path.join(dir, name.slice(0, -5));
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, 'index.html');
    if (!fs.existsSync(dest)) fs.copyFileSync(full, dest);
  }
}

if (!fs.existsSync(outDir)) {
  console.error('pretty-static-urls: out/ not found');
  process.exit(1);
}
walk(outDir);
