import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "./utils/token";
import { prisma } from "./lib/prisma";

let io: Server;

// Simple in-memory online-user count for presence — this is fine to be
// in-memory because it's a live/ephemeral count, NOT the activity log
// (the spec only requires the activity log itself to survive restarts).
const onlineUsers = new Set<string>();

export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialized yet");
  return io;
}

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN,
      credentials: true,
    },
  });

  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("Unauthorized"));
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user) return next(new Error("Unauthorized"));
      (socket as any).user = { id: user.id, role: user.role, name: user.name };
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const user = (socket as any).user as { id: string; role: string; name: string };

    onlineUsers.add(user.id);
    io.emit("presence:count", { count: onlineUsers.size });

    // Join rooms based on role-scoped access
    if (user.role === "ADMIN") {
      socket.join("global");
    } else if (user.role === "PM") {
      const projects = await prisma.project.findMany({
        where: { createdById: user.id },
        select: { id: true },
      });
      projects.forEach((p) => socket.join(`project:${p.id}`));
    } else if (user.role === "DEVELOPER") {
      const tasks = await prisma.task.findMany({
        where: { assignedToId: user.id },
        select: { projectId: true },
      });
      const projectIds = new Set(tasks.map((t) => t.projectId));
      projectIds.forEach((pid) => socket.join(`project:${pid}`));
    }

    // Personal room for direct notifications (unread count, etc.)
    socket.join(`user:${user.id}`);

    // Missed-events catch-up: fetch last 20 activity log rows this user can
    // see, scoped the same way the room joins are scoped above, and push
    // them down on (re)connect. This satisfies "must be fetched from the
    // database, not cached in memory."
    let activityWhere = {};
    if (user.role === "PM") {
      activityWhere = { project: { createdById: user.id } };
    } else if (user.role === "DEVELOPER") {
      activityWhere = { task: { assignedToId: user.id } };
    }
    const missedEvents = await prisma.activityLog.findMany({
      where: activityWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: { name: true } } },
    });
    socket.emit("activity:catchup", missedEvents.reverse());

    socket.on("disconnect", () => {
      onlineUsers.delete(user.id);
      io.emit("presence:count", { count: onlineUsers.size });
    });
  });
}

export function emitActivity(projectId: string, event: any) {
  io.to(`project:${projectId}`).emit("activity:new", event);
  io.to("global").emit("activity:new", event); // admin's global feed
}

export function emitNotification(userId: string, notification: any) {
  io.to(`user:${userId}`).emit("notification:new", notification);
}
