import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/token";

const router = Router();

const REFRESH_COOKIE_NAME = "refreshToken";
const isProd = process.env.NODE_ENV === "production";

function setRefreshCookie(res: any, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd, // must be true in production (HTTPS)
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/api/auth", // scoped narrowly to auth endpoints
  });
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: "Invalid input", details: parsed.error.flatten() } });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: { message: "Invalid credentials" } });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: { message: "Invalid credentials" } });
  }

  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id });

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  setRefreshCookie(res, refreshToken);
  res.json({
    accessToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: { message: "No refresh token" } });
  }

  try {
    const payload = verifyRefreshToken(token);

    // Confirm this exact token is still valid/not revoked in the DB
    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: { message: "Refresh token expired or revoked" } });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return res.status(401).json({ error: { message: "User no longer exists" } });
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    res.json({ accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    return res.status(401).json({ error: { message: "Invalid refresh token" } });
  }
});

router.post("/logout", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (token) {
    await prisma.refreshToken.deleteMany({ where: { token } });
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
  res.json({ success: true });
});

export default router;
