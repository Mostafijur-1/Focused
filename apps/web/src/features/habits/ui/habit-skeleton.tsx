export function HabitSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-8 motion-reduce:animate-none">
      <div className="bg-muted h-4 w-28 rounded" />
      <div className="bg-muted mt-4 h-10 max-w-xl rounded" />
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="border-border bg-card h-64 rounded-2xl border"
          />
        ))}
      </div>
      <span className="sr-only">Loading habits</span>
    </div>
  );
}
