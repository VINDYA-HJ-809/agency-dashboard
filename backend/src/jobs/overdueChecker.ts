import cron from "node-cron";
import { prisma } from "../lib/prisma";

/**
 * Runs every 5 minutes. Flags any task whose dueDate has passed and isn't
 * already marked overdue or already Done. This is deliberately NOT computed
 * on page load / on the fly — it's a persisted flag written by a scheduled
 * job, per the spec, so any client reading isOverdue always gets a
 * consistent, pre-computed value regardless of when they fetch.
 *
 * node-cron over Bull: this app only needs a single lightweight recurring
 * sweep with no retry/backoff/distributed-worker requirements, so a
 * Redis-backed queue would be infrastructure the project doesn't need yet.
 */
export function startOverdueChecker() {
  cron.schedule("*/5 * * * *", async () => {
    const now = new Date();
    const result = await prisma.task.updateMany({
      where: {
        dueDate: { lt: now },
        isOverdue: false,
        status: { not: "DONE" },
      },
      data: { isOverdue: true },
    });
    if (result.count > 0) {
      console.log(`[overdueChecker] Flagged ${result.count} task(s) as overdue`);
    }
  });
}
