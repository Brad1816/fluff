// ---------------------------------------------------------------------------
// Playing offline: once the game has been opened on a website (GitHub Pages,
// or from the home screen), it keeps working with no internet (sw.js keeps
// every file). Opened as a file on a computer (file://) there's nothing to
// do - it never needed the internet - and test automation is left alone.
// ---------------------------------------------------------------------------

function offlineSupported() {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof location !== "undefined" &&
    /^https?:$/.test(location.protocol) &&
    !navigator.webdriver
  );
}

// Hand the service worker everything this page has loaded, to keep
function keepEverythingOffline() {
  if (!offlineSupported() || !navigator.serviceWorker.controller) return false;
  const urls = [location.href.split("#")[0], new URL("./index.html", location.href).href, new URL("./manifest.json", location.href).href];
  try {
    for (const r of performance.getEntriesByType("resource")) urls.push(r.name);
  } catch (e) {}
  navigator.serviceWorker.controller.postMessage({ type: "keep", urls: [...new Set(urls)] });
  return true;
}

if (offlineSupported()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        // (once it's in charge of the page: everything loaded so far, then again later for sounds and pictures loaded since)
        const go = () => keepEverythingOffline();
        if (navigator.serviceWorker.controller) go();
        else navigator.serviceWorker.addEventListener("controllerchange", go, { once: true });
        setTimeout(go, 15000);
        setTimeout(go, 90000);
      })
      .catch((e) => console.warn("Offline play isn't available:", e));
  });
}
