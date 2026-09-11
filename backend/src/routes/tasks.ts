import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { emitActivity, emitNotification } from "../socket";

const router = Router();
router.use(requireAuth);

const STATUS_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

/**
 * GET /api/tasks
 * Shareable-URL filters via query params: status, priority, dueBefore, dueAfter.
 * Role scoping happens in the same where clause, same principle as projects.ts.
 */
router.get("/", async (req: AuthedRequest, res) => {
  const user = req.user!;
  const { status, priority, dueBefore, dueAfter, projectId } = req.query;

  const where: any = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (projectId) where.projectId = projectId;
  if (dueBefore || dueAfter) {
    where.dueDate = {};
    if (dueBefore) where.dueDate.lte = new Date(String(dueBefore));
    if (dueAfter) where.dueDate.gte = new Date(String(dueAfter));
  }

  if (user.role === "DEVELOPER") {
    where.assignedToId = user.id;
  } else if (user.role === "PM") {
    where.project = { createdById: user.id };
  }
  // ADMIN: no extra scoping

  const tasks = await prisma.task.findMany({
    where,
    include: { assignedTo: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });
  res.json({ data: tasks });
});

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  projectId: z.string().uuid(),
  assignedToId: z.string().uuid().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  dueDate: z.string().datetime().optional(),
});

router.post("/", requireRole(["ADMIN", "PM"]), async (req: AuthedRequest, res) => {
  const user = req.user!;
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: "Invalid input", details: parsed.error.flatten() } });
  }

  // A PM may only create tasks in projects they own
  const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId } });
  if (!project) return res.status(404).json({ error: { message: "Project not found" } });
  if (user.role === "PM" && project.createdById !== user.id) {
    return res.status(403).json({ error: { message: "Not your project" } });
  }

  const task = await prisma.task.create({
    data: {
      ...parsed.data,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
    },
  });

  await prisma.activityLog.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      actorId: user.id,
      action: "TASK_CREATED",
      message: `${user.name} created task "${task.title}"`,
    },
  });

  if (task.assignedToId) {
    const notification = await prisma.notification.create({
      data: {
        recipientId: task.assignedToId,
        taskId: task.id,
        type: "TASK_ASSIGNED",
        message: `You were assigned to "${task.title}"`,
      },
    });
    emitNotification(task.assignedToId, notification);
  }

  res.status(201).json({ data: task });
});

const statusUpdateSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]),
});

/**
 * PATCH /api/tasks/:id/status
 * The core real-time path: validate scope -> update DB -> write activity
 * log row (DB, not derived) -> emit over the project's socket room ->
 * fire a PM notification if the task moved to IN_REVIEW.
 */
router.patch("/:id/status", async (req: AuthedRequest, res) => {
  const user = req.user!;
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: "Invalid input", details: parsed.error.flatten() } });
  }

  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: { project: true },
  });
  if (!task) return res.status(404).json({ error: { message: "Task not found" } });

  // Developers may only update their own assigned tasks
  if (user.role === "DEVELOPER" && task.assignedToId !== user.id) {
    return res.status(403).json({ error: { message: "Not your task" } });
  }
  // PMs may only update tasks in projects they own
  if (user.role === "PM" && task.project.createdById !== user.id) {
    return res.status(403).json({ error: { message: "Not your project" } });
  }

  const fromStatus = task.status;
  const toStatus = parsed.data.status;

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: { status: toStatus },
  });

  const message = `${user.name} moved Task "${task.title}" from ${STATUS_LABELS[fromStatus]} \u2192 ${STATUS_LABELS[toStatus]}`;

  const log = await prisma.activityLog.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      actorId: user.id,
      action: "STATUS_CHANGE",
      fromValue: fromStatus,
      toValue: toStatus,
      message,
    },
    include: { actor: { select: { name: true } } },
  });

  emitActivity(task.projectId, log);

  if (toStatus === "IN_REVIEW") {
    const pm = task.project.createdById;
    const notification = await prisma.notification.create({
      data: {
        recipientId: pm,
        taskId: task.id,
        type: "TASK_MOVED_TO_REVIEW",
        message: `"${task.title}" was moved to In Review`,
      },
    });
    emitNotification(pm, notification);
  }

  res.json({ data: updated });
});

export default router;
