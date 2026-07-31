import type { Clock } from "@/application/ports/clock";
import { localDateAt } from "@/features/dashboard/domain/dashboard-time";
import type { HabitRepository } from "@/features/habits/application/ports";
import { addDays } from "@/features/habits/domain/habit-schedule";

interface HabitOccurrenceWorkerDependencies {
  readonly repository: HabitRepository;
  readonly clock: Clock;
}

export class HabitOccurrenceWorker {
  constructor(
    private readonly dependencies: HabitOccurrenceWorkerDependencies,
  ) {}

  async runPage(afterUserId?: string): Promise<
    Readonly<{
      expanded: number;
      members: number;
      nextCursor: string | null;
    }>
  > {
    const now = this.dependencies.clock.now();
    const userIds = await this.dependencies.repository.listExpansionCandidates(
      afterUserId,
      100,
    );
    let expanded = 0;
    for (const userId of userIds) {
      const profile = await this.dependencies.repository.getProfile(userId);
      const localDate = localDateAt(now, profile.timeZone);
      expanded += await this.dependencies.repository.expandOccurrences({
        userId,
        from: localDate,
        through: addDays(localDate, 14),
        now,
      });
    }
    return {
      expanded,
      members: userIds.length,
      nextCursor: userIds.length === 100 ? userIds.at(-1)! : null,
    };
  }
}
