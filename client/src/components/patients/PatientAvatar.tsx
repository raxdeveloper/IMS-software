import { resolvePublicUrl } from "../../lib/apiOrigin";
import { initials } from "../../lib/patientUtils";

type Props = {
  photoUrl: string | null | undefined;
  firstName: string;
  lastName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  strike?: boolean;
};

const sizeCls = { sm: "h-9 w-9 text-xs", md: "h-12 w-12 text-sm", lg: "h-24 w-24 text-2xl" };

export function PatientAvatar({ photoUrl, firstName, lastName, size = "md", className = "", strike }: Props) {
  const src = (() => {
    if (!photoUrl) return "";
    if (photoUrl.startsWith("http")) return photoUrl;
    return resolvePublicUrl(photoUrl) ?? photoUrl;
  })();
  return (
    <div
      className={`relative inline-flex shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700 items-center justify-center font-semibold text-zinc-700 dark:text-zinc-200 overflow-hidden ${sizeCls[size]} ${className}`}
    >
      {src ? (
        <img src={src} alt="" className={`h-full w-full object-cover ${strike ? "opacity-60" : ""}`} />
      ) : (
        <span className={strike ? "line-through text-zinc-500" : ""}>{initials(firstName, lastName)}</span>
      )}
    </div>
  );
}
