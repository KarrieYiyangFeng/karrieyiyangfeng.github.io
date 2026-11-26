/* =============================================================
   build.mjs — bundle the site + images into ONE file, encrypt it
   (AES-256-GCM, key from PBKDF2-SHA256), and write ./index.html.

   Usage:
     node build.mjs "your strong passphrase here"

   The password is NEVER stored — it only lives in this one command.
   Only the encrypted ./index.html should be committed to GitHub.
   ============================================================= */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import crypto from 'node:crypto';

const SRC = 'src';
const ITER = 250000;           // PBKDF2 iterations
const OUT  = 'index.html';

const password = process.argv[2];
if (!password) {
  console.error('\n  ✗ No password given.\n    Run:  node build.mjs "your strong passphrase"\n');
  process.exit(1);
}
if (password.length < 10) {
  console.warn('  ⚠  That password is short. Use a long passphrase (4+ random words).');
}

// ---- 1. Build the self-contained payload (inline CSS, JS, images) ----
const mime = (f) =>
  f.endsWith('.png')  ? 'image/png'  :
  f.endsWith('.jpg')  || f.endsWith('.jpeg') ? 'image/jpeg' :
  f.endsWith('.webp') ? 'image/webp' :
  f.endsWith('.gif')  ? 'image/gif'  :
  f.endsWith('.svg')  ? 'image/svg+xml' : 'application/octet-stream';

let html = readFileSync(join(SRC, 'index.html'), 'utf8');
const css = readFileSync(join(SRC, 'css', 'style.css'), 'utf8');
const js  = readFileSync(join(SRC, 'js', 'script.js'), 'utf8');

// Inline the stylesheet and script
html = html.replace(/<link[^>]*href="css\/style\.css"[^>]*>/, `<style>\n${css}\n</style>`);
html = html.replace(/<script[^>]*src="js\/script\.js"[^>]*><\/script>/, `<script>\n${js}\n</script>`);

// Inline every image/… reference as a data: URI
const imgDir = join(SRC, 'image');
const images = readdirSync(imgDir);
for (const file of images) {
  const b64 = readFileSync(join(imgDir, file)).toString('base64');
  const dataUri = `data:${mime(file)};base64,${b64}`;
  html = html.split(`image/${file}`).join(dataUri);
}

// Sanity: no external references should remain
const leftover = html.match(/(src|href)="(?!data:|#|mailto:|https?:)[^"]+"/g);
if (leftover) {
  console.warn('  ⚠  Possible un-inlined references remain:', leftover.slice(0, 5));
}

const payloadBytes = Buffer.from(html, 'utf8');
console.log(`  • bundled payload: ${(payloadBytes.length / 1048576).toFixed(1)} MB`);

// ---- 2. Encrypt ----
const salt = crypto.randomBytes(16);
const iv   = crypto.randomBytes(12);
const key  = crypto.pbkdf2Sync(password, salt, ITER, 32, 'sha256');
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const enc = Buffer.concat([cipher.update(payloadBytes), cipher.final()]);
const tag = cipher.getAuthTag();
const combined = Buffer.concat([enc, tag]);   // WebCrypto expects ciphertext||tag

// Round-trip self-test (proves the ciphertext is valid)
const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
d.setAuthTag(tag);
const back = Buffer.concat([d.update(enc), d.final()]);
if (!back.equals(payloadBytes)) { console.error('  ✗ self-test failed'); process.exit(1); }
console.log('  • encryption self-test: OK');

const blob = {
  salt: salt.toString('base64'),
  iv:   iv.toString('base64'),
  iter: ITER,
  ct:   combined.toString('base64'),
};

// ---- 3. Write the encrypted gate page ----
const gate = readFileSync('gate.template.html', 'utf8')
  .replace('/*__PAYLOAD__*/', JSON.stringify(blob));
writeFileSync(OUT, gate);
console.log(`  • wrote ${OUT}: ${(gate.length / 1048576).toFixed(1)} MB`);
console.log('\n  ✓ Done. Commit ONLY index.html (+ build.mjs, gate.template.html). Keep src/ private.\n');
