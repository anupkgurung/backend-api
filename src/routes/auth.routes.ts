import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import * as authService from "../services/auth.service.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  role: z.enum([Role.ORGANIZER, Role.CUSTOMER]),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const result = await authService.registerUser(body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await authService.loginUser(body.email, body.password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await authService.getUserById(req.user!.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
