export default function Loading() {
  return (
    <main
      className="bg-background grid min-h-svh place-items-center px-6"
      aria-busy="true"
    >
      <div className="text-center">
        <span
          className="focused-brand-gradient mx-auto block size-10 animate-pulse rounded-xl motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p className="text-muted-foreground mt-4 text-sm">
          পাতাটি প্রস্তুত হচ্ছে…
        </p>
      </div>
    </main>
  );
}
