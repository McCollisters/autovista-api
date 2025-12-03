import cron from "node-cron";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "./logger";

const execAsync = promisify(exec);

/**
 * Initialize cron jobs
 * This function sets up scheduled tasks that run automatically
 */
export function initializeCronJobs() {
  // Run migrations every 3 hours
  // Cron format: minute hour day month day-of-week
  // "30 */3 * * *" means: at minute 30, every 3 hours (12:30 AM, 3:30 AM, 6:30 AM, 9:30 AM, 12:30 PM, 3:30 PM, 6:30 PM, 9:30 PM EST)
  cron.schedule(
    "30 */3 * * *",
    async () => {
      logger.info("🕐 Scheduled migration job started (every 3 hours)");

      try {
        // Run the migration using npm script (same as: npm run migrate:all)
        const { stdout, stderr } = await execAsync("npm run migrate:all", {
          cwd: process.cwd(),
          env: process.env,
        });

        // Log the output
        if (stdout) {
          logger.info("Migration output:", { output: stdout });
        }

        if (stderr) {
          logger.warn("Migration stderr:", { output: stderr });
        }

        logger.info("✅ Scheduled migration job completed successfully");
      } catch (error: any) {
        // execAsync throws an error if the command exits with non-zero code
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorOutput = error.stdout || error.stderr || "";

        logger.error("❌ Scheduled migration job failed", {
          error: errorMessage,
          output: errorOutput,
          code: error.code,
        });
      }
    },
    {
      timezone: "America/New_York", // Adjust timezone as needed
    },
  );

  logger.info("✅ Cron jobs initialized - Migration scheduled every 3 hours");
}
