import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getAppointmentsByTypeMonth,
  getDashboardMetrics,
  getOutstandingOrders,
  getPendingDeliveries,
  getRecentPatients,
  getRevenue30d,
  getTodaySchedule,
  getTopFramesMonth,
} from "../api/dashboard";
import { useAuth } from "../auth/AuthContext";
import { formatInrPaiseDisplay } from "../lib/moneyInr";
import { STATUS_LABEL, statusColorClass } from "../constants/appointments";
import { STATUS_LABEL as ORDER_SL, statusBadgeClass } from "../constants/orders";

const COLORS = ["#0d9488", "#2563eb", "#d97706", "#7c3aed", "#db2777", "#64748b"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof getDashboardMetrics>> | null>(null);
  const [schedule, setSchedule] = useState<Awaited<ReturnType<typeof getTodaySchedule>>["data"]>([]);
  const [deliveries, setDeliveries] = useState<Awaited<ReturnType<typeof getPendingDeliveries>>["data"]>([]);
  const [recent, setRecent] = useState<Awaited<ReturnType<typeof getRecentPatients>>["data"]>([]);
  const [outstanding, setOutstanding] = useState<Awaited<ReturnType<typeof getOutstandingOrders>>["data"]>([]);
  const [rev30, setRev30] = useState<{ date: string; revenuePaise: number }[]>([]);
  const [apptTypes, setApptTypes] = useState<{ type: string; count: number }[]>([]);
  const [topFrames, setTopFrames] = useState<{ brand: string; qty: number }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    setErr(null);
    Promise.all([
      getDashboardMetrics(),
      getTodaySchedule(),
      getPendingDeliveries(),
      getRecentPatients(),
      getOutstandingOrders(),
      getRevenue30d(),
      getAppointmentsByTypeMonth(),
      getTopFramesMonth(),
    ])
      .then(([m, sch, del, rec, out, r30, apt, tf]) => {
        if (c) return;
        setMetrics(m);
        setSchedule(sch.data);
        setDeliveries(del.data);
        setRecent(rec.data);
        setOutstanding(out.data);
        setRev30(r30.data);
        setApptTypes(apt.data);
        setTopFrames(tf.data);
      })
      .catch((e: unknown) => {
        if (!c) setErr(e instanceof Error ? e.message : "Failed to load dashboard");
      });
    return () => {
      c = true;
    };
  }, []);

  const revenueChartData = useMemo(() => {
    const map = new Map(rev30.map((d) => [d.date, d.revenuePaise]));
    const out: { date: string; label: string; revenuePaise: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = ymd(d);
      out.push({
        date: key,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        revenuePaise: map.get(key) ?? 0,
      });
    }
    return out;
  }, [rev30]);

  const today = ymd(new Date());

  if (err) {
    return <p className="text-red-600 text-sm">{err}</p>;
  }

  if (!metrics) {
    return <p className="text-zinc-500">Loading dashboard…</p>;
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as <span className="font-medium">{user?.name}</span> ({user?.role})
        </p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => navigate("/appointments?tab=list")}
          className="text-left rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-accent/40 transition-colors"
        >
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Today&apos;s appointments</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{metrics.todayAppointments.total}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {metrics.todayAppointments.checkedIn} checked in · {metrics.todayAppointments.remaining} remaining
          </p>
        </button>
        <button
          type="button"
          onClick={() => navigate(`/orders?dateFrom=${today}&dateTo=${today}`)}
          className="text-left rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-accent/40 transition-colors"
        >
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Today&apos;s revenue</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{formatInrPaiseDisplay(metrics.todayRevenuePaise)}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">From orders created today</p>
        </button>
        <button
          type="button"
          onClick={() => navigate("/orders?statusScope=open")}
          className="text-left rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-accent/40 transition-colors"
        >
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Pending orders</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{metrics.pendingOrders}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Not delivered / cancelled</p>
        </button>
        <button
          type="button"
          onClick={() => navigate("/frames?status=low_stock")}
          className="text-left rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-accent/40 transition-colors"
        >
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Low stock alerts</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{metrics.lowStockCount}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Frames + lenses at/below reorder</p>
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-medium">Today&apos;s schedule</h2>
              <Link to="/appointments?tab=list" className="text-sm text-accent hover:underline">
                View all
              </Link>
            </div>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
              {schedule.length === 0 && <li className="py-2 text-zinc-500">No upcoming appointments today</li>}
              {schedule.map((a) => (
                <li key={a.id} className="py-2 flex flex-wrap gap-2 items-center">
                  <span className="font-mono text-xs w-20">
                    {new Date(a.startsAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="font-medium flex-1 min-w-[100px]">{a.patientName}</span>
                  <span className="text-zinc-500 text-xs">{a.appointmentType}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${statusColorClass(a.status)}`}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <h2 className="font-medium mb-3">Pending deliveries</h2>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
              {deliveries.length === 0 && <li className="py-2 text-zinc-500">None</li>}
              {deliveries.map((d) => (
                <li key={d.id} className="py-2 flex flex-wrap gap-2 items-center">
                  <Link to={`/orders/${d.id}`} className="font-mono text-xs text-accent hover:underline">
                    {d.orderNumber}
                  </Link>
                  <span className="flex-1">{d.patientName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${statusBadgeClass(d.status)}`}>
                    {ORDER_SL[d.status] ?? d.status}
                  </span>
                  {d.daysOverdue > 0 && <span className="text-xs text-red-600">{d.daysOverdue}d overdue</span>}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <h2 className="font-medium mb-3">Recent patients</h2>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
              {recent.map((p) => (
                <li key={p.id} className="py-2 flex justify-between gap-2">
                  <Link to={`/patients/${p.id}`} className="text-accent hover:underline font-medium">
                    {p.name}
                  </Link>
                  <span className="text-zinc-500 text-xs">{p.phone}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <h2 className="font-medium mb-3">Outstanding balances</h2>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
              {outstanding.map((o) => (
                <li key={o.orderId} className="py-2 flex flex-wrap gap-2 justify-between">
                  <div>
                    <span className="text-zinc-600">{o.patientName}</span>
                    <span className="text-zinc-400 text-xs ml-2">{o.orderNumber}</span>
                  </div>
                  <Link to={`/orders/${o.orderId}`} className="font-medium tabular-nums text-amber-700 dark:text-amber-400">
                    {formatInrPaiseDisplay(o.balancePaise)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 lg:col-span-2">
          <h2 className="font-medium mb-4">Revenue — last 30 days</h2>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) =>
                    `रू ${(Number(v) / 100).toLocaleString("ne-NP", { maximumFractionDigits: 0 })}`
                  }
                />
                <Tooltip
                  formatter={(value) => [formatInrPaiseDisplay(Number(value)), "Revenue"]}
                  labelFormatter={(_, p) => String((p?.[0]?.payload as { date?: string })?.date ?? "")}
                />
                <Bar dataKey="revenuePaise" fill="#0d9488" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <h2 className="font-medium mb-2">Appointments by type</h2>
          <p className="text-xs text-zinc-500 mb-2">This month</p>
          <div className="h-56 w-full min-w-0">
            {apptTypes.length === 0 ? (
              <p className="text-sm text-zinc-500 py-8 text-center">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={apptTypes}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {apptTypes.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 lg:col-span-3">
          <h2 className="font-medium mb-4">Top selling frames — this month (by brand)</h2>
          <div className="h-52 w-full min-w-0 max-w-2xl">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={topFrames} margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="brand" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="qty" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
