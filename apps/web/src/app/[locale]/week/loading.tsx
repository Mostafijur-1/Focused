export default function Loading() {
  return (
    <div
      className="mx-auto max-w-5xl animate-pulse space-y-5 px-4 py-10"
      aria-busy="true"
      aria-label="Weekly Plan loading"
    >
      <div className="bg-muted h-10 w-72 rounded-xl" />
      <div className="bg-muted h-[34rem] rounded-2xl" />
    </div>
  );
}
