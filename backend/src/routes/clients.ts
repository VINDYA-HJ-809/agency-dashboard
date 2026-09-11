import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  res.json({ data: clients });
});

const createClientSchema = z.object({ name: z.string().min(1) });

router.post("/", requireRole(["ADMIN", "PM"]), async (req, res) => {
  const parsed = createClientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: "Invalid input", details: parsed.error.flatten() } });
  }
  const client = await prisma.client.create({ data: parsed.data });
  res.status(201).json({ data: client });
});

export default router;
