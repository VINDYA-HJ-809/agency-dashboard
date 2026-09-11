import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const notifications = await prisma.notification.findMany({
    where: { recipientId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unreadCount = await prisma.notification.count({
    where: { recipientId: req.user!.id, isRead: false },
  });
  res.json({ data: notifications, unreadCount });
});

router.patch("/:id/read", async (req: AuthedRequest, res) => {
  const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notification || notification.recipientId !== req.user!.id) {
    return res.status(404).json({ error: { message: "Notification not found" } });
  }
  const updated = await prisma.notification.update({
    where: { id: req.params.id },
    data: { isRead: true },
  });
  res.json({ data: updated });
});

router.patch("/read-all", async (req: AuthedRequest, res) => {
  await prisma.notification.updateMany({
    where: { recipientId: req.user!.id, isRead: false },
    data: { isRead: true },
  });
  res.json({ success: true });
});

export default router;
