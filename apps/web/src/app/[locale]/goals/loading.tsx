export default function Loading() {
  return (
    <div
      className="mx-auto max-w-7xl animate-pulse space-y-6 px-4 py-10"
      aria-busy="true"
      aria-label="Goals loading"
    >
      <div className="bg-muted h-10 w-64 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-muted h-56 rounded-2xl" />
        <div className="bg-muted h-56 rounded-2xl" />
      </div>
    </div>
  );
}
