export function PageSkeleton() {
  return (
    <div className="space-y-4 max-w-4xl" aria-hidden>
      <div className="h-8 w-48 rounded-md skeleton-bar" />
      <div className="h-32 rounded-xl skeleton-bar" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg skeleton-bar" />
        ))}
      </div>
    </div>
  );
}
