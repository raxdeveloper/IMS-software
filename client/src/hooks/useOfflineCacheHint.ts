import { useEffect, useState } from "react";

/** True after a cached API response was used (offline / SW fallback). */
export function useOfflineCacheHint(): boolean {
  const [hint, setHint] = useState(false);
  useEffect(() => {
    const fn = () => setHint(true);
    window.addEventListener("ims-offline-cache-hit", fn);
    return () => window.removeEventListener("ims-offline-cache-hit", fn);
  }, []);
  return hint;
}
