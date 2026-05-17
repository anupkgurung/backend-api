import { BookingStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { bookingConfirmationQueue } from "../jobs/queues.js";
import { AppError } from "../middleware/errorHandler.js";

export async function createBooking(
  customerId: string,
  eventId: string,
  quantity: number
) {
  if (quantity < 1) {
    throw new AppError(400, "quantity must be at least 1", "INVALID_QUANTITY");
  }

  const booking = await prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new AppError(404, "Event not found", "NOT_FOUND");
    }
    if (event.startTime < new Date()) {
      throw new AppError(400, "Cannot book tickets for past events", "EVENT_PAST");
    }
    if (event.availableTickets < quantity) {
      throw new AppError(400, "Not enough tickets available", "INSUFFICIENT_TICKETS");
    }

    const customer = await tx.user.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new AppError(404, "Customer not found", "NOT_FOUND");
    }

    const totalPrice = event.pricePerTicket * quantity;

    const updatedEvent = await tx.event.update({
      where: { id: eventId },
      data: { availableTickets: { decrement: quantity } },
    });

    if (updatedEvent.availableTickets < 0) {
      throw new AppError(400, "Not enough tickets available", "INSUFFICIENT_TICKETS");
    }

    return tx.booking.create({
      data: {
        eventId,
        customerId,
        quantity,
        totalPrice,
        status: BookingStatus.CONFIRMED,
      },
      include: {
        event: { select: { title: true } },
        customer: { select: { email: true, name: true } },
      },
    });
  });

  await bookingConfirmationQueue.add(
    "send-confirmation",
    {
      bookingId: booking.id,
      customerEmail: booking.customer.email,
      customerName: booking.customer.name,
      eventTitle: booking.event.title,
      quantity: booking.quantity,
      totalPrice: booking.totalPrice,
    },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    }
  );

  return booking;
}

export async function listCustomerBookings(customerId: string) {
  return prisma.booking.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          venue: true,
          startTime: true,
          endTime: true,
        },
      },
    },
  });
}

export async function getBookingById(bookingId: string, userId: string, role: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      event: { include: { organizer: { select: { id: true } } } },
      customer: { select: { id: true, name: true, email: true } },
    },
  });

  if (!booking) {
    throw new AppError(404, "Booking not found", "NOT_FOUND");
  }

  const isCustomer = booking.customerId === userId;
  const isOrganizer =
    role === "ORGANIZER" && booking.event.organizer.id === userId;

  if (!isCustomer && !isOrganizer) {
    throw new AppError(403, "Access denied", "FORBIDDEN");
  }

  return booking;
}

export async function listEventBookings(eventId: string, organizerId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError(404, "Event not found", "NOT_FOUND");
  }
  if (event.organizerId !== organizerId) {
    throw new AppError(403, "You can only view bookings for your own events", "FORBIDDEN");
  }

  return prisma.booking.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, name: true, email: true } },
    },
  });
}
