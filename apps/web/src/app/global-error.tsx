"use client";

export default function GlobalError({ reset }: { readonly reset: () => void }) {
  return (
    <html lang="bn-BD">
      <body>
        <main
          style={{
            display: "grid",
            minHeight: "100vh",
            placeItems: "center",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div>
            <h1>কিছু একটা ঠিকমতো কাজ করেনি</h1>
            <p>আপনার তথ্য নিরাপদ আছে। একটু পর আবার চেষ্টা করুন।</p>
            <button type="button" onClick={reset}>
              আবার চেষ্টা করুন
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
