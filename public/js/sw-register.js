// Registers the service worker (sw.js) so the app can start and run offline after one online visit.
// Without service worker support, or if registering fails (for example index.html opened as a
// local file), nothing changes: the app works online exactly as before. Never reloads the page.
try {
  if ("serviceWorker" in navigator) {
    // After "load", so registering never slows down the start of the app.
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
} catch (e) {
  // Some browsers throw when navigator.serviceWorker is accessed (e.g. blocked storage).
}
