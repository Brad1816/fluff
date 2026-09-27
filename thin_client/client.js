const DB_NAME = "fluffy_industries_client";
const STORE_NAME = "files";
const GITLAB_REPO = "bdfdsbf%2Ffluffy-industries";
const GITLAB_API_BASE = `https://gitlab.com/api/v4/projects/${GITLAB_REPO}/repository`;
const DEFAULT_REF = "main";

const EXCLUDED_FILES = [
  ".gitignore",
  "jsconfig.json",
  "zip_project.sh",
  "zip_thin_client.sh",
];
const EXCLUDED_DIRS = ["tests/", "thin_client/"];

const elements = {
  progressBar: document.getElementById("progress-fill"),
  statusText: document.getElementById("status-text"),
  buttonContainer: document.getElementById("button-container"),
  clearBtn: document.getElementById("clear-btn"),
  uiContainer: document.getElementById("ui-container"),
  gameContainer: document.getElementById("game-container"),
  gameIframe: document.getElementById("game-iframe"),
  loadingContainer: document.getElementById("loading-container"),
  commitContainer: document.getElementById("commit-container"),
  commitName: document.getElementById("commit-name"),
  commitDesc: document.getElementById("commit-desc"),
  commitMeta: document.getElementById("commit-meta"),
};

let db;

async function init() {
  console.log("[Client] Initializing Thin Client...");

  // 1. Register Service Worker
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("sw.js");
      console.log("[Client] SW registered with scope:", registration.scope);

      await navigator.serviceWorker.ready;

      if (!navigator.serviceWorker.controller) {
        console.log("[Client] SW active but not yet controlling. Reloading...");
        window.location.reload();
        return;
      }
    } catch (error) {
      console.error("[Client] Service Worker registration failed:", error);
    }
  }

  // 2. Open IndexedDB
  db = await openDB();

  // 3. Start Download Process (Sync)
  await startDownload();
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "path" });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

async function clearGameFiles() {
  elements.statusText.textContent = "Clearing local files...";
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  const clearRequest = store.clear();
  return new Promise((resolve, reject) => {
    clearRequest.onsuccess = () => resolve();
    clearRequest.onerror = () => reject(clearRequest.error);
  });
}

async function startDownload() {
  elements.statusText.textContent = "Checking for updates...";

  try {
    // Fetch commit in background immediately and display it as soon as it resolves
    const commitPromise = fetchLatestCommit()
      .then((commit) => {
        if (commit) {
          displayCommitInfo(commit);
        }
        return commit;
      })
      .catch((err) => {
        console.error("[Client] Failed to fetch latest commit:", err);
        return null;
      });

    const files = await fetchFileList();
    const filteredFiles = files.filter((file) => {
      if (file.type !== "blob") return false;
      if (EXCLUDED_FILES.includes(file.path)) return false;
      if (EXCLUDED_DIRS.some((dir) => file.path.startsWith(dir))) return false;
      if (/\.sh$/i.test(file.path)) return false;
      return true;
    });

    const totalFiles = filteredFiles.length;
    let downloadedCount = 0;
    let updateCount = 0;
    let prunedCount = 0;
    const CONCURRENCY = 25;

    // --- PRUNING LOGIC ---
    elements.statusText.textContent = "Pruning obsolete files...";
    const localPaths = await getAllPaths();
    const remotePaths = new Set(filteredFiles.map((f) => f.path));

    for (const path of localPaths) {
      if (!remotePaths.has(path)) {
        await deleteFile(path);
        prunedCount++;
      }
    }
    if (prunedCount > 0)
      console.log(`[Client] Pruned ${prunedCount} obsolete files.`);

    // --- SYNC LOGIC ---
    const queue = [...filteredFiles];

    const downloadPool = async () => {
      while (queue.length > 0) {
        const file = queue.shift();
        if (!file) break;

        const existing = await getFile(file.path);

        if (existing && existing.sha === file.id) {
          downloadedCount++;
          updateProgress(downloadedCount, totalFiles);
          continue;
        }

        elements.statusText.textContent = `Updating: ${file.path}`;
        try {
          const content = await fetchFileContent(file.path);
          await storeFile(file.path, content, file.id);
          updateCount++;
        } catch (err) {
          console.error(`[Client] Error downloading ${file.path}:`, err);
        }

        downloadedCount++;
        updateProgress(downloadedCount, totalFiles);
      }
    };

    const pools = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      pools.push(downloadPool());
    }
    await Promise.all(pools);

    elements.statusText.textContent = "Launching game...";
    elements.buttonContainer.classList.remove("hidden");

    // Auto-start in 1 second
    setTimeout(launchGame, 1000);
  } catch (error) {
    console.error("[Client] Sync failed:", error);
    elements.statusText.textContent = "Error: " + error.message;

    if (await hasFile("index.html")) {
      elements.statusText.textContent =
        "Sync failed. Launching cached version...";
      elements.buttonContainer.classList.remove("hidden");
      setTimeout(launchGame, 1000);
    }
  }
}

function updateProgress(count, total) {
  const percent = (count / total) * 100;
  elements.progressBar.style.width = `${percent}%`;
}

async function getFile(path) {
  const transaction = db.transaction(STORE_NAME, "readonly");
  const store = transaction.objectStore(STORE_NAME);
  return new Promise((resolve) => {
    const getRequest = store.get(path);
    getRequest.onsuccess = () => resolve(getRequest.result);
    getRequest.onerror = () => resolve(null);
  });
}

async function getAllPaths() {
  const transaction = db.transaction(STORE_NAME, "readonly");
  const store = transaction.objectStore(STORE_NAME);
  return new Promise((resolve) => {
    const request = store.getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve([]);
  });
}

async function deleteFile(path) {
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.delete(path);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function hasFile(path) {
  const file = await getFile(path);
  return !!file;
}

async function fetchLatestCommit() {
  const url = `${GITLAB_API_BASE}/commits?per_page=1&ref_name=${DEFAULT_REF}`;
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to fetch latest commit: ${response.statusText}`);
  const commits = await response.json();
  return commits[0];
}

function displayCommitInfo(commit) {
  if (!commit) return;

  elements.commitContainer.classList.remove("hidden");

  const message = commit.message || "";
  const lines = message.split("\n");
  const commitName = lines[0] || commit.title || "No Title";
  const commitDescription = lines.slice(1).join("\n").trim();

  elements.commitName.textContent = commitName;

  if (commitDescription) {
    elements.commitDesc.textContent = commitDescription;
    elements.commitDesc.classList.remove("hidden");
  } else {
    elements.commitDesc.classList.add("hidden");
  }

  const date = new Date(commit.committed_date || commit.created_at);
  const formattedDate = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const authorName = commit.author_name || "Unknown";
  const shortId =
    commit.short_id || (commit.id ? commit.id.substring(0, 8) : "");
  elements.commitMeta.textContent = `by ${authorName} on ${formattedDate} (${shortId})`;
}

async function fetchFileList() {
  let allFiles = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const url = `${GITLAB_API_BASE}/tree?recursive=true&per_page=100&ref=${DEFAULT_REF}&page=${page}`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to fetch file list: ${response.statusText}`);

    const files = await response.json();
    allFiles = allFiles.concat(files);

    const nextPageHeader = response.headers.get("x-next-page");
    if (nextPageHeader) {
      page = parseInt(nextPageHeader);
    } else {
      hasNextPage = false;
    }
  }
  return allFiles;
}

async function fetchFileContent(path) {
  const url = `${GITLAB_API_BASE}/files/${encodeURIComponent(path)}/raw?ref=${DEFAULT_REF}`;
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
  return await response.blob();
}

async function storeFile(path, content, sha) {
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const putRequest = store.put({ path, content, sha });
    putRequest.onsuccess = () => resolve();
    putRequest.onerror = () => reject(putRequest.error);
  });
}

function launchGame() {
  // Only launch if we're not already in the game
  if (!elements.gameContainer.classList.contains("hidden")) return;

  const currentPath = window.location.pathname;
  const baseDir = currentPath.substring(0, currentPath.lastIndexOf("/") + 1);
  const gameUrl = "game/index.html";

  console.log(`[Client] Auto-launching game from: ${gameUrl}`);

  elements.uiContainer.classList.add("hidden");
  elements.gameContainer.classList.remove("hidden");

  elements.gameIframe.src = gameUrl;

  elements.gameIframe.onload = () => {
    try {
      elements.gameIframe.contentWindow.focus();
      elements.gameIframe.focus();
    } catch (e) {}
  };
}

elements.clearBtn.onclick = async () => {
  // Prevent auto-launch if they click clear
  elements.gameIframe.src = "";
  elements.gameContainer.classList.add("hidden");
  elements.uiContainer.classList.remove("hidden");
  elements.buttonContainer.classList.add("hidden");
  elements.loadingContainer.classList.remove("hidden");
  elements.progressBar.style.width = "0%";

  // Reset and hide commit container during redownload
  elements.commitContainer.classList.add("hidden");
  elements.commitName.textContent = "Loading commit...";
  elements.commitDesc.classList.add("hidden");
  elements.commitDesc.textContent = "";
  elements.commitMeta.textContent = "";

  await clearGameFiles();
  await startDownload();
};

init();
