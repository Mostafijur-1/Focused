/* Focused Web Push Service Worker. No private API response is cached here. */
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
