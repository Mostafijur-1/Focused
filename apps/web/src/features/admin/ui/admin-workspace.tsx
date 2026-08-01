"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  Flag,
  HeartPulse,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  AdminAuditEventView,
  AdminApprovalView,
  AdminCaseView,
  AdminFeatureFlagView,
  AdminHealthView,
  AdminJobView,
  AdminMemberView,
  AdminOverview,
} from "@/features/admin/domain/admin-types";
import type {
  AdminMfaEnrollment,
  AdminMfaState,
  AdminStepUpScope,
} from "@/features/admin/domain/admin-security-types";
import { adminReasonCodes } from "@/features/admin/domain/admin-types";
import { AuthApiError, authFetch } from "@/features/auth/ui/auth-api";
import { useAuth } from "@/features/auth/ui/auth-provider";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

import { getAdminCopy } from "./admin-copy";

const mfaCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/u) });
const caseSchema = z.object({
  reasonCode: z.enum(adminReasonCodes),
  summary: z.string().trim().min(12).max(300),
  externalReference: z.string().trim().max(160).optional(),
  durationMinutes: z.number().int().min(15).max(480),
});
const searchSchema = z.object({
  identifier: z.string().trim().min(3).max(320),
});
const stepUpSchema = z.object({
  code: z.string().regex(/^\d{6}$/u),
  password: z.string().max(256).optional(),
});
const roleChangeSchema = z.object({
  targetUserId: z.uuid(),
  roleKey: z.enum([
    "support-administrator",
    "platform-administrator",
    "content-curator",
    "auditor",
  ]),
  operation: z.enum(["GRANT", "REVOKE"]),
  expectedUserVersion: z.number().int().positive(),
});

type SensitiveAction =
  | {
      readonly kind: "status";
      readonly member: AdminMemberView;
      readonly status: "ACTIVE" | "SUSPENDED";
    }
  | { readonly kind: "sessions"; readonly member: AdminMemberView }
  | { readonly kind: "flag"; readonly flag: AdminFeatureFlagView }
  | { readonly kind: "job"; readonly job: AdminJobView }
  | {
      readonly kind: "role_request";
      readonly request: z.infer<typeof roleChangeSchema>;
    }
  | { readonly kind: "role_approve"; readonly approval: AdminApprovalView };

type CaseFormValues = z.infer<typeof caseSchema>;
type SearchFormValues = z.infer<typeof searchSchema>;

export function AdminWorkspace({ locale }: { readonly locale: Locale }) {
  const copy = getAdminCopy(locale);
  const auth = useAuth();
  const permitted = Boolean(
    auth.session?.user.permissions.includes("admin:access"),
  );
  const [mfa, setMfa] = useState<AdminMfaState | null>(null);
  const [enrollment, setEnrollment] = useState<AdminMfaEnrollment | null>(null);
  const [cases, setCases] = useState<readonly AdminCaseView[]>([]);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [health, setHealth] = useState<AdminHealthView | null>(null);
  const [flags, setFlags] = useState<readonly AdminFeatureFlagView[]>([]);
  const [audit, setAudit] = useState<readonly AdminAuditEventView[]>([]);
  const [jobs, setJobs] = useState<readonly AdminJobView[]>([]);
  const [approvals, setApprovals] = useState<readonly AdminApprovalView[]>([]);
  const [member, setMember] = useState<AdminMemberView | null>(null);
  const [searched, setSearched] = useState(false);
  const [action, setAction] = useState<SensitiveAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const mfaForm = useForm<z.infer<typeof mfaCodeSchema>>({
    resolver: zodResolver(mfaCodeSchema),
  });
  const caseForm = useForm<z.infer<typeof caseSchema>>({
    resolver: zodResolver(caseSchema),
    defaultValues: {
      reasonCode: "ACCOUNT_ACCESS",
      summary: "",
      externalReference: "",
      durationMinutes: 60,
    },
  });
  const searchForm = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
  });
  const stepForm = useForm<z.infer<typeof stepUpSchema>>({
    resolver: zodResolver(stepUpSchema),
  });
  const roleForm = useForm<z.infer<typeof roleChangeSchema>>({
    resolver: zodResolver(roleChangeSchema),
    defaultValues: { roleKey: "support-administrator", operation: "GRANT" },
  });

  const call = useCallback(
    async <T,>(path: string, init: RequestInit = {}) => {
      if (!auth.session) throw new Error("Authentication required.");
      const response = await authFetch<{ data: T }>(
        path,
        init,
        auth.session.accessToken,
      );
      return response.data;
    },
    [auth.session],
  );

  const loadMfa = useCallback(async () => {
    if (!permitted) return;
    const state = await call<AdminMfaState>("/api/v1/admin/mfa");
    setMfa(state);
  }, [call, permitted]);

  const loadCases = useCallback(async () => {
    const result = await call<readonly AdminCaseView[]>("/api/v1/admin/cases");
    setCases(result);
    const active = result.find(
      (item) => item.status === "OPEN" && new Date(item.expiresAt) > new Date(),
    );
    setCaseId((current) => current ?? active?.id ?? null);
  }, [call]);

  const loadCaseData = useCallback(
    async (activeCaseId: string) => {
      const query = `?caseId=${encodeURIComponent(activeCaseId)}`;
      const [nextOverview, nextHealth, nextFlags, nextAudit] =
        await Promise.all([
          call<AdminOverview>(`/api/v1/admin/overview${query}`),
          call<AdminHealthView>(`/api/v1/admin/health${query}`),
          call<readonly AdminFeatureFlagView[]>(
            `/api/v1/admin/feature-flags${query}`,
          ),
          call<{ items: readonly AdminAuditEventView[] }>(
            `/api/v1/admin/audit-events${query}`,
          ),
        ]);
      setOverview(nextOverview);
      setHealth(nextHealth);
      setFlags(nextFlags);
      setAudit(nextAudit.items);
      if (auth.session?.user.permissions.includes("admin:jobs:read")) {
        setJobs(
          await call<readonly AdminJobView[]>(`/api/v1/admin/jobs${query}`),
        );
      }
      if (auth.session?.user.permissions.includes("admin:roles:read")) {
        setApprovals(
          await call<readonly AdminApprovalView[]>(
            `/api/v1/admin/role-changes${query}`,
          ),
        );
      }
    },
    [auth.session?.user.permissions, call],
  );

  useEffect(() => {
    const task = window.setTimeout(async () => {
      if (auth.status === "anonymous" || !permitted) {
        setLoading(false);
        return;
      }
      if (auth.status !== "authenticated") return;
      try {
        await loadMfa();
      } catch (caught) {
        setError(errorMessage(caught, copy.error));
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(task);
  }, [auth.status, copy.error, loadMfa, permitted]);

  useEffect(() => {
    if (!mfa?.sessionVerified) return;
    const task = window.setTimeout(() => {
      void loadCases().catch((caught) =>
        setError(errorMessage(caught, copy.error)),
      );
    }, 0);
    return () => window.clearTimeout(task);
  }, [copy.error, loadCases, mfa?.sessionVerified]);

  useEffect(() => {
    if (!caseId) return;
    const task = window.setTimeout(() => {
      setLoading(true);
      void loadCaseData(caseId)
        .catch((caught) => setError(errorMessage(caught, copy.error)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(task);
  }, [caseId, copy.error, loadCaseData]);

  async function beginEnrollment() {
    setBusy(true);
    setError(null);
    try {
      const result = await call<AdminMfaEnrollment>(
        "/api/v1/admin/mfa/enrollment",
        { method: "POST" },
      );
      setEnrollment(result);
      setMfa({
        status: "PENDING",
        sessionVerified: false,
        version: result.version,
      });
    } catch (caught) {
      setError(errorMessage(caught, copy.error));
    } finally {
      setBusy(false);
    }
  }

  async function verifyMfa(values: z.infer<typeof mfaCodeSchema>) {
    if (!mfa?.version) return;
    setBusy(true);
    setError(null);
    try {
      const enrollmentVerification = mfa.status === "PENDING";
      await call(
        enrollmentVerification
          ? "/api/v1/admin/mfa/enrollment/verify"
          : "/api/v1/admin/mfa/session/verify",
        {
          method: "POST",
          body: JSON.stringify({
            code: values.code,
            expectedVersion: mfa.version,
          }),
        },
      );
      setEnrollment(null);
      mfaForm.reset();
      await loadMfa();
    } catch (caught) {
      setError(errorMessage(caught, copy.error));
    } finally {
      setBusy(false);
    }
  }

  async function openCase(values: z.infer<typeof caseSchema>) {
    setBusy(true);
    setError(null);
    try {
      const created = await call<AdminCaseView>("/api/v1/admin/cases", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          externalReference: values.externalReference || undefined,
        }),
      });
      setCases((current) => [created, ...current]);
      setCaseId(created.id);
      caseForm.reset();
    } catch (caught) {
      setError(errorMessage(caught, copy.error));
    } finally {
      setBusy(false);
    }
  }

  const findMember = useCallback(
    async (identifier: string) => {
      if (!caseId) return;
      const query = new URLSearchParams({ caseId, identifier });
      const result = await call<AdminMemberView | null>(
        `/api/v1/admin/users?${query}`,
      );
      setMember(result);
      setSearched(true);
    },
    [call, caseId],
  );

  async function submitSearch(values: z.infer<typeof searchSchema>) {
    setBusy(true);
    setError(null);
    try {
      await findMember(values.identifier);
    } catch (caught) {
      setError(errorMessage(caught, copy.error));
    } finally {
      setBusy(false);
    }
  }

  async function runSensitive(values: z.infer<typeof stepUpSchema>) {
    if (!action || !caseId || !mfa?.version) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const binding = actionBinding(action);
      const grant = await call<{ token: string }>("/api/v1/admin/step-up", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          expectedMfaVersion: mfa.version,
          scope: binding.scope,
          targetType: binding.targetType,
          targetId: binding.targetId,
        }),
      });
      const headers = { "x-admin-step-up": grant.token };
      if (action.kind === "status") {
        await call(`/api/v1/admin/users/${action.member.id}/status`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            caseId,
            clientCommandId: crypto.randomUUID(),
            status: action.status,
            expectedVersion: action.member.version,
          }),
        });
        await findMember(action.member.id);
      } else if (action.kind === "sessions") {
        await call(`/api/v1/admin/users/${action.member.id}/sessions/revoke`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            caseId,
            clientCommandId: crypto.randomUUID(),
          }),
        });
        await findMember(action.member.id);
      } else {
        if (action.kind === "job") {
          await call(`/api/v1/admin/jobs/${action.job.id}/retry`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              caseId,
              clientCommandId: crypto.randomUUID(),
              expectedVersion: action.job.version,
            }),
          });
        } else if (action.kind === "role_request") {
          await call("/api/v1/admin/role-changes", {
            method: "POST",
            headers,
            body: JSON.stringify({
              caseId,
              clientCommandId: crypto.randomUUID(),
              ...action.request,
            }),
          });
          roleForm.reset();
        } else if (action.kind === "role_approve") {
          await call(
            `/api/v1/admin/role-changes/${action.approval.id}/approve`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                caseId,
                clientCommandId: crypto.randomUUID(),
                expectedApprovalVersion: action.approval.version,
              }),
            },
          );
        } else {
          const flag = action.flag;
          const audience = isRecord(flag.audience) ? flag.audience : {};
          await call(`/api/v1/admin/feature-flags/${flag.id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              caseId,
              clientCommandId: crypto.randomUUID(),
              expectedVersion: flag.version,
              enabled: !flag.enabled,
              owner: flag.owner,
              purpose: flag.purpose,
              audience,
              reviewAt: flag.reviewAt ?? undefined,
              expiresAt: flag.expiresAt ?? undefined,
              rollbackPlan: flag.rollbackPlan,
            }),
          });
        }
      }
      setAction(null);
      stepForm.reset();
      setNotice(copy.saved);
      await Promise.all([loadMfa(), loadCaseData(caseId)]);
    } catch (caught) {
      setError(errorMessage(caught, copy.error));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !mfa) return <WorkspaceMessage text={copy.loading} />;
  if (auth.status === "anonymous" || !permitted) {
    return (
      <WorkspaceMessage
        title={copy.forbiddenTitle}
        text={copy.forbiddenBody}
        destructive
      />
    );
  }

  if (!mfa?.sessionVerified) {
    return (
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6">
        <PageHeader title={copy.mfaTitle} subtitle={copy.mfaSetup} />
        {error && <Alert text={error} />}
        <Card>
          <CardContent className="space-y-5 pt-6">
            {(mfa?.status === "NOT_ENROLLED" || mfa?.status === "REVOKED") && (
              <Button disabled={busy} onClick={() => void beginEnrollment()}>
                <Fingerprint /> {copy.startMfa}
              </Button>
            )}
            {mfa?.status === "PENDING" && !enrollment && (
              <Button disabled={busy} onClick={() => void beginEnrollment()}>
                {copy.startMfa}
              </Button>
            )}
            {enrollment && (
              <div className="bg-muted space-y-4 rounded-2xl p-4">
                <CodeValue label="Secret" value={enrollment.secret} />
                <div>
                  <p className="mb-2 text-sm font-semibold">{copy.recovery}</p>
                  <div className="grid grid-cols-1 gap-1 font-mono text-sm sm:grid-cols-2">
                    {enrollment.recoveryCodes.map((code) => (
                      <code key={code}>{code}</code>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {(mfa?.status === "PENDING" || mfa?.status === "ACTIVE") && (
              <form
                className="flex flex-col gap-3 sm:flex-row"
                onSubmit={mfaForm.handleSubmit(verifyMfa)}
              >
                <label className="flex-1 text-sm font-medium">
                  {copy.code}
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    {...mfaForm.register("code")}
                  />
                </label>
                <Button className="sm:self-end" type="submit" disabled={busy}>
                  <ShieldCheck />{" "}
                  {mfa.status === "PENDING"
                    ? copy.verifyMfa
                    : copy.verifySession}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-6 lg:px-8">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <p className="border-primary/30 bg-primary/5 rounded-2xl border p-4 text-sm">
        {copy.privacy}
      </p>
      {error && <Alert text={error} />}
      {notice && <Alert text={notice} success />}

      <CasePanel
        copy={copy}
        cases={cases}
        caseId={caseId}
        busy={busy}
        form={caseForm}
        onSelect={setCaseId}
        onSubmit={openCase}
      />

      {caseId && overview && (
        <>
          <section aria-labelledby="admin-overview-title">
            <h2 id="admin-overview-title" className="mb-3 text-xl font-bold">
              {copy.overview}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label={copy.accounts}
                value={overview.accounts.total}
                icon={Users}
              />
              <Metric
                label={copy.activeSessions}
                value={overview.activeSessions}
                icon={ShieldCheck}
              />
              <Metric
                label={copy.queuedJobs}
                value={overview.operations.queuedJobs}
                icon={HeartPulse}
              />
              <Metric
                label={copy.failedOperations}
                value={
                  overview.operations.failedJobs +
                  overview.operations.failedDeliveries +
                  overview.operations.failedAiRuns
                }
                icon={AlertTriangle}
              />
            </div>
          </section>

          <HealthPanel copy={copy} health={health} />

          {auth.session?.user.permissions.includes(
            "admin:users:read:metadata",
          ) && (
            <MemberPanel
              copy={copy}
              form={searchForm}
              busy={busy}
              member={member}
              searched={searched}
              onSearch={submitSearch}
              onAction={setAction}
            />
          )}

          <FeatureFlagPanel
            copy={copy}
            flags={flags}
            canWrite={Boolean(
              auth.session?.user.permissions.includes(
                "admin:feature_flags:write",
              ),
            )}
            onAction={(flag) => setAction({ kind: "flag", flag })}
          />
          {auth.session?.user.permissions.includes("admin:jobs:read") && (
            <JobPanel
              jobs={jobs}
              canRetry={Boolean(
                auth.session.user.permissions.includes("admin:jobs:retry"),
              )}
              onRetry={(job) => setAction({ kind: "job", job })}
            />
          )}
          {auth.session?.user.permissions.includes("admin:roles:read") && (
            <RolePanel
              form={roleForm}
              approvals={approvals}
              canWrite={Boolean(
                auth.session.user.permissions.includes("admin:roles:write"),
              )}
              onRequest={(request) =>
                setAction({ kind: "role_request", request })
              }
              onApprove={(approval) =>
                setAction({ kind: "role_approve", approval })
              }
            />
          )}
          <AuditPanel copy={copy} events={audit} />
        </>
      )}

      {action && (
        <Card className="border-primary/40 fixed inset-x-3 bottom-24 z-50 mx-auto max-w-lg shadow-2xl md:bottom-6">
          <CardHeader>
            <CardTitle>{copy.stepUpTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={stepForm.handleSubmit(runSensitive)}
            >
              <label className="block text-sm font-medium">
                {copy.code}
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  {...stepForm.register("code")}
                />
              </label>
              <label className="block text-sm font-medium">
                {copy.password}
                <Input
                  type="password"
                  autoComplete="current-password"
                  {...stepForm.register("password")}
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAction(null)}>
                  {copy.cancel}
                </Button>
                <Button type="submit" disabled={busy}>
                  {copy.confirm}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function PageHeader({
  title,
  subtitle,
}: {
  readonly title: string;
  readonly subtitle: string;
}) {
  return (
    <header>
      <p className="text-foreground text-xs font-bold tracking-[0.18em] uppercase">
        FocusOS Control Plane
      </p>
      <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="text-muted-foreground mt-2 max-w-3xl">{subtitle}</p>
    </header>
  );
}

function WorkspaceMessage({
  title,
  text,
  destructive = false,
}: {
  readonly title?: string;
  readonly text: string;
  readonly destructive?: boolean;
}) {
  return (
    <main className="grid min-h-[70svh] place-items-center p-5">
      <Card className={cn("max-w-lg", destructive && "border-destructive/40")}>
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          <CardDescription>{text}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

function Alert({
  text,
  success = false,
}: {
  readonly text: string;
  readonly success?: boolean;
}) {
  return (
    <div
      role={success ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-xl border p-3 text-sm",
        success
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-destructive/40 bg-destructive/10",
      )}
    >
      {success ? <CheckCircle2 /> : <AlertTriangle />}
      <span>{text}</span>
    </div>
  );
}

function CodeValue({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <code
        className="mt-1 block overflow-x-auto rounded-lg bg-black/10 p-2 text-sm"
        tabIndex={0}
      >
        {value}
      </code>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  readonly label: string;
  readonly value: number;
  readonly icon: typeof Users;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-6">
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="text-3xl font-black tabular-nums">{value}</p>
        </div>
        <Icon className="text-primary size-6" aria-hidden="true" />
      </CardContent>
    </Card>
  );
}

function CasePanel({
  copy,
  cases,
  caseId,
  busy,
  form,
  onSelect,
  onSubmit,
}: {
  readonly copy: ReturnType<typeof getAdminCopy>;
  readonly cases: readonly AdminCaseView[];
  readonly caseId: string | null;
  readonly busy: boolean;
  readonly form: UseFormReturn<CaseFormValues>;
  readonly onSelect: (id: string) => void;
  readonly onSubmit: (values: CaseFormValues) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.caseTitle}</CardTitle>
        <CardDescription>{copy.caseBody}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {cases.length > 0 && (
          <label className="block text-sm font-medium">
            {copy.activeCase}
            <select
              className="border-input bg-background mt-1 min-h-11 w-full rounded-xl border px-3"
              value={caseId ?? ""}
              onChange={(event) => onSelect(event.target.value)}
            >
              {cases
                .filter((item) => item.status === "OPEN")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.key} — {item.reasonCode}
                  </option>
                ))}
            </select>
          </label>
        )}
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <label className="text-sm font-medium">
            {copy.reason}
            <select
              className="border-input bg-background mt-1 min-h-11 w-full rounded-xl border px-3"
              {...form.register("reasonCode")}
            >
              {adminReasonCodes.map((reason) => (
                <option key={reason}>{reason}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            {copy.duration}
            <Input
              type="number"
              {...form.register("durationMinutes", { valueAsNumber: true })}
            />
          </label>
          <label className="text-sm font-medium md:col-span-2">
            {copy.summary}
            <Input {...form.register("summary")} />
          </label>
          <label className="text-sm font-medium md:col-span-2">
            {copy.reference}
            <Input {...form.register("externalReference")} />
          </label>
          <Button type="submit" disabled={busy} className="md:w-fit">
            {copy.openCase}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function HealthPanel({
  copy,
  health,
}: {
  readonly copy: ReturnType<typeof getAdminCopy>;
  readonly health: AdminHealthView | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.health}</CardTitle>
      </CardHeader>
      <CardContent>
        {!health ? (
          <p>{copy.noData}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {health.checks.map((check) => (
              <li
                key={check.key}
                className="bg-muted flex items-center justify-between gap-3 rounded-xl p-3"
              >
                <span>
                  <strong className="block">{check.key}</strong>
                  <span className="text-muted-foreground text-xs">
                    {check.message}
                  </span>
                </span>
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    check.status === "operational"
                      ? "bg-emerald-500"
                      : "bg-amber-500",
                  )}
                >
                  <span className="sr-only">{check.status}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function MemberPanel({
  copy,
  form,
  busy,
  member,
  searched,
  onSearch,
  onAction,
}: {
  readonly copy: ReturnType<typeof getAdminCopy>;
  readonly form: UseFormReturn<SearchFormValues>;
  readonly busy: boolean;
  readonly member: AdminMemberView | null;
  readonly searched: boolean;
  readonly onSearch: (values: SearchFormValues) => Promise<void>;
  readonly onAction: (action: SensitiveAction) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.members}</CardTitle>
        <CardDescription>{copy.memberHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={form.handleSubmit(onSearch)}
        >
          <label className="flex-1 text-sm font-medium">
            {copy.identifier}
            <Input {...form.register("identifier")} />
          </label>
          <Button className="sm:self-end" type="submit" disabled={busy}>
            <Search />
            {copy.search}
          </Button>
        </form>
        {searched && !member && <p>{copy.noMember}</p>}
        {member && (
          <div className="bg-muted space-y-3 rounded-2xl p-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground block">ID</span>
                <code>{member.id}</code>
              </p>
              <p>
                <span className="text-muted-foreground block">Email</span>
                {member.maskedEmail}
              </p>
              <p>
                <span className="text-muted-foreground block">Status</span>
                {member.status}
              </p>
              <p>
                <span className="text-muted-foreground block">
                  Active sessions
                </span>
                {member.activeSessionCount}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={member.status === "ACTIVE" ? "destructive" : "outline"}
                onClick={() =>
                  onAction({
                    kind: "status",
                    member,
                    status: member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                  })
                }
              >
                {member.status === "ACTIVE" ? copy.suspend : copy.restore}
              </Button>
              <Button
                variant="outline"
                onClick={() => onAction({ kind: "sessions", member })}
              >
                {copy.revokeSessions}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeatureFlagPanel({
  copy,
  flags,
  canWrite,
  onAction,
}: {
  readonly copy: ReturnType<typeof getAdminCopy>;
  readonly flags: readonly AdminFeatureFlagView[];
  readonly canWrite: boolean;
  readonly onAction: (flag: AdminFeatureFlagView) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.flags}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {flags.map((flag) => (
            <article
              key={flag.id}
              className="border-border rounded-2xl border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{flag.key}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {flag.purpose}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-1 text-xs font-bold",
                    flag.enabled
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted",
                  )}
                >
                  {flag.enabled ? "ON" : "OFF"}
                </span>
              </div>
              <p className="mt-3 text-xs">
                Owner: {flag.owner} · v{flag.version}
              </p>
              {canWrite && (
                <Button
                  className="mt-3"
                  size="compact"
                  variant="outline"
                  onClick={() => onAction(flag)}
                >
                  <Flag />
                  {flag.enabled ? "Disable" : "Enable"}
                </Button>
              )}
            </article>
          ))}
        </div>
        {flags.length === 0 && <p>{copy.noData}</p>}
      </CardContent>
    </Card>
  );
}

function JobPanel({
  jobs,
  canRetry,
  onRetry,
}: {
  readonly jobs: readonly AdminJobView[];
  readonly canRetry: boolean;
  readonly onRetry: (job: AdminJobView) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Jobs &amp; DLQ</CardTitle>
        <CardDescription>
          Payload এবং result বাদ দিয়ে bounded operational metadata।
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {jobs.map((job) => (
            <article
              key={job.id}
              className="border-border rounded-2xl border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{job.type}</h3>
                  <p className="text-muted-foreground text-sm">{job.queue}</p>
                </div>
                <span className="bg-muted rounded-full px-2 py-1 text-xs font-bold">
                  {job.status}
                </span>
              </div>
              <p className="mt-3 text-xs">
                Attempts: {job.attempts}/{job.maxAttempts} · v{job.version}
              </p>
              {job.failureCode && (
                <p className="text-destructive mt-1 text-xs">
                  {job.failureCode}
                </p>
              )}
              {canRetry &&
                ["FAILED", "PARTIAL"].includes(job.status) &&
                job.attempts < job.maxAttempts && (
                  <Button
                    className="mt-3"
                    variant="outline"
                    size="compact"
                    onClick={() => onRetry(job)}
                  >
                    Retry
                  </Button>
                )}
            </article>
          ))}
        </div>
        {jobs.length === 0 && <p>No active or failed jobs.</p>}
      </CardContent>
    </Card>
  );
}

function RolePanel({
  form,
  approvals,
  canWrite,
  onRequest,
  onApprove,
}: {
  readonly form: UseFormReturn<z.infer<typeof roleChangeSchema>>;
  readonly approvals: readonly AdminApprovalView[];
  readonly canWrite: boolean;
  readonly onRequest: (request: z.infer<typeof roleChangeSchema>) => void;
  readonly onApprove: (approval: AdminApprovalView) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational role approval</CardTitle>
        <CardDescription>
          Role পরিবর্তন self-service নয়; আলাদা Platform Administrator-এর
          approval লাগে।
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {canWrite && (
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={form.handleSubmit(onRequest)}
          >
            <label className="text-sm font-medium md:col-span-2">
              Target user ID
              <Input {...form.register("targetUserId")} />
            </label>
            <label className="text-sm font-medium">
              Role
              <select
                className="border-input bg-background mt-1 min-h-11 w-full rounded-xl border px-3"
                {...form.register("roleKey")}
              >
                <option value="support-administrator">
                  Support Administrator
                </option>
                <option value="platform-administrator">
                  Platform Administrator
                </option>
                <option value="content-curator">Content Curator</option>
                <option value="auditor">Auditor</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Operation
              <select
                className="border-input bg-background mt-1 min-h-11 w-full rounded-xl border px-3"
                {...form.register("operation")}
              >
                <option value="GRANT">Grant</option>
                <option value="REVOKE">Revoke</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Expected user version
              <Input
                type="number"
                {...form.register("expectedUserVersion", {
                  valueAsNumber: true,
                })}
              />
            </label>
            <Button className="md:self-end" type="submit">
              Request change
            </Button>
          </form>
        )}
        <div className="space-y-2">
          {approvals.map((approval) => {
            const payload = isRecord(approval.payload) ? approval.payload : {};
            return (
              <article
                key={approval.id}
                className="bg-muted flex flex-col justify-between gap-3 rounded-2xl p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-bold">
                    {String(payload.operation ?? "ROLE")} ·{" "}
                    {String(payload.roleKey ?? "unknown")}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Target {approval.targetUserId} · {approval.status} · v
                    {approval.version}
                  </p>
                </div>
                {canWrite && approval.status === "PENDING" && (
                  <Button
                    variant="outline"
                    size="compact"
                    onClick={() => onApprove(approval)}
                  >
                    Approve &amp; execute
                  </Button>
                )}
              </article>
            );
          })}
          {approvals.length === 0 && <p>No role approvals.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function AuditPanel({
  copy,
  events,
}: {
  readonly copy: ReturnType<typeof getAdminCopy>;
  readonly events: readonly AdminAuditEventView[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.audit}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="overflow-x-auto"
          role="region"
          aria-label={copy.audit}
          tabIndex={0}
        >
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">Sequence</th>
                <th className="p-2">Action</th>
                <th className="p-2">Reason</th>
                <th className="p-2">Correlation</th>
                <th className="p-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr className="border-b last:border-0" key={event.id}>
                  <td className="p-2 font-mono">{event.sequence}</td>
                  <td className="p-2">{event.action}</td>
                  <td className="p-2">{event.reasonCode}</td>
                  <td className="p-2 font-mono text-xs">
                    {event.correlationId}
                  </td>
                  <td className="p-2">
                    {new Date(event.occurredAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {events.length === 0 && <p>{copy.noData}</p>}
      </CardContent>
    </Card>
  );
}

function actionBinding(action: SensitiveAction): {
  readonly scope: AdminStepUpScope;
  readonly targetType: string;
  readonly targetId: string;
} {
  if (action.kind === "status")
    return {
      scope: "USER_STATUS_WRITE",
      targetType: "User",
      targetId: action.member.id,
    };
  if (action.kind === "sessions")
    return {
      scope: "SESSION_REVOKE",
      targetType: "User",
      targetId: action.member.id,
    };
  if (action.kind === "flag")
    return {
      scope: "FEATURE_FLAG_WRITE",
      targetType: "FeatureFlag",
      targetId: action.flag.id,
    };
  if (action.kind === "job")
    return {
      scope: "JOB_RETRY",
      targetType: "BackgroundJob",
      targetId: action.job.id,
    };
  if (action.kind === "role_request")
    return {
      scope: "ROLE_CHANGE_REQUEST",
      targetType: "User",
      targetId: action.request.targetUserId,
    };
  return {
    scope: "ROLE_CHANGE_APPROVE",
    targetType: "AdminApprovalRequest",
    targetId: action.approval.id,
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof AuthApiError || error instanceof Error
    ? error.message
    : fallback;
}
