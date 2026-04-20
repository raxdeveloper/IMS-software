import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import { getPendingSyncCount } from "../../lib/offlineQueue";
import { getSwState } from "../../pwa/registerPwa";

type HealthPayload = {
  ok: boolean;
  database: "ok" | "error";
  counts: { patients: number; prescriptions: number; orders: number };
  lastBackup: string | null;
};

export function HealthDeploymentPage() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [swActive, setSwActive] = useState(false);
  const [queueN, setQueueN] = useState(0);

  function load() {
    setErr(null);
    void apiFetch<HealthPayload>("/api/health/deployment")
      .then(setData)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed"));
    setPwaInstalled(window.matchMedia("(display-mode: standalone)").matches);
    void getSwState().then((s) => setSwActive(s.active));
    void getPendingSyncCount().then(setQueueN);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Deployment health</h1>
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
          <button type="button" onClick={load} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}
      <ul className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
        <li className="flex justify-between gap-2 px-4 py-2">
          <span>Database connection</span>
          <span className={data?.database === "ok" ? "text-emerald-600" : "text-red-600"}>
            {data ? (data.database === "ok" ? "OK" : "ERROR") : "…"}
          </span>
        </li>
        <li className="flex justify-between gap-2 px-4 py-2">
          <span>Total patients</span>
          <span className="tabular-nums">{data?.counts.patients ?? "—"}</span>
        </li>
        <li className="flex justify-between gap-2 px-4 py-2">
          <span>Total prescriptions</span>
          <span className="tabular-nums">{data?.counts.prescriptions ?? "—"}</span>
        </li>
        <li className="flex justify-between gap-2 px-4 py-2">
          <span>Total orders</span>
          <span className="tabular-nums">{data?.counts.orders ?? "—"}</span>
        </li>
        <li className="flex justify-between gap-2 px-4 py-2">
          <span>Last backup</span>
          <span className="text-zinc-500">{data?.lastBackup ?? "Not configured (placeholder)"}</span>
        </li>
        <li className="flex justify-between gap-2 px-4 py-2">
          <span>PWA</span>
          <span>{pwaInstalled ? "installed" : "not installed"}</span>
        </li>
        <li className="flex justify-between gap-2 px-4 py-2">
          <span>Service worker</span>
          <span>{swActive ? "active" : "inactive"}</span>
        </li>
        <li className="flex justify-between gap-2 px-4 py-2">
          <span>Offline sync queue</span>
          <span className="tabular-nums">{queueN} pending</span>
        </li>
      </ul>
    </div>
  );
}
