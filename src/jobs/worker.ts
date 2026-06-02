import { Queue, Worker } from "bullmq";
import { BEIJING_TIMEZONE, DAILY_UPDATE_CRON } from "../lib/constants";
import { runDailyFetchPipeline } from "../lib/pipeline/daily-fetch";
import { runCoreLibrarySyncAll } from "../lib/pipeline/core-library";
import { seedJournalTable } from "../lib/journal-if";
import { getRedisConnection } from "../lib/redis-connection";

const connection = getRedisConnection();

export const fetchQueue = new Queue("daily-fetch", { connection });

async function main() {
  console.log("[worker] Starting BullMQ worker...");

  await seedJournalTable().catch(console.error);

  await fetchQueue.add(
    "daily-fetch",
    {},
    {
      repeat: { pattern: DAILY_UPDATE_CRON, tz: BEIJING_TIMEZONE },
      removeOnComplete: 10,
      removeOnFail: 20,
    }
  );

  const worker = new Worker(
    "daily-fetch",
    async () => {
      console.log("[worker] Running daily fetch pipeline...");
      const result = await runDailyFetchPipeline();
      console.log("[worker] Daily fetch done:", result);
      if (process.env.ENABLE_CORE_SYNC !== "false") {
        const core = await runCoreLibrarySyncAll();
        console.log("[worker] Core library sync:", core);
      }
      return result;
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    console.error(`[worker] Job ${job?.id} failed:`, err);
  });

  console.log(`[worker] Scheduled daily fetch at 07:00 Beijing (${DAILY_UPDATE_CRON}, tz=${BEIJING_TIMEZONE})`);
  console.log("[worker] Keep this process running — no manual fetch needed each day.");
  console.log("[worker] Requires Redis (docker compose up -d redis).");
}

process.on("SIGINT", () => {
  console.log("[worker] Shutting down...");
  process.exit(0);
});

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
