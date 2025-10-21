import { MongoClient } from "mongodb";

async function checkMigrationResults() {
  const client = new MongoClient(
    "mongodb://anna:K1lXzftA6NpMpwM6@autovista.nzynb.mongodb.net/dev",
  );

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db("dev");
    const quotes = db.collection("quotes");

    // Get a sample quote
    const quote = await quotes.findOne({});

    if (!quote) {
      console.log("❌ No quotes found");
      return;
    }

    console.log("📊 Sample Quote Results:");
    console.log("Quote ID:", quote._id);
    console.log("\n🔍 Vehicle Pricing Totals:");

    if (quote.vehicles && quote.vehicles.length > 0) {
      const vehicle = quote.vehicles[0];
      console.log(
        "three:",
        JSON.stringify(vehicle.pricing.totals.three, null, 2),
      );
      console.log(
        "five:",
        JSON.stringify(vehicle.pricing.totals.five, null, 2),
      );
      console.log(
        "seven:",
        JSON.stringify(vehicle.pricing.totals.seven, null, 2),
      );
    }

    console.log("\n🔍 Total Pricing Totals:");
    console.log(
      "three:",
      JSON.stringify(quote.totalPricing.totals.three, null, 2),
    );
    console.log(
      "five:",
      JSON.stringify(quote.totalPricing.totals.five, null, 2),
    );
    console.log(
      "seven:",
      JSON.stringify(quote.totalPricing.totals.seven, null, 2),
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.close();
    console.log("✅ Disconnected from MongoDB");
  }
}

checkMigrationResults();
