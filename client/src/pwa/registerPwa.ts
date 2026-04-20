import { processMutationQueue } from "../lib/offlineQueue";

export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  if (navigator.onLine) {
    void processMutationQueue();
  }

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });

  window.addEventListener("online", () => {
    void processMutationQueue();
    if ("serviceWorker" in navigator && "sync" in ServiceWorkerRegistration.prototype) {
      void navigator.serviceWorker.ready.then((reg) => {
        void (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync
          .register("ims-sync")
          .catch(() => {});
      });
    }
  });
}

export function getSwState(): Promise<{ active: boolean }> {
  if (!("serviceWorker" in navigator)) return Promise.resolve({ active: false });
  return navigator.serviceWorker.getRegistration().then((r) => ({
    active: !!(r?.active ?? r?.installing ?? r?.waiting),
  }));
}
