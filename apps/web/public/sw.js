/* Focused Web Push Service Worker. No private route or API response is cached. */
const PUBLIC_CACHE = "focused-public-v1";
const PUBLIC_FALLBACKS = [
  "/bn-BD",
  "/en",
  "/icon.svg",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(PUBLIC_CACHE).then(async (cache) => {
        const results = await Promise.allSettled(
          PUBLIC_FALLBACKS.map(async (path) => {
            const response = await fetch(path, { cache: "reload" });
            if (response.ok) await cache.put(path, response);
          }),
        );
        if (results.every((result) => result.status === "rejected")) {
          throw new Error("No public offline fallback could be cached.");
        }
      }),
      self.skipWaiting(),
    ]),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("focused-public-") && key !== PUBLIC_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(async () => {
      const requestedUrl = new URL(request.url);
      const localeFallback = requestedUrl.pathname.startsWith("/en")
        ? "/en"
        : "/bn-BD";
      return (await caches.match(localeFallback)) ?? Response.error();
    }),
  );
});

self.addEventListener("push", (event) => {
  const fallback = {
    title: "Focused",
    body: "You have a new notification.",
    notificationId: "unknown",
    deepLink: "/bn-BD/notifications",
    locale: "bn-BD",
  };
  let payload = fallback;
  try {
    const candidate = event.data ? event.data.json() : fallback;
    if (candidate && typeof candidate === "object")
      payload = { ...fallback, ...candidate };
  } catch {
    payload = fallback;
  }
  const safeLink =
    typeof payload.deepLink === "string" &&
    (payload.deepLink.startsWith("/bn-BD/") ||
      payload.deepLink.startsWith("/en/"))
      ? payload.deepLink
      : "/bn-BD/notifications";
  event.waitUntil(
    self.registration.showNotification(String(payload.title).slice(0, 80), {
      body: String(payload.body).slice(0, 140),
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: `focused-${String(payload.notificationId).slice(0, 64)}`,
      renotify: false,
      data: { deepLink: safeLink },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const deepLink = event.notification.data?.deepLink || "/bn-BD/notifications";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(deepLink);
            return client.focus();
          }
        }
        return self.clients.openWindow(deepLink);
      }),
  );
});
