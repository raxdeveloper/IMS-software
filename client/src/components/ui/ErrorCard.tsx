type Props = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export function ErrorCard({ title = "Something went wrong", message, onRetry }: Props) {
  return (
    <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-900 dark:text-red-100">
      <p className="font-medium">{title}</p>
      <p className="mt-1 opacity-90">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-red-700 text-white px-3 py-1.5 text-xs font-medium hover:bg-red-800">
          Try again
        </button>
      )}
    </div>
  );
}
