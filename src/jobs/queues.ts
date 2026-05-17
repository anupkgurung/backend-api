import { Queue } from "bullmq";
import { env } from "../config/env.js";

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

export const BOOKING_CONFIRMATION_QUEUE = "booking-confirmation";
export const EVENT_UPDATE_NOTIFICATION_QUEUE = "event-update-notification";

export interface BookingConfirmationJobData {
  bookingId: string;
  customerEmail: string;
  customerName: string;
  eventTitle: string;
  quantity: number;
  totalPrice: number;
}

export interface EventUpdateNotificationJobData {
  eventId: string;
  eventTitle: string;
  recipientEmails: string[];
  changesSummary: string;
}

export const bookingConfirmationQueue = new Queue<BookingConfirmationJobData>(
  BOOKING_CONFIRMATION_QUEUE,
  { connection }
);

export const eventUpdateNotificationQueue = new Queue<EventUpdateNotificationJobData>(
  EVENT_UPDATE_NOTIFICATION_QUEUE,
  { connection }
);
