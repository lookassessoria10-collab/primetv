/* Prime TV — service worker das telas (/tv/*).
 * Mantém em cache a página do player, os scripts, as fontes, as mídias e a última programação,
 * para que a TV continue exibindo a apresentação mesmo sem internet ou após reiniciar.
 * O painel administrativo NÃO é controlado por este service worker (escopo /tv/).
 */
const PAGES = "primetv-pages-v1";
const STATIC = "primetv-static-v1";
const MEDIA = "primetv-media-v1";
const API = "primetv-api-v1";
const KNOWN = [PAGES, STATIC, MEDIA, API];
const MAX_STATIC = 250;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.indexOf("primetv-") === 0 && KNOWN.indexOf(n) === -1).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

async function networkFirst(request, cacheName, ms) {
  const cache = await caches.open(cacheName);
  try {
    const response = await Promise.race([fetch(request), timeout(ms)]);
    if (response && response.ok) cache.put(request, response.clone());
    if (response && response.status === 404) return response;
    if (response && response.ok) return response;
    throw new Error("bad response");
  } catch (e) {
    const cached = await cache.match(request, { ignoreSearch: cacheName === PAGES });
    if (cached) return cached;
    throw e;
  }
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.status === 200) {
    await cache.put(request, response.clone());
    if (cacheName === STATIC) trim(STATIC, MAX_STATIC);
  }
  return response;
}

/* Vídeos pedem intervalos (Range): responde a partir do arquivo completo em cache. */
async function rangeFromCache(request) {
  const cache = await caches.open(MEDIA);
  const url = request.url;
  const full = await cache.match(url);
  if (!full) {
    // Baixa o arquivo inteiro em segundo plano para as próximas reproduções.
    fetch(url)
      .then((r) => (r.ok && r.status === 200 ? cache.put(url, r) : null))
      .catch(() => null);
    return fetch(request);
  }
  const blob = await full.blob();
  const match = /bytes=(\d*)-(\d*)/.exec(request.headers.get("range") || "");
  const start = match && match[1] ? Number(match[1]) : 0;
  const end = match && match[2] ? Number(match[2]) : blob.size - 1;
  const slice = blob.slice(start, end + 1);
  return new Response(slice, {
    status: 206,
    headers: {
      "Content-Type": full.headers.get("Content-Type") || "video/mp4",
      "Content-Range": "bytes " + start + "-" + end + "/" + blob.size,
      "Content-Length": String(slice.size),
      "Accept-Ranges": "bytes",
    },
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;

  if (request.mode === "navigate" && path.indexOf("/tv/") === 0) {
    event.respondWith(networkFirst(request, PAGES, 8000));
    return;
  }
  if (path.indexOf("/_next/static/") === 0) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }
  if (path.indexOf("/media/") === 0 || path.indexOf("/brand/") === 0) {
    if (request.headers.has("range")) {
      event.respondWith(rangeFromCache(request));
      return;
    }
    event.respondWith(cacheFirst(request, MEDIA));
    return;
  }
  if (path.indexOf("/api/tv/") === 0) {
    event.respondWith(networkFirst(request, API, 15000));
  }
});

function cacheFor(pathname) {
  if (pathname.indexOf("/_next/static/") === 0) return STATIC;
  if (pathname.indexOf("/api/tv/") === 0) return API;
  if (pathname.indexOf("/tv/") === 0) return PAGES;
  if (pathname.indexOf("/media/") === 0 || pathname.indexOf("/brand/") === 0) return MEDIA;
  return null;
}

/* Guarda página, scripts e programação carregados antes de o service worker assumir. */
async function precache(urls) {
  for (const u of urls) {
    const url = new URL(u, self.location.origin);
    if (url.origin !== self.location.origin) continue;
    const name = cacheFor(url.pathname);
    if (!name) continue;
    const cache = await caches.open(name);
    if ((name === STATIC || name === MEDIA) && (await cache.match(url.href))) continue;
    try {
      const response = await fetch(url.href, { cache: "no-cache", credentials: "same-origin" });
      if (response.ok && response.status === 200) await cache.put(url.href, response);
    } catch (e) {
      /* sem conexão: tenta na próxima vez */
    }
  }
  trim(STATIC, MAX_STATIC);
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "precache" && Array.isArray(data.urls)) {
    event.waitUntil(precache(data.urls.slice(0, 300)));
    return;
  }
  /* O player informa quais mídias a programação atual usa; as demais são removidas do cache. */
  if (data.type !== "keep-media" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const keep = new Set(data.urls.map((u) => new URL(u, self.location.origin).pathname));
      const cache = await caches.open(MEDIA);
      const keys = await cache.keys();
      await Promise.all(
        keys.map((req) => {
          const p = new URL(req.url).pathname;
          if (p.indexOf("/brand/") === 0 || keep.has(p)) return null;
          return cache.delete(req);
        }),
      );
    })(),
  );
});
