export default function NotificationsLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-8" role="status">
      <span className="sr-only">Notification প্রস্তুত হচ্ছে…</span>
      <div className="bg-muted h-10 w-72 animate-pulse rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div key={key} className="bg-muted h-20 animate-pulse rounded-2xl" />
        ))}
      </div>
      <div className="bg-muted h-96 animate-pulse rounded-2xl" />
    </div>
  );
}
