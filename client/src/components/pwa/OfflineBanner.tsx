import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="no-print shrink-0 bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-100 text-center text-sm px-3 py-2 border-b border-amber-300 dark:border-amber-800"
    >
      You are offline. Changes will sync when connection is restored.
    </div>
  );
}
