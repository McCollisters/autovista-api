import { ModifierSetMigration } from "./migrate-modifier-sets";
import { BackfillPortalAdminCommissionFlag } from "./backfill-portal-admin-commission-flag";

const run = async () => {
  try {
    console.log("🧹 Wiping modifier sets in destination database...");
    const downResult = await new ModifierSetMigration().run("down");
    if (!downResult.success) {
      process.exit(1);
    }

    console.log("♻️ Remigrating modifier sets from source database...");
    const upResult = await new ModifierSetMigration().run("up");
    if (!upResult.success) {
      process.exit(1);
    }

    console.log("🧩 Backfilling portal admin commission flag...");
    const backfillResult = await new BackfillPortalAdminCommissionFlag().run(
      "up",
    );
    process.exit(backfillResult.success ? 0 : 1);
  } catch (error) {
    console.error("💥 Refresh modifier sets failed:", error);
    process.exit(1);
  }
};

run();
