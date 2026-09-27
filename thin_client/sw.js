const DB_NAME = "fluffy_industries_client";
const STORE_NAME = "files";

let dbInstance = null;

async function getDB() {
  if (dbInstance) return dbInstance;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };
    request.onerror = (event) => reject(event.target.error);
  });
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

async function getFile(path) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(path);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getMime(path) {
  const ext = path.split(".").pop().toLowerCase();
  const map = {
    html: "text/html",
    js: "text/javascript",
    css: "text/css",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    json: "application/json",
    wav: "audio/wav",
    mp3: "audio/mpeg",
  };
  return map[ext] || "application/octet-stream";
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // CRITICAL: Only handle requests inside the virtual /game/ directory
  if (url.pathname.includes("/game/")) {
    let filePath = url.pathname.substring(
      url.pathname.lastIndexOf("/game/") + 6,
    );

    // Handle root index.html
    if (!filePath || filePath === "/") {
      filePath = "index.html";
    }

    filePath = decodeURIComponent(filePath);

    event.respondWith(
      getFile(filePath)
        .then((file) => {
          if (file && file.content) {
            return new Response(file.content, {
              headers: {
                "Content-Type": getMime(filePath),
                "Cache-Control": "no-cache",
              },
            });
          }
          // Fallback to network if not in IDB
          return fetch(event.request);
        })
        .catch(() => {
          return fetch(event.request);
        }),
    );
  }
  // All other requests (style.css, client.js) fall through automatically
});
