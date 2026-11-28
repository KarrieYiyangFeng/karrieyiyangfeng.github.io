const MANIFEST = '/portfolio-data/manifest.bin';
const FILES = '/portfolio-data/';
const SESSION_DURATION = 8 * 60 * 60 * 1000;
const PRIVATE_PATH = /^\/(?:index\.html$|album\.html$|(?:projects|css|js|image)\/)/;
let database;
let session;
let video;

function openDatabase() {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open('portfolio-access', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('sessions');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return database;
}

async function readCredentials() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('sessions').objectStore('sessions').get('active');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveCredentials(credentials) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('sessions', 'readwrite');
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
    transaction.objectStore('sessions').put(credentials, 'active');
  });
}

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Missing encrypted portfolio data');
  return new Uint8Array(await response.arrayBuffer());
}

function decrypt(bytes, key) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, key, bytes.subarray(12));
}

async function loadFiles(key) {
  const response = await fetch(MANIFEST, { cache: 'no-cache' });
  if (!response.ok) throw new Error('Missing portfolio manifest');
  const bytes = new Uint8Array(await response.arrayBuffer());
  const payload = await decrypt(bytes.subarray(16), key);
  return JSON.parse(new TextDecoder().decode(payload)).files;
}

async function currentSession() {
  if (!session) {
    session = (async () => {
      const credentials = await readCredentials();
      if (!credentials || credentials.expires <= Date.now()) return null;
      const files = await loadFiles(credentials.key);
      return { ...credentials, files };
    })().catch(() => null);
  }
  const active = await session;
  if (active?.expires > Date.now()) return active;
  video = null;
  return null;
}

self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  const port = event.ports[0];
  if (!port || !event.data?.key) return;
  event.waitUntil((async () => {
    try {
      const { key } = event.data;
      const files = await loadFiles(key);
      const credentials = { key, expires: Date.now() + SESSION_DURATION };
      await saveCredentials(credentials);
      session = Promise.resolve({ ...credentials, files });
      video = null;
      port.postMessage(true);
    } catch {
      port.postMessage(false);
    }
  })());
});

function readFile(entry, key) {
  const load = () => fetchBytes(FILES + entry.file).then((bytes) => decrypt(bytes, key));
  if (!entry.type.startsWith('video/')) return load();
  if (video?.file !== entry.file) {
    const bytes = load().catch((error) => {
      if (video?.file === entry.file) video = null;
      throw error;
    });
    video = { file: entry.file, bytes };
  }
  return video.bytes;
}

function getRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  return start < size && end >= start ? { start, end } : null;
}

async function servePrivate(request, path) {
  const active = await currentSession();
  if (!active) {
    if (request.mode === 'navigate') return fetch('/portfolio-gate.html', { cache: 'no-cache' });
    return new Response(null, { status: 404 });
  }

  if (!Object.hasOwn(active.files, path)) return new Response('Page not found.', { status: 404 });
  const entry = active.files[path];
  const rangeHeader = request.headers.get('Range');
  const range = rangeHeader ? getRange(rangeHeader, entry.size) : null;
  const headers = {
    'Content-Type': entry.type,
    'Content-Length': entry.size,
    'Cache-Control': 'no-store',
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff'
  };
  if (rangeHeader && !range) {
    return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + entry.size } });
  }

  if (range) {
    headers['Content-Range'] = 'bytes ' + range.start + '-' + range.end + '/' + entry.size;
    headers['Content-Length'] = range.end - range.start + 1;
  }
  const status = range ? 206 : 200;
  if (request.method === 'HEAD') return new Response(null, { status, headers });
  try {
    const bytes = await readFile(entry, active.key);
    return new Response(range ? bytes.slice(range.start, range.end + 1) : bytes, { status, headers });
  } catch {
    return new Response('The portfolio file could not load.', { status: 503 });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' && request.method !== 'HEAD') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { return; }
  if (path === '/') path = '/index.html';
  if (PRIVATE_PATH.test(path)) event.respondWith(servePrivate(request, path));
});

// Release afd49ce8ac19680966d87c253da037b3

// Release 53ee79442a6f2f520ec6b5225beda919

// Release 3abff8b2deeda326175ad2d5534c9968

// Release c5e7fd3e60ff5f11293a60cb51e477d5
