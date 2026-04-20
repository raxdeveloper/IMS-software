import { Link, NavLink, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import { useGlobalShortcuts } from "../../hooks/useGlobalShortcuts";
import { OfflineBanner } from "../pwa/OfflineBanner";
import { InstallPrompt } from "../pwa/InstallPrompt";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium transition-shadow ${
    isActive
      ? "bg-accent text-accent-foreground shadow-[0_0_20px_-4px_rgba(0,255,157,0.55)]"
      : "text-zinc-700 dark:text-ims-muted hover:bg-zinc-100 dark:hover:bg-white/5 dark:hover:text-zinc-100"
  }`;

export function AppShell() {
  const { user, logout } = useAuth();
  const { mode, toggle } = useTheme();
  const { helpOpen, setHelpOpen } = useGlobalShortcuts();

  return (
    <div className="min-h-dvh flex flex-col bg-zinc-50 text-zinc-900 dark:bg-ims-base dark:text-zinc-100">
      <OfflineBanner />
      <div className="flex flex-1 min-h-0">
        <aside className="no-print hidden md:flex w-56 flex-col border-r border-zinc-200 dark:border-accent/15 bg-white dark:bg-ims-surface dark:backdrop-blur-md dark:shadow-[inset_-1px_0_0_0_rgba(0,255,157,0.06)] p-4 gap-4 shrink-0">
          <div className="font-semibold text-accent drop-shadow-[0_0_12px_rgba(0,255,157,0.35)]">Ophthalmic IMS</div>
          <nav className="flex flex-col gap-1">
            <NavLink to="/" end className={navClass}>
              Dashboard
            </NavLink>
            <NavLink to="/patients" className={navClass}>
              Patients
            </NavLink>
            <NavLink to="/frames" className={navClass}>
              Frames
            </NavLink>
            <NavLink to="/lenses" className={navClass}>
              Lenses
            </NavLink>
            <NavLink to="/appointments" className={navClass}>
              Appointments
            </NavLink>
            <NavLink to="/orders" className={navClass}>
              Orders
            </NavLink>
            <NavLink to="/reports" className={navClass}>
              Reports
            </NavLink>
            <NavLink to="/settings" className={navClass}>
              Settings
            </NavLink>
            <NavLink to="/admin/health" className={navClass}>
              Health
            </NavLink>
          </nav>
          <div className="mt-auto pt-4 border-t border-zinc-200 dark:border-white/10 text-xs text-zinc-500 dark:text-ims-muted">
            <div className="mb-2 truncate">{user?.name}</div>
            <div className="capitalize mb-2">{user?.role}</div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => toggle()}
                className="text-left rounded hover:bg-zinc-100 dark:hover:bg-white/5 px-1 py-0.5"
              >
                {mode === "dark" ? "Light mode" : "Dark mode"}
              </button>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="text-left rounded hover:bg-zinc-100 dark:hover:bg-white/5 px-1 py-0.5"
              >
                Keyboard help (?)
              </button>
              <button
                type="button"
                onClick={() => logout()}
                className="text-left rounded hover:bg-zinc-100 dark:hover:bg-white/5 px-1 py-0.5"
              >
                Sign out
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <header className="no-print md:hidden flex items-center justify-between border-b border-zinc-200 dark:border-accent/15 bg-white dark:bg-ims-surface/90 px-4 py-3">
            <span className="font-semibold text-accent">Ophthalmic IMS</span>
            <div className="flex gap-2">
              <Link to="/patients" className="text-sm text-accent">
                Patients
              </Link>
              <Link to="/frames" className="text-sm text-accent">
                Frames
              </Link>
              <Link to="/lenses" className="text-sm text-accent">
                Lenses
              </Link>
              <button type="button" onClick={() => toggle()} className="text-sm">
                {mode === "dark" ? "Light" : "Dark"}
              </button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-x-auto min-h-0">
            <Outlet />
          </main>
        </div>
      </div>

      {helpOpen && (
        <div
          data-shortcuts-block
          className="no-print fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="bg-white dark:bg-ims-surface rounded-xl border border-zinc-200 dark:border-accent/20 max-w-md w-full p-5 text-sm shadow-xl dark:shadow-[0_0_40px_-10px_rgba(0,255,157,0.15)]"
            onClick={(e) => e.stopPropagation()}
            data-no-shortcuts
          >
            <h2 className="font-semibold text-base mb-3">Keyboard shortcuts</h2>
            <ul className="space-y-2 text-zinc-700 dark:text-zinc-300">
              <li>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">N</kbd> New patient
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">R</kbd> New prescription
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">O</kbd> New order
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">A</kbd> Appointments
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">/</kbd> Focus search
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">?</kbd> This help
              </li>
            </ul>
            <button
              type="button"
              className="mt-4 w-full rounded-lg border py-2 text-sm"
              onClick={() => setHelpOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <InstallPrompt />
      <Toaster
        richColors
        position="top-right"
        duration={4000}
        closeButton
        className="no-print"
        toastOptions={{
          classNames: {
            toast: "dark:bg-ims-surface dark:border-accent/20 dark:text-zinc-100",
            description: "dark:text-ims-muted",
          },
        }}
      />
    </div>
  );
}
