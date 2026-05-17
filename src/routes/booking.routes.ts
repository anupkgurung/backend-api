import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { routeParam } from "../lib/params.js";
import * as bookingService from "../services/booking.service.js";

const router = Router();

const createBookingSchema = z.object({
  eventId: z.string().min(1),
  quantity: z.number().int().positive(),
});

router.post(
  "/",
  authenticate,
  requireRoles(Role.CUSTOMER),
  async (req, res, next) => {
    try {
      const body = createBookingSchema.parse(req.body);
      const booking = await bookingService.createBooking(
        req.user!.id,
        body.eventId,
        body.quantity
      );
      res.status(201).json({ booking });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/",
  authenticate,
  requireRoles(Role.CUSTOMER),
  async (req, res, next) => {
    try {
      const bookings = await bookingService.listCustomerBookings(req.user!.id);
      res.json({ bookings });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/event/:eventId",
  authenticate,
  requireRoles(Role.ORGANIZER),
  async (req, res, next) => {
    try {
      const bookings = await bookingService.listEventBookings(
        routeParam(req, "eventId"),
        req.user!.id
      );
      res.json({ bookings });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const booking = await bookingService.getBookingById(
      routeParam(req, "id"),
      req.user!.id,
      req.user!.role
    );
    res.json({ booking });
  } catch (err) {
    next(err);
  }
});

export default router;
