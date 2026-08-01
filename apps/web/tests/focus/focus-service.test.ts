import { describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@/features/auth/domain/auth-types";
import { FocusService } from "@/features/focus/application/focus-service";
import type { FocusRepository } from "@/features/focus/application/ports";
import { defaultPomodoroConfig } from "@/features/focus/domain/focus-policy";
import type { FocusSessionView } from "@/features/focus/domain/focus-types";

const now = new Date("2026-08-01T06:00:00.000Z");
const user: AuthUser = {
  id: "23238b54-ab60-4167-b760-e312b39a53af",
  email: "focus@example.test",
  displayName: "Focus Owner",
  passwordHash: null,
  emailVerifiedAt: now,
  status: "ACTIVE",
  permissionVersion: 1,
  permissions: ["focus:read:own", "focus:write:own"],
};

describe("FocusService", () => {
  it("normalizes intent and derives the Pomodoro focused target", async () => {
    const repository = repositoryDouble();
    const service = buildService(repository);
    await service.start(user, {
      kind: "pomodoro",
      intent: "  Finish auth flow  ",
      plannedSeconds: 1_500,
      goalId: null,
      pomodoroPresetId: null,
      pomodoroConfig: defaultPomodoroConfig,
      timeZone: "Asia/Dhaka",
      clientCommandId: crypto.randomUUID(),
    });
    expect(repository.start).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({
          intent: "Finish auth flow",
          plannedSeconds: 6_000,
        }),
      }),
    );
  });

  it("maps optimistic conflicts to stable API conflicts", async () => {
    const repository = repositoryDouble();
    repository.pause.mockResolvedValue("conflict");
    await expect(
      buildService(repository).pause(user, crypto.randomUUID(), {
        reason: null,
        expectedVersion: 1,
        clientCommandId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("enforces least privilege for reads and mutations", async () => {
    const service = buildService(repositoryDouble());
    expect(() => service.overview({ ...user, permissions: [] })).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
    expect(() =>
      service.resume(
        { ...user, permissions: ["focus:read:own"] },
        crypto.randomUUID(),
        { expectedVersion: 1, clientCommandId: crypto.randomUUID() },
      ),
    ).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
  });
});

function buildService(repository: ReturnType<typeof repositoryDouble>) {
  return new FocusService({ repository, clock: { now: () => now } });
}

function repositoryDouble() {
  const session = sessionView();
  return {
    overview: vi.fn<FocusRepository["overview"]>().mockResolvedValue({
      active: null,
      recent: [],
      presets: [],
      goalOptions: [],
      serverNow: now.toISOString(),
    }),
    detail: vi.fn<FocusRepository["detail"]>().mockResolvedValue(session),
    start: vi.fn<FocusRepository["start"]>().mockResolvedValue(session),
    pause: vi.fn<FocusRepository["pause"]>().mockResolvedValue(session),
    resume: vi.fn<FocusRepository["resume"]>().mockResolvedValue(session),
    extend: vi.fn<FocusRepository["extend"]>().mockResolvedValue(session),
    complete: vi.fn<FocusRepository["complete"]>().mockResolvedValue(session),
    abandon: vi.fn<FocusRepository["abandon"]>().mockResolvedValue(session),
    interrupt: vi.fn<FocusRepository["interrupt"]>().mockResolvedValue(session),
    advanceInterval: vi
      .fn<FocusRepository["advanceInterval"]>()
      .mockResolvedValue(session),
    createPreset: vi.fn<FocusRepository["createPreset"]>(),
    updatePreset: vi.fn<FocusRepository["updatePreset"]>(),
  };
}

function sessionView(): FocusSessionView {
  return {
    id: "b94cd147-d8a9-46ec-9233-f23bf02cde26",
    goalId: null,
    goalTitle: null,
    pomodoroPresetId: null,
    kind: "deep_work",
    status: "running",
    intent: "Ship timer",
    plannedSeconds: 1_500,
    focusedSeconds: 0,
    pausedSeconds: 0,
    interruptionCount: 0,
    timeZone: "Asia/Dhaka",
    startedAt: now.toISOString(),
    completedAt: null,
    abandonedAt: null,
    outcome: null,
    version: 1,
    activeInterval: null,
    pomodoroConfig: null,
    serverNow: now.toISOString(),
  };
}
