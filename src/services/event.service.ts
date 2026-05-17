import { prisma } from "../lib/prisma.js";
import {
  eventUpdateNotificationQueue,
  type EventUpdateNotificationJobData,
} from "../jobs/queues.js";
import { AppError } from "../middleware/errorHandler.js";

export async function createEvent(
  organizerId: string,
  data: {
    title: string;
    description: string;
    venue: string;
    startTime: Date;
    endTime: Date;
    totalTickets: number;
    pricePerTicket: number;
  }
) {
  if (data.endTime <= data.startTime) {
    throw new AppError(400, "endTime must be after startTime", "INVALID_DATES");
  }
  if (data.totalTickets < 1) {
    throw new AppError(400, "totalTickets must be at least 1", "INVALID_TICKETS");
  }

  return prisma.event.create({
    data: {
      ...data,
      availableTickets: data.totalTickets,
      organizerId,
    },
    include: {
      organizer: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function listEvents(filters?: { upcoming?: boolean }) {
  const where =
    filters?.upcoming === true
      ? { startTime: { gte: new Date() }, availableTickets: { gt: 0 } }
      : {};

  return prisma.event.findMany({
    where,
    orderBy: { startTime: "asc" },
    include: {
      organizer: { select: { id: true, name: true } },
    },
  });
}

export async function getEventById(id: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      organizer: { select: { id: true, name: true, email: true } },
    },
  });
  if (!event) {
    throw new AppError(404, "Event not found", "NOT_FOUND");
  }
  return event;
}

export async function updateEvent(
  eventId: string,
  organizerId: string,
  data: Partial<{ title: string; description: string; venue: string }>
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError(404, "Event not found", "NOT_FOUND");
  }
  if (event.organizerId !== organizerId) {
    throw new AppError(403, "You can only update your own events", "FORBIDDEN");
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data,
    include: {
      organizer: { select: { id: true, name: true, email: true } },
    },
  });

  const changes = (Object.keys(data) as (keyof typeof data)[]).filter(
    (key) => data[key] !== undefined && data[key] !== event[key]
  );

  if (changes.length > 0) {
    await enqueueEventUpdateNotifications(eventId, updated.title, changes);
  }

  return updated;
}

export async function listOrganizerEvents(organizerId: string) {
  return prisma.event.findMany({
    where: { organizerId },
    orderBy: { startTime: "asc" },
    include: {
      _count: { select: { bookings: true } },
    },
  });
}

async function enqueueEventUpdateNotifications(
  eventId: string,
  eventTitle: string,
  changedFields: string[]
) {
  const bookings = await prisma.booking.findMany({
    where: { eventId, status: "CONFIRMED" },
    include: { customer: { select: { email: true } } },
    distinct: ["customerId"],
  });

  const recipientEmails = [...new Set(bookings.map((b) => b.customer.email))];
  if (recipientEmails.length === 0) return;

  const jobData: EventUpdateNotificationJobData = {
    eventId,
    eventTitle,
    recipientEmails,
    changesSummary: `Updated fields: ${changedFields.join(", ")}`,
  };

  await eventUpdateNotificationQueue.add("notify-customers", jobData, {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  });
}
