import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  listAppointments,
  listAppointmentsRange,
  getAppointmentCountsByMonth,
  getTodayQueue,
  getAppointmentDoctors,
  updateAppointmentStatus,
  type AppointmentRow,
} from "../../api/appointments";
import { getClinicSettings, type ClinicSettings } from "../../api/settings";
import { useAuth } from "../../auth/AuthContext";
import { STATUS_LABEL, statusColorClass, fillReminderTemplate, quickNextStatuses } from "../../constants/appointments";
import { generateSlotMinutes, minutesToLabel, weekMonToSat } from "../../lib/appointmentSlots";
import { AppointmentBookingModal } from "../../components/appointments/AppointmentBookingModal";
import { AppointmentDetailModal, SendReminderModal } from "../../components/appointments/AppointmentDetailModal";

type MainTab = "calendar" | "list" | "queue";
type CalView = "day" | "week" | "month";

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function AppointmentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "staff" || user?.role === "doctor";
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = (searchParams.get("tab") as MainTab) || "calendar";
  const calView = (searchParams.get("view") as CalView) || "week";

  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [cursor, setCursor] = useState(() => new Date());
  const [doctorFilter, setDoctorFilter] = useState("");
  const [listRows, setListRows] = useState<AppointmentRow[]>([]);
  const [queueRows, setQueueRows] = useState<AppointmentRow[]>([]);
  const [rangeAppts, setRangeAppts] = useState<AppointmentRow[]>([]);
  const [monthCounts, setMonthCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [doctorOptions, setDoctorOptions] = useState<{ id: string; name: string }[]>([]);

  const [bookOpen, setBookOpen] = useState(false);
  const [editAppt, setEditAppt] = useState<AppointmentRow | null>(null);
  const [prefill, setPrefill] = useState<Parameters<typeof AppointmentBookingModal>[0]["prefill"]>(null);
  const [detail, setDetail] = useState<AppointmentRow | null>(null);
  const [reminder, setReminder] = useState<AppointmentRow | null>(null);

  const [listQ, setListQ] = useState("");
  const [listStatus, setListStatus] = useState("all");
  const [listType, setListType] = useState("all");
  const [listDateFrom, setListDateFrom] = useState("");
  const [listDateTo, setListDateTo] = useState("");
  const [listToday, setListToday] = useState(true);

  const setTab = (t: MainTab) => {
    const n = new URLSearchParams(searchParams);
    n.set("tab", t);
    setSearchParams(n);
  };
  const setCalView = (v: CalView) => {
    const n = new URLSearchParams(searchParams);
    n.set("view", v);
    setSearchParams(n);
  };

  const loadSettings = useCallback(() => {
    void getClinicSettings().then(setSettings).catch(() => toast.error("Could not load settings"));
  }, []);

  const loadList = useCallback(() => {
    return listAppointments({
      q: listQ || undefined,
      status: listStatus === "all" ? undefined : listStatus,
      type: listType === "all" ? undefined : listType,
      doctorUserId: doctorFilter || undefined,
      today: listToday ? true : undefined,
      dateFrom: !listToday && listDateFrom ? listDateFrom : undefined,
      dateTo: !listToday && listDateTo ? listDateTo : undefined,
      limit: 100,
      page: 1,
    })
      .then((r) => setListRows(r.data))
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed");
      });
  }, [listQ, listStatus, listType, doctorFilter, listToday, listDateFrom, listDateTo]);

  const loadQueue = useCallback(() => {
    return getTodayQueue()
      .then((r) => setQueueRows(r.data))
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed");
      });
  }, []);

  const loadRange = useCallback(() => {
    if (!settings) return Promise.resolve();
    let from: Date;
    let to: Date;
    if (calView === "day") {
      from = startOfDay(cursor);
      to = endOfDay(cursor);
    } else if (calView === "week") {
      const days = weekMonToSat(cursor);
      from = startOfDay(days[0]!);
      to = endOfDay(days[5]!);
    } else {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      from = new Date(y, m, 1);
      to = new Date(y, m + 1, 0, 23, 59, 59, 999);
    }
    return listAppointmentsRange({
      from: from.toISOString(),
      to: to.toISOString(),
      doctorUserId: doctorFilter || undefined,
    })
      .then((r) => setRangeAppts(r.data))
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed");
      });
  }, [settings, calView, cursor, doctorFilter]);

  const loadMonthCounts = useCallback(() => {
    if (calView !== "month") return Promise.resolve();
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    return getAppointmentCountsByMonth(y, m, doctorFilter || undefined)
      .then((r) => setMonthCounts(r.counts))
      .catch(() => {});
  }, [calView, cursor, doctorFilter]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    void getAppointmentDoctors()
      .then((r) => setDoctorOptions(r.doctors))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!settings) return;
    if (tab !== "list") return;
    setLoading(true);
    void loadList().finally(() => setLoading(false));
  }, [settings, tab, loadList]);

  useEffect(() => {
    if (!settings) return;
    if (tab !== "queue") return;
    setLoading(true);
    void loadQueue().finally(() => setLoading(false));
  }, [settings, tab, loadQueue]);

  useEffect(() => {
    if (!settings) return;
    if (tab !== "calendar") return;
    setLoading(true);
    void Promise.all([loadRange(), loadMonthCounts()]).finally(() => setLoading(false));
  }, [settings, tab, calView, cursor, doctorFilter, loadRange, loadMonthCounts]);

  useEffect(() => {
    if (tab !== "queue") return;
    const id = setInterval(() => void loadQueue(), 60_000);
    return () => clearInterval(id);
  }, [tab, loadQueue]);

  useEffect(() => {
    const book = searchParams.get("book");
    if (book === "1") {
      setBookOpen(true);
      const pid = searchParams.get("patientId");
      const du = searchParams.get("doctorUserId");
      const dn = searchParams.get("doctorName");
      const dt = searchParams.get("date");
      if (pid) {
        setPrefill({
          patientId: parseInt(pid, 10),
          doctorUserId: du || null,
          doctorDisplayName: dn || undefined,
          appointmentType: "Follow-up",
          dateYmd: dt || undefined,
        });
      }
      const n = new URLSearchParams(searchParams);
      n.delete("book");
      n.delete("patientId");
      n.delete("doctorUserId");
      n.delete("doctorName");
      n.delete("date");
      setSearchParams(n, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const slots = useMemo(() => {
    if (!settings) return [];
    return generateSlotMinutes(settings.appointmentStartMin, settings.appointmentEndMin, settings.appointmentSlotStepMin);
  }, [settings]);

  async function handleStatus(a: AppointmentRow, status: string) {
    await updateAppointmentStatus(a.id, status);
    if (status === "completed") {
      if (window.confirm("Create prescription for this patient?")) {
        navigate(`/prescriptions/new?patient_id=${a.patientId}&appointment_id=${a.id}`);
      }
    }
    toast.success("Updated");
    void loadList();
    void loadQueue();
    void loadRange();
    void loadMonthCounts();
  }

  function openReminder(a: AppointmentRow) {
    setReminder(a);
    setDetail(null);
  }

  function followUpFrom(a: AppointmentRow) {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const ymd = dateKey(d);
    setPrefill({
      patientId: a.patientId,
      doctorUserId: a.doctorUserId,
      doctorDisplayName: a.doctorDisplayName,
      appointmentType: "Follow-up",
      dateYmd: ymd,
    });
    setBookOpen(true);
  }

  if (!settings) {
    return <p className="text-zinc-500">Loading…</p>;
  }

  const slotStepMin = settings.appointmentSlotStepMin;

  const todayBtn = () => setCursor(new Date());

  const nav = (dir: -1 | 1) => {
    const x = new Date(cursor);
    if (calView === "day") x.setDate(x.getDate() + dir);
    else if (calView === "week") x.setDate(x.getDate() + dir * 7);
    else x.setMonth(x.getMonth() + dir);
    setCursor(x);
  };

  function slotMatch(a: AppointmentRow, dayKey: string, slotStart: number): boolean {
    const d = new Date(a.startsAt);
    if (dateKey(d) !== dayKey) return false;
    const m = d.getHours() * 60 + d.getMinutes();
    return m >= slotStart && m < slotStart + slotStepMin;
  }

  return (
    <div className="space-y-4 max-w-[1600px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Appointments</h1>
        {canWrite && (
          <button type="button" onClick={() => { setEditAppt(null); setPrefill(null); setBookOpen(true); }} className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium">
            Book appointment
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {(["calendar", "list", "queue"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px ${
              tab === t ? "border-accent text-accent" : "border-transparent text-zinc-500"
            }`}
          >
            {t === "calendar" ? "Calendar" : t === "list" ? "List" : "Today's queue"}
          </button>
        ))}
      </div>

      {tab === "calendar" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={todayBtn} className="rounded-lg border px-3 py-1.5 text-sm">
              Today
            </button>
            <button type="button" onClick={() => nav(-1)} className="rounded-lg border px-2 py-1.5 text-sm">
              ←
            </button>
            <button type="button" onClick={() => nav(1)} className="rounded-lg border px-2 py-1.5 text-sm">
              →
            </button>
            <span className="text-sm text-zinc-600">{cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
            <select value={calView} onChange={(e) => setCalView(e.target.value as CalView)} className="rounded-lg border px-2 py-1.5 text-sm ml-2">
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="rounded-lg border px-2 py-1.5 text-sm flex-1 min-w-[180px] max-w-xs"
            >
              <option value="">All doctors</option>
              {doctorOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {calView === "month" && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 overflow-x-auto">
              <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1 text-zinc-500">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              {(() => {
                const y = cursor.getFullYear();
                const m = cursor.getMonth();
                const first = new Date(y, m, 1);
                const startPad = first.getDay();
                const daysInMonth = new Date(y, m + 1, 0).getDate();
                const cells: (number | null)[] = [];
                for (let i = 0; i < startPad; i++) cells.push(null);
                for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                while (cells.length % 7 !== 0) cells.push(null);
                return (
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((d, i) => {
                      if (d === null) return <div key={i} className="h-14" />;
                      const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                      const n = monthCounts[key] ?? 0;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setCalView("day");
                            setCursor(new Date(y, m, d));
                          }}
                          className="h-14 rounded border border-zinc-200 dark:border-zinc-700 text-sm p-1 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                          <div>{d}</div>
                          {n > 0 && <div className="text-xs font-semibold text-accent">{n} appt</div>}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {calView === "day" && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-[80px_1fr] text-sm">
                <div className="bg-zinc-50 dark:bg-zinc-800/80 p-2 font-medium border-b">{dateKey(cursor)}</div>
                <div className="bg-zinc-50 dark:bg-zinc-800/80 p-2 font-medium border-b">Appointments</div>
                {slots.map((sm) => {
                  const dk = dateKey(cursor);
                  const inSlot = rangeAppts.filter((a) => slotMatch(a, dk, sm));
                  return (
                    <div key={sm} className="contents">
                      <div className="border-t border-zinc-200 dark:border-zinc-700 p-2 text-xs text-zinc-500 tabular-nums">{minutesToLabel(sm)}</div>
                      <div className="border-t border-zinc-200 dark:border-zinc-700 p-1 min-h-[48px] space-y-1">
                        {inSlot.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setDetail(a)}
                            className={`block w-full text-left rounded px-2 py-1 text-xs border ${statusColorClass(a.status)}`}
                          >
                            {a.patientName} · {a.appointmentType}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {calView === "week" && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
              <div className="grid gap-px min-w-[900px]" style={{ gridTemplateColumns: `80px repeat(6, 1fr)` }}>
                <div className="bg-zinc-100 dark:bg-zinc-800 p-1 text-xs" />
                {weekMonToSat(cursor).map((d) => (
                  <div key={dateKey(d)} className="bg-zinc-100 dark:bg-zinc-800 p-1 text-xs text-center font-medium">
                    {d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}
                  </div>
                ))}
                {slots.map((sm) => (
                  <div key={sm} className="contents">
                    <div className="border-t border-zinc-200 p-1 text-[10px] text-zinc-500">{minutesToLabel(sm)}</div>
                    {weekMonToSat(cursor).map((day) => {
                      const dk = dateKey(day);
                      const inSlot = rangeAppts.filter((a) => slotMatch(a, dk, sm));
                      return (
                        <div key={`${dk}-${sm}`} className="border-t border-zinc-200 dark:border-zinc-700 p-0.5 min-h-[40px] space-y-0.5">
                          {inSlot.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => setDetail(a)}
                              className={`block w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight border ${statusColorClass(a.status)}`}
                            >
                              {a.patientName}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "list" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-sm">
              <span className="text-xs text-zinc-500">Search</span>
              <input value={listQ} onChange={(e) => setListQ(e.target.value)} className="mt-0.5 block rounded-lg border px-2 py-1.5 text-sm" placeholder="Name / phone" />
            </label>
            <label className="text-sm">
              <span className="text-xs text-zinc-500">Status</span>
              <select value={listStatus} onChange={(e) => setListStatus(e.target.value)} className="mt-0.5 block rounded-lg border px-2 py-1.5 text-sm">
                <option value="all">All</option>
                <option value="booked">Booked</option>
                <option value="checked_in">Checked In</option>
                <option value="consultation_done">Consultation Done</option>
                <option value="completed">Completed</option>
                <option value="no_show">No Show</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="text-xs text-zinc-500">Type</span>
              <select value={listType} onChange={(e) => setListType(e.target.value)} className="mt-0.5 block rounded-lg border px-2 py-1.5 text-sm">
                <option value="all">All</option>
                {["Eye Checkup", "Follow-up", "Contact Lens Fitting", "Post-surgery", "Glasses Collection", "Other"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-xs text-zinc-500">Doctor</span>
              <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} className="mt-0.5 block rounded-lg border px-2 py-1.5 text-sm min-w-[160px]">
                <option value="">All</option>
                {doctorOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm mt-5">
              <input type="checkbox" checked={listToday} onChange={(e) => { setListToday(e.target.checked); }} />
              Today only
            </label>
            {!listToday && (
              <>
                <input type="date" value={listDateFrom} onChange={(e) => setListDateFrom(e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm" />
                <input type="date" value={listDateTo} onChange={(e) => setListDateTo(e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm" />
              </>
            )}
            <button type="button" onClick={() => void loadList()} className="rounded-lg bg-zinc-200 dark:bg-zinc-700 px-3 py-1.5 text-sm">
              Apply
            </button>
          </div>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm text-left min-w-[900px]">
              <thead className="bg-zinc-50 dark:bg-zinc-800/80">
                <tr>
                  <th className="px-2 py-2">Time</th>
                  <th className="px-2 py-2">Patient</th>
                  <th className="px-2 py-2">Phone</th>
                  <th className="px-2 py-2">Doctor</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 w-64">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listRows.map((a) => (
                  <tr key={a.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-2 py-2 whitespace-nowrap text-xs">{new Date(a.startsAt).toLocaleString()}</td>
                    <td className="px-2 py-2">{a.patientName}</td>
                    <td className="px-2 py-2">{a.patientPhone}</td>
                    <td className="px-2 py-2">{a.doctorDisplayName}</td>
                    <td className="px-2 py-2">{a.appointmentType}</td>
                    <td className="px-2 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColorClass(a.status)}`}>{STATUS_LABEL[a.status]}</span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        {quickNextStatuses(a.status).map((s) => (
                          <button key={s} type="button" onClick={() => void handleStatus(a, s)} className="text-[10px] rounded border px-1.5 py-0.5">
                            {STATUS_LABEL[s]}
                          </button>
                        ))}
                        {canWrite && (
                          <>
                            <button type="button" onClick={() => setDetail(a)} className="text-[10px] rounded border px-1.5 py-0.5">
                              Open
                            </button>
                            <button type="button" onClick={() => openReminder(a)} className="text-[10px] rounded border px-1.5 py-0.5">
                              Reminder
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {listRows.length === 0 && <p className="p-4 text-zinc-500 text-sm">No appointments</p>}
          </div>
        </div>
      )}

      {tab === "queue" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
          {queueRows.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="font-mono text-xs w-36">{new Date(a.startsAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
              <span className="font-medium flex-1 min-w-[120px]">{a.patientName}</span>
              <span className="text-zinc-500">{a.appointmentType}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${statusColorClass(a.status)}`}>{STATUS_LABEL[a.status]}</span>
              <div className="flex flex-wrap gap-1">
                {quickNextStatuses(a.status).map((s) => (
                  <button key={s} type="button" onClick={() => void handleStatus(a, s)} className="text-xs rounded border px-2 py-0.5">
                    {STATUS_LABEL[s]}
                  </button>
                ))}
                <button type="button" onClick={() => setDetail(a)} className="text-xs rounded border px-2 py-0.5">
                  Detail
                </button>
                <button type="button" onClick={() => openReminder(a)} className="text-xs rounded border px-2 py-0.5">
                  Reminder
                </button>
              </div>
            </div>
          ))}
          {queueRows.length === 0 && (
            <div className="p-8 text-center text-zinc-600 dark:text-zinc-400 space-y-2">
              <p className="text-3xl mb-2" aria-hidden>
                📅
              </p>
              <p className="font-medium text-zinc-800 dark:text-zinc-200">No appointments today.</p>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => {
                    setEditAppt(null);
                    setPrefill(null);
                    setBookOpen(true);
                  }}
                  className="text-accent text-sm font-medium hover:underline"
                >
                  Book one now →
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-zinc-500 px-3 py-2">Auto-refreshes every 60 seconds.</p>
        </div>
      )}

      <AppointmentBookingModal
        open={bookOpen}
        onClose={() => { setBookOpen(false); setEditAppt(null); setPrefill(null); }}
        onSaved={() => {
          loadList();
          loadQueue();
          loadRange();
          loadMonthCounts();
        }}
        settings={settings}
        edit={editAppt}
        prefill={prefill}
      />

      <AppointmentDetailModal
        appointment={detail}
        open={detail !== null}
        onClose={() => setDetail(null)}
        onChangeStatus={async (status) => {
          if (!detail) return;
          await handleStatus(detail, status);
        }}
        onEdit={(a) => { setEditAppt(a); setBookOpen(true); }}
        onSendReminder={(a) => openReminder(a)}
        onBookFollowUp={followUpFrom}
      />

      <SendReminderModal
        open={reminder !== null}
        onClose={() => setReminder(null)}
        whatsappText={reminder && settings.reminderWhatsappTemplate ? fillReminderTemplate(settings.reminderWhatsappTemplate, reminder) : reminder ? `Hi ${reminder.patientName}, reminder: ${new Date(reminder.startsAt).toLocaleString()}` : ""}
        smsText={reminder && settings.reminderSmsTemplate ? fillReminderTemplate(settings.reminderSmsTemplate, reminder) : reminder ? `Hi ${reminder.patientName}, reminder: ${new Date(reminder.startsAt).toLocaleString()}` : ""}
      />

      {loading && <p className="text-xs text-zinc-500">Loading…</p>}
    </div>
  );
}
