import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth";
import clientRoutes from "./routes/clients";
import projectRoutes from "./routes/projects";
import taskRoutes from "./routes/tasks";
import notificationRoutes from "./routes/notifications";
import dashboardRoutes from "./routes/dashboard";
import { initSocket } from "./socket";
import { startOverdueChecker } from "./jobs/overdueChecker";

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Consistent structured error handler — never leak stack traces to the client
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: {
      message: status === 500 ? "Internal server error" : err.message,
    },
  });
});

initSocket(server);
startOverdueChecker();

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
