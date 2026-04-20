import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "staff";
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (document.querySelector("[data-shortcuts-block]")) return;
      const t = e.target as HTMLElement;
      if (t.closest("[data-no-shortcuts]")) return;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) {
        if (e.key === "/" && t.tagName !== "INPUT") {
          e.preventDefault();
          const el = document.querySelector<HTMLInputElement>("[data-search-input]");
          el?.focus();
        }
        return;
      }

      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>("[data-search-input]")?.focus();
        return;
      }
      if (!canWrite) return;
      const k = e.key.toLowerCase();
      if (k === "n") {
        e.preventDefault();
        navigate("/patients/new");
      } else if (k === "r") {
        e.preventDefault();
        navigate("/prescriptions/new");
      } else if (k === "o") {
        e.preventDefault();
        navigate("/orders/new");
      } else if (k === "a") {
        e.preventDefault();
        navigate("/appointments?tab=calendar");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, canWrite]);

  return { helpOpen, setHelpOpen };
}
