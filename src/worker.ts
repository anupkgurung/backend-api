import { startWorkers } from "./jobs/workers.js";

startWorkers();

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
