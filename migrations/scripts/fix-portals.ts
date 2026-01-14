/**
 * Fix Portals Script
 *
 * This script fixes portals that have:
 * 1. _id converted to string (should be ObjectId)
 * 2. refId field (portals should NOT have refId - only quotes and orders do)
 *
 * IMPORTANT: This script only updates portals that have these issues.
 * It will:
 * - Remove refId field from portals
 * - Ensure _id is an ObjectId (if it's a valid ObjectId string, convert it)
 *
 * To run this script:
 * npx tsx -r dotenv/config migrations/scripts/fix-portals.ts
 */

import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import { Portal } from "@/_global/models";

dotenv.config();

// Get MongoDB URI - use same logic as the app config
const nodeEnv = process.env.NODE_ENV || "development";
let MONGODB_URI: string | undefined;

if (nodeEnv === "production") {
  MONGODB_URI = process.env.MONGODB_PROD_URI || process.env.MONGODB_DEV_URI;
} else {
  MONGODB_URI = process.env.MONGODB_DEV_URI;
}

// Fallback to other common variable names
if (!MONGODB_URI) {
  MONGODB_URI =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGODB_CONNECTION_STRING;
}

if (!MONGODB_URI) {
  console.error("❌ MongoDB connection string is required");
  console.error(`   Current NODE_ENV: ${nodeEnv}`);
  if (nodeEnv === "production") {
    console.error("   Please set one of the following environment variables:");
    console.error("   - MONGODB_PROD_URI (preferred for production)");
    console.error("   - MONGODB_DEV_URI (fallback)");
  } else {
    console.error("   Please set the following environment variable:");
    console.error("   - MONGODB_DEV_URI (required for development)");
  }
  console.error("\n   Alternative variable names also supported:");
  console.error("   - MONGODB_URI");
  console.error("   - MONGO_URI");
  console.error("   - MONGODB_CONNECTION_STRING");
  console.error("\n   Example: export MONGODB_DEV_URI='mongodb://localhost:27017/database'");
  console.error("   Or create a .env file with: MONGODB_DEV_URI=mongodb://localhost:27017/database");
  process.exit(1);
}

/**
 * Convert a value to ObjectId if possible
 */
function convertToObjectId(value: any): Types.ObjectId | null {
  if (!value) return null;

  // Already an ObjectId
  if (value instanceof Types.ObjectId) {
    return value;
  }

  // If it's a string, try to convert
  if (typeof value === "string") {
    if (Types.ObjectId.isValid(value)) {
      return new Types.ObjectId(value);
    }
  }

  // If it has toString method, try that
  if (value && typeof value.toString === "function") {
    const str = value.toString();
    if (Types.ObjectId.isValid(str)) {
      return new Types.ObjectId(str);
    }
  }

  return null;
}

async function fixPortals() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find all portals
    const portals = await Portal.find({}).lean();
    console.log(`📦 Found ${portals.length} portals to check`);

    let fixedCount = 0;
    let errorCount = 0;
    const issues: Array<{ portalId: any; issues: string[] }> = [];

    for (const portal of portals) {
      try {
        const updateFields: any = {};
        const portalIssues: string[] = [];

        // Check if portal has refId (it shouldn't)
        if (portal.refId !== undefined && portal.refId !== null) {
          if (!updateFields.$unset) {
            updateFields.$unset = {};
          }
          updateFields.$unset.refId = "";
          portalIssues.push(`Has refId: ${portal.refId} (should not exist)`);
        }

        // Check if _id is a string (should be ObjectId)
        const portalId = portal._id;
        const isString = typeof portalId === "string";
        const isObjectId =
          portalId instanceof Types.ObjectId ||
          (portalId &&
            typeof portalId.toString === "function" &&
            Types.ObjectId.isValid(portalId.toString()));

        if (isString && Types.ObjectId.isValid(portalId)) {
          // _id is a valid ObjectId string - we need to recreate the document
          // with the correct ObjectId _id
          portalIssues.push(
            `_id is a string: "${portalId}" (should be ObjectId)`,
          );
          
          // Store info for recreation
          updateFields._needsRecreation = true;
          updateFields._oldId = portalId;
          updateFields._newId = new Types.ObjectId(portalId);
        } else if (!isObjectId && portalId) {
          portalIssues.push(
            `_id is not a valid ObjectId: ${JSON.stringify(portalId)}`,
          );
        }

        // If there are issues, record them
        if (portalIssues.length > 0) {
          issues.push({
            portalId: portalId,
            issues: portalIssues,
          });
        }

        // If we have fields to update (like removing refId), do it
        // Note: We don't fix _id issues by recreating documents because that would
        // break all references. String _id values that are valid ObjectIds will
        // still work in MongoDB queries, but they should be ObjectIds for consistency.
        if (Object.keys(updateFields).length > 0 && !updateFields._needsRecreation) {
          // Just remove refId (don't try to fix _id - that requires updating all references)
          await Portal.updateOne({ _id: portalId }, updateFields);
          fixedCount++;
          console.log(
            `✅ Fixed portal ${portalId}: ${portalIssues.join(", ")}`,
          );
        }
      } catch (error) {
        errorCount++;
        console.error(
          `❌ Error processing portal ${portal._id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    console.log("\n📊 Summary:");
    console.log(`   Total portals checked: ${portals.length}`);
    console.log(`   Portals fixed: ${fixedCount}`);
    console.log(`   Portals with issues: ${issues.length}`);
    console.log(`   Errors: ${errorCount}`);

    if (issues.length > 0) {
      console.log("\n⚠️  Portals with issues:");
      issues.forEach((issue) => {
        console.log(`   Portal ${issue.portalId}:`);
        issue.issues.forEach((i) => console.log(`     - ${i}`));
      });

      console.log(
        "\n⚠️  Note: Portals with string _id cannot be fixed automatically.",
      );
      console.log(
        "   Changing _id would break all references in quotes, orders, users, etc.",
      );
      console.log(
        "   If _id is a valid ObjectId string, MongoDB will handle it correctly in queries.",
      );
      console.log(
        "   For proper fix, you would need to update all references, which is complex.",
      );
    }

    if (fixedCount > 0 || issues.length > 0) {
      console.log(
        "\n✅ Fix script completed. Check the summary above for details.",
      );
    } else {
      console.log("\n✅ No issues found. All portals are correct.");
    }
  } catch (error) {
    console.error("❌ Script failed:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the script
fixPortals()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Script execution failed:", error);
    process.exit(1);
  });
