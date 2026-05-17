import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const organizer = await prisma.user.upsert({
    where: { email: "organizer@example.com" },
    update: {},
    create: {
      email: "organizer@example.com",
      passwordHash,
      name: "Jane Organizer",
      role: Role.ORGANIZER,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      email: "customer@example.com",
      passwordHash,
      name: "John Customer",
      role: Role.CUSTOMER,
    },
  });

  const start = new Date();
  start.setDate(start.getDate() + 14);
  const end = new Date(start);
  end.setHours(end.getHours() + 3);

  await prisma.event.upsert({
    where: { id: "seed-event-1" },
    update: {},
    create: {
      id: "seed-event-1",
      title: "Tech Conference 2026",
      description: "Annual technology conference with keynotes and workshops.",
      venue: "Convention Center Hall A",
      startTime: start,
      endTime: end,
      totalTickets: 100,
      availableTickets: 100,
      pricePerTicket: 49.99,
      organizerId: organizer.id,
    },
  });

  console.log("Seed complete:");
  console.log(`  Organizer: organizer@example.com / password123 (id: ${organizer.id})`);
  console.log(`  Customer:  customer@example.com / password123 (id: ${customer.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
