import { Worker } from "bullmq";
import { env } from "../config/env.js";
import {
  BOOKING_CONFIRMATION_QUEUE,
  EVENT_UPDATE_NOTIFICATION_QUEUE,
  type BookingConfirmationJobData,
  type EventUpdateNotificationJobData,
} from "./queues.js";

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

export function startWorkers(): void {
  const bookingWorker = new Worker<BookingConfirmationJobData>(
    BOOKING_CONFIRMATION_QUEUE,
    async (job) => {
      const { customerEmail, customerName, eventTitle, quantity, totalPrice, bookingId } =
        job.data;
      console.log(
        `[EMAIL] Booking confirmation sent to ${customerEmail} (${customerName}) — ` +
          `Booking ${bookingId}: ${quantity} ticket(s) for "${eventTitle}", total $${totalPrice.toFixed(2)}`
      );
    },
    { connection }
  );

  const eventUpdateWorker = new Worker<EventUpdateNotificationJobData>(
    EVENT_UPDATE_NOTIFICATION_QUEUE,
    async (job) => {
      const { eventTitle, recipientEmails, changesSummary, eventId } = job.data;
      console.log(
        `[NOTIFICATION] Event update for "${eventTitle}" (${eventId}): ${changesSummary}`
      );
      for (const email of recipientEmails) {
        console.log(`  → Notifying customer ${email} about event update`);
      }
    },
    { connection }
  );

  bookingWorker.on("failed", (job, err) => {
    console.error(`[WORKER] Booking confirmation job ${job?.id} failed:`, err.message);
  });

  eventUpdateWorker.on("failed", (job, err) => {
    console.error(`[WORKER] Event update notification job ${job?.id} failed:`, err.message);
  });

  console.log("Background workers started (booking confirmation, event update notification)");
}
