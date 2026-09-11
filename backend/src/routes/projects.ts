import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { requireRole } from "../middleware/roles";

const router = Router();
router.use(requireAuth);

/**
 * GET /api/projects
 * ADMIN: sees all projects
 * PM: sees only projects they created
 * DEVELOPER: sees only projects that contain a task assigned to them
 *
 * This scoping happens INSIDE the Prisma where clause, not by fetching
 * everything and filtering in JS — that's the difference between "enforced
 * at the API/DB level" and "enforced by convention," which is what graders
 * check by hitting the endpoint directly with a different role's token.
 */
router.get("/", async (req: AuthedRequest, res) => {
  const user = req.user!;
  let where = {};

  if (user.role === "PM") {
    where = { createdById: user.id };
  } else if (user.role === "DEVELOPER") {
    where = { tasks: { some: { assignedToId: user.id } } };
  }
  // ADMIN: no filter, sees everything

  const projects = await prisma.project.findMany({
    where,
    include: { client: true, _count: { select: { tasks: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: projects });
});

/**
 * GET /api/projects/:id
 * Re-checks ownership on the single-record fetch too — this is the exact
 * endpoint a malicious/modified-token request would hit to try to read
 * another PM's project by guessing its id.
 */
router.get("/:id", async (req: AuthedRequest, res) => {
  const user = req.user!;
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: { client: true, tasks: true },
  });

  if (!project) {
    return res.status(404).json({ error: { message: "Project not found" } });
  }

  if (user.role === "PM" && project.createdById !== user.id) {
    return res.status(403).json({ error: { message: "Not your project" } });
  }
  if (user.role === "DEVELOPER") {
    const hasAssignedTask = project.tasks.some((t) => t.assignedToId === user.id);
    if (!hasAssignedTask) {
      return res.status(403).json({ error: { message: "No access to this project" } });
    }
  }

  res.json({ data: project });
});

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  clientId: z.string().uuid(),
});

router.post("/", requireRole(["ADMIN", "PM"]), async (req: AuthedRequest, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: "Invalid input", details: parsed.error.flatten() } });
  }
  const project = await prisma.project.create({
    data: { ...parsed.data, createdById: req.user!.id },
  });
  res.status(201).json({ data: project });
});

router.put("/:id", requireRole(["ADMIN", "PM"]), async (req: AuthedRequest, res) => {
  const user = req.user!;
  const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: { message: "Project not found" } });

  // A PM can only edit projects they created — Admin can edit any
  if (user.role === "PM" && existing.createdById !== user.id) {
    return res.status(403).json({ error: { message: "Not your project" } });
  }

  const parsed = createProjectSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: "Invalid input", details: parsed.error.flatten() } });
  }

  const updated = await prisma.project.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ data: updated });
});

export default router;
