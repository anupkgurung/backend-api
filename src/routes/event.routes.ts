import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { routeParam } from "../lib/params.js";
import * as eventService from "../services/event.service.js";

const router = Router();

const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  venue: z.string().min(1),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  totalTickets: z.number().int().positive(),
  pricePerTicket: z.number().positive(),
});

const updateEventSchema = createEventSchema.partial();

router.get("/", async (req, res, next) => {
  try {
    const upcoming = req.query.upcoming === "true";
    const events = await eventService.listEvents({ upcoming: upcoming || undefined });
    res.json({ events });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/mine",
  authenticate,
  requireRoles(Role.ORGANIZER),
  async (req, res, next) => {
    try {
      const events = await eventService.listOrganizerEvents(req.user!.id);
      res.json({ events });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/:id", async (req, res, next) => {
  try {
    const event = await eventService.getEventById(routeParam(req, "id"));
    res.json({ event });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/",
  authenticate,
  requireRoles(Role.ORGANIZER),
  async (req, res, next) => {
    try {
      const body = createEventSchema.parse(req.body);
      const event = await eventService.createEvent(req.user!.id, body);
      res.status(201).json({ event });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/:id",
  authenticate,
  requireRoles(Role.ORGANIZER),
  async (req, res, next) => {
    try {
      const body = updateEventSchema.parse(req.body);
      const event = await eventService.updateEvent(routeParam(req, "id"), req.user!.id, body);
      res.json({ event });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/:id",
  authenticate,
  requireRoles(Role.ORGANIZER),
  async (req, res, next) => {
    try {
      await eventService.deleteEvent(routeParam(req, "id"), req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
