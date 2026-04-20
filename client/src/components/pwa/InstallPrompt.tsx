import { useEffect, useState } from "react";

const DISMISS_KEY = "eyeims-install-dismiss-until";

function getDismissUntil(): number {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? 0 : n;
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    const t = window.setTimeout(() => {
      if (getDismissUntil() > Date.now()) return;
      if (window.matchMedia("(display-mode: standalone)").matches) return;
      if ((navigator as Navigator & { standalone?: boolean }).standalone) return;
      setShow(true);
    }, 30_000);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (!show || deferred) return;
    if (getDismissUntil() > Date.now()) return;
  }, [show, deferred]);

  if (!show) return null;
  if (window.matchMedia("(display-mode: standalone)").matches) return null;

  async function install() {
    if (deferred) {
      await deferred.prompt();
      setDeferred(null);
    }
    setShow(false);
  }

  function dismiss() {
    const until = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setShow(false);
  }

  return (
    <div className="no-print fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-[400] rounded-xl border border-zinc-200 dark:border-accent/25 bg-white dark:bg-ims-surface dark:backdrop-blur-md shadow-lg dark:shadow-[0_0_32px_-8px_rgba(0,255,157,0.2)] p-4 text-sm">
      <p className="font-medium text-zinc-900 dark:text-zinc-100">Install EyeIMS on your device for faster access</p>
      <div className="flex gap-2 mt-3 justify-end">
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg border border-zinc-300 dark:border-white/15 px-3 py-1.5 text-zinc-600 dark:text-ims-muted"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => void install()}
          className="rounded-lg bg-accent text-accent-foreground px-3 py-1.5 font-medium shadow-[0_0_18px_-4px_rgba(0,255,157,0.5)]"
        >
          Install
        </button>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
