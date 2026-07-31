"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";

import { AuthApiError, authFetch } from "./auth-api";
import { getAuthCopy } from "./auth-copy";
import { useAuth } from "./auth-provider";

interface SessionItem {
  readonly id: string;
  readonly status: "ACTIVE" | "REVOKED" | "EXPIRED";
  readonly deviceName: string | null;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly current: boolean;
}

export function SecuritySessions({ locale }: { readonly locale: Locale }) {
  const copy = getAuthCopy(locale);
  const auth = useAuth();
  const [sessions, setSessions] = useState<readonly SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth.session) return;
    setLoading(true);
    setError(null);
    try {
      const result = await authFetch<{ data: readonly SessionItem[] }>(
        "/api/v1/users/me/sessions",
        {},
        auth.session.accessToken,
      );
      setSessions(result.data);
    } catch (requestError) {
      setError(
        requestError instanceof AuthApiError
          ? requestError.message
          : copy.unexpected,
      );
    } finally {
      setLoading(false);
    }
  }, [auth.session, copy.unexpected]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [auth.status, load]);

  if (auth.status === "loading") {
    return <p role="status">{copy.loadingSessions}</p>;
  }
  if (!auth.session) {
    return (
      <div className="text-center">
        <p>{copy.sessionExpired}</p>
        <Link
          href={`/${locale}/sign-in`}
          className="bg-primary text-primary-foreground mt-4 inline-flex h-11 items-center rounded-xl px-5 font-semibold"
        >
          {copy.signIn}
        </Link>
      </div>
    );
  }

  async function revoke(sessionId: string) {
    if (!auth.session) return;
    setError(null);
    try {
      await authFetch(
        `/api/v1/users/me/sessions/${sessionId}`,
        { method: "DELETE" },
        auth.session.accessToken,
      );
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof AuthApiError
          ? requestError.message
          : copy.unexpected,
      );
    }
  }

  async function revokeOthers() {
    if (!auth.session) return;
    setError(null);
    try {
      await authFetch(
        "/api/v1/users/me/sessions/logout-all",
        { method: "POST" },
        auth.session.accessToken,
      );
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof AuthApiError
          ? requestError.message
          : copy.unexpected,
      );
    }
  }

  return (
    <section aria-labelledby="security-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 id="security-title" className="text-3xl font-bold tracking-tight">
            {copy.securityTitle}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            {copy.securityDescription}
          </p>
        </div>
        <Button variant="outline" onClick={() => void revokeOthers()}>
          {copy.revokeOthers}
        </Button>
      </div>
      {error ? (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive mt-5 rounded-xl p-3"
        >
          {error}
        </p>
      ) : null}
      {loading ? (
        <p role="status" className="mt-6">
          {copy.loadingSessions}
        </p>
      ) : null}
      {!loading && sessions.length === 0 ? (
        <Card className="text-muted-foreground mt-6 p-6">
          {copy.noSessions}
        </Card>
      ) : null}
      <div className="mt-6 grid gap-3">
        {sessions.map((session) => (
          <Card
            key={session.id}
            className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">
                  {session.deviceName ?? "Browser"}
                </h2>
                {session.current ? (
                  <span className="bg-success/10 text-success rounded-full px-2 py-1 text-xs font-semibold">
                    {copy.currentSession}
                  </span>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(session.lastSeenAt))}
              </p>
            </div>
            {session.current ? (
              <Button variant="outline" onClick={() => void auth.signOut()}>
                {copy.revoke}
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => void revoke(session.id)}
              >
                {copy.revoke}
              </Button>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}
