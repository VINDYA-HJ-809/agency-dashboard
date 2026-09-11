import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const user = req.user!;

  if (user.role === "ADMIN") {
    const [totalProjects, byStatus, overdueCount] = await Promise.all([
      prisma.project.count(),
      prisma.task.groupBy({ by: ["status"], _count: true }),
      prisma.task.count({ where: { isOverdue: true } }),
    ]);
    return res.json({ data: { totalProjects, tasksByStatus: byStatus, overdueCount } });
  }

  if (user.role === "PM") {
    const projects = await prisma.project.findMany({
      where: { createdById: user.id },
      include: { _count: { select: { tasks: true } } },
    });
    const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const upcoming = await prisma.task.findMany({
      where: {
        project: { createdById: user.id },
        dueDate: { lte: weekFromNow, gte: new Date() },
      },
      orderBy: { dueDate: "asc" },
    });
    const byPriority = await prisma.task.groupBy({
      by: ["priority"],
      where: { project: { createdById: user.id } },
      _count: true,
    });
    return res.json({ data: { projects, upcomingDueDates: upcoming, tasksByPriority: byPriority } });
  }

  // DEVELOPER
  const tasks = await prisma.task.findMany({
    where: { assignedToId: user.id },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });
  res.json({ data: { tasks } });
});

export default router;
