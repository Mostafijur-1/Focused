"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Bot,
  Check,
  CircleAlert,
  CloudOff,
  FileCheck2,
  LoaderCircle,
  LockKeyhole,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  AIContextScope,
  AIMessageView,
  AIOverview,
  AIProposalView,
  AIRunView,
  AIStreamEvent,
} from "@/features/ai/domain/ai-types";
import {
  aiOverviewResponseSchema,
  aiProposalResponseSchema,
  aiRunResponseSchema,
  aiStreamEventSchema,
} from "@/features/ai/transport/ai-schemas";
import { getAICopy, type AICopy } from "@/features/ai/ui/ai-copy";
import { AuthApiError, authFetch } from "@/features/auth/ui/auth-api";
import { useAuth } from "@/features/auth/ui/auth-provider";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

const messageFormSchema = z.object({
  message: z.string().trim().min(1).max(2_000),
});
type MessageForm = z.infer<typeof messageFormSchema>;

export function CoachWorkspace({ locale }: { readonly locale: Locale }) {
  const copy = getAICopy(locale);
  const auth = useAuth();
  const [overview, setOverview] = useState<AIOverview | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<readonly AIMessageView[]>([]);
  const [scopes, setScopes] = useState<readonly AIContextScope[]>([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);
  const [includeGoalProposal, setIncludeGoalProposal] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [review, setReview] = useState<AIRunView | null>(null);
  const [proposalTitles, setProposalTitles] = useState<Record<string, string>>(
    {},
  );
  const form = useForm<MessageForm>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: { message: "" },
  });

  const load = useCallback(async () => {
    if (auth.status !== "authenticated" || !auth.session) return;
    setLoading(true);
    setError(null);
    try {
      const result = aiOverviewResponseSchema.parse(
        await authFetch<unknown>("/api/v1/ai", {}, auth.session.accessToken),
      ).data;
      setOverview(result);
      setReview(result.latestDailyReview);
      setConversationId(
        (current) => current ?? result.conversations[0]?.id ?? null,
      );
      setMessages((current) =>
        current.length ? current : (result.conversations[0]?.messages ?? []),
      );
      setProposalTitles(
        Object.fromEntries(
          result.pendingProposals.map((proposal) => [
            proposal.id,
            proposal.patch.title,
          ]),
        ),
      );
    } catch (caught) {
      setError(errorMessage(caught, copy));
    } finally {
      setLoading(false);
    }
  }, [auth.session, auth.status, copy]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      setOffline(!navigator.onLine);
      if (auth.status === "authenticated") void load();
      if (auth.status === "anonymous") setLoading(false);
    }, 0);
    const online = () => setOffline(false);
    const offlineListener = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offlineListener);
    return () => {
      window.clearTimeout(task);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offlineListener);
    };
  }, [auth.status, load]);

  const activeMessages = useMemo(() => {
    const stored = overview?.conversations.find(
      (item) => item.id === conversationId,
    );
    return messages.length ? messages : (stored?.messages ?? []);
  }, [conversationId, messages, overview]);

  async function send(values: MessageForm) {
    if (!auth.session || offline) return;
    const message = values.message.trim();
    const optimisticUser: AIMessageView = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      citations: [],
      model: null,
      createdAt: new Date().toISOString(),
    };
    const optimisticAssistant: AIMessageView = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      citations: [],
      model: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimisticUser, optimisticAssistant]);
    setStreaming(true);
    setError(null);
    setWarning(null);
    form.reset();
    try {
      const response = await fetch("/api/v1/ai/coach/messages", {
        method: "POST",
        headers: {
          accept: "text/event-stream",
          authorization: `Bearer ${auth.session.accessToken}`,
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          conversationId,
          clientRequestId: crypto.randomUUID(),
          locale,
          message,
          contextScopes: scopes,
        }),
      });
      if (!response.ok || !response.body) throw new Error("stream_unavailable");
      await consumeSSE(response.body, (event) => {
        if (event.type === "run.started")
          setConversationId(event.conversationId);
        if (event.type === "message.delta")
          setMessages((current) =>
            current.map((item) =>
              item.id === optimisticAssistant.id
                ? { ...item, content: item.content + event.delta }
                : item,
            ),
          );
        if (event.type === "citation")
          setMessages((current) =>
            current.map((item) =>
              item.id === optimisticAssistant.id
                ? { ...item, citations: [...item.citations, event.evidence] }
                : item,
            ),
          );
        if (event.type === "warning") setWarning(copy.streamWarning);
        if (event.type === "run.completed")
          setMessages((current) =>
            current.map((item) =>
              item.id === optimisticAssistant.id ? event.message : item,
            ),
          );
        if (event.type === "run.failed") throw new Error(event.code);
      });
      await load();
    } catch (caught) {
      setMessages((current) =>
        current.filter((item) => item.id !== optimisticAssistant.id),
      );
      setError(errorMessage(caught, copy));
    } finally {
      setStreaming(false);
    }
  }

  async function generateReview() {
    if (!auth.session || offline) return;
    setReviewing(true);
    setError(null);
    try {
      const result = aiRunResponseSchema.parse(
        await authFetch<unknown>(
          "/api/v1/ai/reviews/daily",
          {
            method: "POST",
            body: JSON.stringify({
              clientRequestId: crypto.randomUUID(),
              locale,
              contextScopes: scopes,
              includeGoalProposal,
            }),
          },
          auth.session.accessToken,
        ),
      ).data;
      setReview(result);
      await load();
    } catch (caught) {
      setError(errorMessage(caught, copy));
    } finally {
      setReviewing(false);
    }
  }

  async function decide(
    proposal: AIProposalView,
    decision: "apply" | "reject",
  ) {
    if (!auth.session || offline) return;
    setDecisionBusy(proposal.id);
    setError(null);
    try {
      const editedTitle =
        proposalTitles[proposal.id]?.trim() || proposal.patch.title;
      aiProposalResponseSchema.parse(
        await authFetch<unknown>(
          `/api/v1/ai/proposals/${proposal.id}/decision`,
          {
            method: "POST",
            body: JSON.stringify(
              decision === "apply"
                ? {
                    decision,
                    expectedVersion: proposal.version,
                    clientCommandId: crypto.randomUUID(),
                    editedPatch:
                      editedTitle === proposal.patch.title
                        ? null
                        : { ...proposal.patch, title: editedTitle },
                    note: null,
                  }
                : {
                    decision,
                    expectedVersion: proposal.version,
                    clientCommandId: crypto.randomUUID(),
                    note: null,
                  },
            ),
          },
          auth.session.accessToken,
        ),
      );
      await load();
    } catch (caught) {
      setError(errorMessage(caught, copy));
    } finally {
      setDecisionBusy(null);
    }
  }

  if (auth.status === "loading" || loading) return <LoadingState />;
  if (auth.status === "anonymous")
    return (
      <CenteredState icon={LockKeyhole} text={copy.signedOut}>
        <Link className={buttonVariants()} href={`/${locale}/sign-in`}>
          {copy.signIn}
        </Link>
      </CenteredState>
    );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-7">
        <p className="text-foreground text-sm font-semibold tracking-wide">
          FocusOS · AI Guidance
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {copy.pageTitle}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6 sm:text-base">
          {copy.pageDescription}
        </p>
      </header>

      {offline && <Banner icon={CloudOff}>{copy.offline}</Banner>}
      {warning && <Banner icon={CircleAlert}>{warning}</Banner>}
      {error && (
        <Banner icon={CircleAlert} tone="error">
          <span>{error}</span>
          <Button size="compact" variant="ghost" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" /> {copy.retry}
          </Button>
        </Banner>
      )}

      <Card className="border-primary/20 bg-primary/3 mb-6">
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-2xl">
              <LockKeyhole className="size-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>{copy.privacyTitle}</CardTitle>
              <CardDescription className="mt-1 max-w-3xl">
                {copy.privacyDescription}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm font-medium">
            {overview?.available
              ? copy.configured
              : overview?.unavailableReason === "privacy_policy"
                ? copy.privacyBlocked
                : copy.notConfigured}
          </p>
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">
              {copy.sources}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(overview?.allowedScopes ?? []).map((scope) => (
                <label
                  key={scope}
                  className="border-border bg-card hover:border-primary/35 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={scopes.includes(scope)}
                    onChange={(event) =>
                      setScopes((current) =>
                        event.target.checked
                          ? [...current, scope]
                          : current.filter((item) => item !== scope),
                      )
                    }
                  />
                  {copy.scopes[scope]}
                </label>
              ))}
            </div>
            {scopes.length === 0 && (
              <p className="text-muted-foreground mt-3 text-xs">
                {copy.sourceEmpty}
              </p>
            )}
          </fieldset>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.8fr)]">
        <Card className="min-h-[38rem] overflow-hidden">
          <CardHeader className="border-border border-b">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{copy.coachTitle}</CardTitle>
                <CardDescription className="mt-1">
                  {copy.coachHint}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="compact"
                onClick={() => {
                  setConversationId(null);
                  setMessages([]);
                }}
              >
                <MessageSquarePlus aria-hidden="true" /> {copy.newConversation}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-[31rem] flex-col p-0">
            <div
              className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6"
              aria-live="polite"
              aria-busy={streaming}
            >
              {activeMessages.length === 0 ? (
                <div className="text-muted-foreground grid min-h-72 place-items-center px-6 text-center text-sm leading-6">
                  <div>
                    <Bot
                      className="text-primary mx-auto mb-4 size-9"
                      aria-hidden="true"
                    />
                    <p>{copy.emptyConversation}</p>
                  </div>
                </div>
              ) : (
                activeMessages.map((message) => (
                  <article
                    key={message.id}
                    className={cn(
                      "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground ml-auto rounded-br-md"
                        : "bg-muted rounded-bl-md",
                    )}
                  >
                    <p className="mb-1 text-xs font-semibold opacity-75">
                      {message.role === "user"
                        ? copy.userLabel
                        : copy.assistantLabel}
                    </p>
                    <p className="whitespace-pre-wrap">
                      {message.content || copy.sending}
                    </p>
                    {message.citations.length > 0 && (
                      <ul
                        className="mt-3 flex flex-wrap gap-1.5"
                        aria-label={copy.sources}
                      >
                        {message.citations.map((citation) => (
                          <li
                            key={`${message.id}:${citation.sourceVersion}`}
                            className="bg-background/70 rounded-lg px-2 py-1 text-[0.6875rem]"
                          >
                            {copy.scopes[citation.scope]}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))
              )}
            </div>
            <form
              className="border-border border-t p-4"
              onSubmit={form.handleSubmit(send)}
            >
              <label htmlFor="coach-message" className="sr-only">
                {copy.messageLabel}
              </label>
              <textarea
                id="coach-message"
                rows={3}
                placeholder={copy.messagePlaceholder}
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/30 min-h-24 w-full resize-y rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-4"
                aria-invalid={Boolean(form.formState.errors.message)}
                {...form.register("message")}
              />
              <div className="mt-3 flex justify-end">
                <Button type="submit" disabled={streaming || offline}>
                  {streaming ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Send aria-hidden="true" />
                  )}
                  {streaming ? copy.sending : copy.send}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="bg-accent text-accent-foreground grid size-10 place-items-center rounded-2xl">
                  <Sparkles className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <CardTitle>{copy.dailyTitle}</CardTitle>
                  <CardDescription className="mt-1">
                    {copy.dailyDescription}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <label className="mb-4 flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary mt-0.5 size-4"
                  checked={includeGoalProposal}
                  onChange={(event) =>
                    setIncludeGoalProposal(event.target.checked)
                  }
                />
                {copy.goalProposal}
              </label>
              <Button
                className="w-full"
                onClick={() => void generateReview()}
                disabled={reviewing || offline}
              >
                {reviewing ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <FileCheck2 aria-hidden="true" />
                )}
                {reviewing ? copy.generatingReview : copy.generateReview}
              </Button>
              {review?.output ? (
                <ReviewCard review={review} copy={copy} />
              ) : (
                <p className="text-muted-foreground mt-5 text-sm">
                  {copy.noReview}
                </p>
              )}
            </CardContent>
          </Card>

          {(overview?.pendingProposals.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{copy.proposalsTitle}</CardTitle>
                <CardDescription>{copy.proposalDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {overview!.pendingProposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="border-border rounded-2xl border p-4"
                  >
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Target
                        className="text-primary size-4"
                        aria-hidden="true"
                      />{" "}
                      Goal proposal
                    </div>
                    <label
                      className="text-muted-foreground text-xs"
                      htmlFor={`proposal-${proposal.id}`}
                    >
                      {copy.proposalTitleLabel}
                    </label>
                    <Input
                      id={`proposal-${proposal.id}`}
                      className="mt-1"
                      value={
                        proposalTitles[proposal.id] ?? proposal.patch.title
                      }
                      maxLength={200}
                      onChange={(event) =>
                        setProposalTitles((current) => ({
                          ...current,
                          [proposal.id]: event.target.value,
                        }))
                      }
                    />
                    {proposal.rationale && (
                      <p className="text-muted-foreground mt-2 text-xs leading-5">
                        {proposal.rationale}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="compact"
                        disabled={decisionBusy === proposal.id || offline}
                        onClick={() => void decide(proposal, "apply")}
                      >
                        {decisionBusy === proposal.id ? (
                          <LoaderCircle
                            className="animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Check aria-hidden="true" />
                        )}
                        {decisionBusy === proposal.id
                          ? copy.applying
                          : copy.apply}
                      </Button>
                      <Button
                        size="compact"
                        variant="outline"
                        disabled={decisionBusy === proposal.id || offline}
                        onClick={() => void decide(proposal, "reject")}
                      >
                        <X aria-hidden="true" /> {copy.reject}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewCard({
  review,
  copy,
}: {
  readonly review: AIRunView;
  readonly copy: AICopy;
}) {
  const output = review.output!;
  return (
    <article className="border-border mt-5 space-y-4 border-t pt-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{output.headline}</h3>
          {output.generatedBy === "deterministic" && (
            <span className="bg-muted rounded-full px-2 py-0.5 text-[0.6875rem]">
              {copy.deterministic}
            </span>
          )}
        </div>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          {output.summary}
        </p>
      </div>
      <ReviewList title={copy.reviewWins} items={output.wins} />
      <ReviewList title={copy.reviewFriction} items={output.friction} />
      <ReviewList title={copy.reviewNext} items={output.nextActions} />
      <ReviewList
        title={copy.missingData}
        items={output.missingData.map(
          (scope) => copy.scopes[scope as AIContextScope] ?? scope,
        )}
      />
      {output.evidence.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold tracking-wide uppercase">
            {copy.sources}
          </h4>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {output.evidence.map((item) => (
              <li
                key={item.sourceVersion}
                className="bg-muted rounded-lg px-2 py-1 text-xs"
              >
                {copy.scopes[item.scope]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function ReviewList({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly string[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold tracking-wide uppercase">{title}</h4>
      <ul className="mt-2 space-y-1.5 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <Check
              className="text-primary mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function consumeSSE(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: AIStreamEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/u);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const data = block
          .split(/\r?\n/u)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (data)
          onEvent(aiStreamEventSchema.parse(JSON.parse(data) as unknown));
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-10">
      <div className="bg-muted h-10 w-72 rounded-xl" />
      <div className="bg-muted mt-4 h-5 w-full max-w-xl rounded-lg" />
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <div className="bg-muted h-[34rem] rounded-3xl" />
        <div className="bg-muted h-[24rem] rounded-3xl" />
      </div>
    </div>
  );
}

function CenteredState({
  icon: Icon,
  text,
  children,
}: {
  readonly icon: typeof LockKeyhole;
  readonly text: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[70svh] place-items-center px-4">
      <Card className="max-w-md text-center">
        <CardContent className="p-8">
          <Icon
            className="text-primary mx-auto mb-4 size-9"
            aria-hidden="true"
          />
          <p className="text-muted-foreground mb-5">{text}</p>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

function Banner({
  children,
  icon: Icon,
  tone = "default",
}: {
  readonly children: React.ReactNode;
  readonly icon: typeof CloudOff;
  readonly tone?: "default" | "error";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mb-5 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-primary/20 bg-primary/5",
      )}
    >
      <span className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {children}
      </span>
    </div>
  );
}

function errorMessage(error: unknown, copy: AICopy): string {
  if (error instanceof AuthApiError && error.status === 429)
    return error.message;
  if (error instanceof AuthApiError) return error.message || copy.requestError;
  return copy.requestError;
}
