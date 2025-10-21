# Database Migration Scripts

This directory contains database migration scripts for the AutoVista API. These scripts allow you to perform data transformations, schema changes, and other database operations with proper rollback capabilities.

## Directory Structure

```
migrations/
├── config/           # Database configuration and connection utilities
├── scripts/          # Individual migration scripts
├── utils/            # Migration utilities and base classes
├── run-migration.ts  # Migration runner script
└── README.md         # This file
```

## Setup

### 1. Environment Variables

The migration system supports **dual-connection mode** where you can read from one database and write to another. This is perfect for data migration between environments.

**Required Environment Variables:**

```bash
# Source database (where data is read from)
export MIGRATION_SOURCE_URI="mongodb://localhost:27017/source-database"

# Destination database (where processed data is written to)
export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"

# Optional: Override database names
export MIGRATION_SOURCE_DATABASE_NAME="source-database"
export MIGRATION_DESTINATION_DATABASE_NAME="destination-database"

# Optional: Connection timeout in milliseconds
export MIGRATION_TIMEOUT="30000"
```

**Example Setup:**

```bash
# Copy data from production backup to development database
export MIGRATION_SOURCE_URI="mongodb://localhost:27017/production-backup"
export MIGRATION_DEST_URI="mongodb://localhost:27017/development-db"
```

### 2. Dependencies

Make sure you have the required dependencies installed:

```bash
npm install mongoose
npm install -D ts-node typescript @types/node
```

## Usage

### Running Migrations

#### Run All Migrations (Up)

```bash
npx ts-node migrations/run-migration.ts
```

#### Run All Migrations (Down/Rollback)

```bash
npx ts-node migrations/run-migration.ts up down
```

#### Run a Specific Migration

```bash
npx ts-node migrations/run-migration.ts 001-example-migration
```

#### Rollback a Specific Migration

```bash
npx ts-node migrations/run-migration.ts 001-example-migration down
```

#### List Available Migrations

```bash
npx ts-node migrations/run-migration.ts list
```

### Running Individual Migration Scripts

You can also run migration scripts directly:

```bash
npx ts-node migrations/scripts/001-example-migration.ts
npx ts-node migrations/scripts/001-example-migration.ts down
```

## Dual-Connection Migrations

The migration system supports reading from one MongoDB instance and writing to another. This is perfect for:

- **Data migration between environments** (production → development)
- **Data transformation and cleanup** (source → processed)
- **Backup and restore operations**
- **Cross-database data synchronization**

### Dual-Connection Methods

In your migration class, you have access to these methods:

```typescript
class YourMigration extends MigrationBase {
  async up(): Promise<MigrationResult> {
    // Get source connection (where data is read from)
    const sourceConnection = this.getSourceConnection();
    const sourceDb = sourceConnection.connection.db;

    // Get destination connection (where data is written to)
    const destinationConnection = this.getDestinationConnection();
    const destinationDb = destinationConnection.connection.db;

    // Read from source
    const sourceCollection = sourceDb.collection("your-collection");
    const data = await sourceCollection.find({}).toArray();

    // Write to destination
    const destinationCollection = destinationDb.collection("your-collection");
    await destinationCollection.insertMany(data);

    return this.createSuccessResult("Migration completed");
  }
}
```

### Available Connection Methods

- `getSourceConnection()` - Get the source database connection
- `getDestinationConnection()` - Get the destination database connection
- `getSourceDatabaseName()` - Get the source database name
- `getDestinationDatabaseName()` - Get the destination database name

## Creating New Migrations

### 1. Create a New Migration File

Create a new file in the `scripts/` directory following the naming convention:

```
migrations/scripts/XXX-descriptive-name.ts
```

Where `XXX` is a sequential number (001, 002, 003, etc.).

### 2. Migration Template

Use this template for new migrations:

```typescript
import {
  MigrationBase,
  MigrationResult,
  MigrationUtils,
} from "../utils/migration-base";

class YourMigration extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running migration UP...");

      // For dual-connection migrations (read from source, write to destination)
      const sourceConnection = this.getSourceConnection();
      const destinationConnection = this.getDestinationConnection();

      const sourceDb = sourceConnection.connection.db;
      const destinationDb = destinationConnection.connection.db;

      // Your migration logic here
      // Example: Copy and transform data from source to destination
      const sourceCollection = sourceDb.collection("your-collection");
      const destinationCollection = destinationDb.collection("your-collection");

      const data = await sourceCollection.find({}).toArray();

      // Transform data if needed
      const transformedData = data.map((item) => ({
        ...item,
        migratedAt: new Date(),
        migrationVersion: "your-migration-name",
      }));

      const result = await destinationCollection.insertMany(transformedData);

      return this.createSuccessResult(
        `Migrated ${result.insertedCount} documents`,
        result.insertedCount,
      );
    } catch (error) {
      return this.createErrorResult(
        "Migration failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async down(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running migration DOWN (rollback)...");

      // Your rollback logic here
      // This should undo what the up() method did

      return this.createSuccessResult("Rollback completed");
    } catch (error) {
      return this.createErrorResult(
        "Rollback failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  const migration = new YourMigration();
  const direction = process.argv[2] === "down" ? "down" : "up";

  migration
    .run(direction)
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Migration execution failed:", error);
      process.exit(1);
    });
}
```

### 3. Migration Guidelines

- **Always implement both `up()` and `down()` methods**
- **Test your migrations on a copy of production data first**
- **Use batch processing for large datasets** (see `MigrationUtils.batchProcess`)
- **Include proper error handling and logging**
- **Make migrations idempotent when possible**
- **Document what each migration does**

## Available Utilities

### MigrationBase Class

Provides common functionality for all migrations:

- `run(direction)`: Execute the migration with proper connection handling
- `createSuccessResult(message, recordsAffected?)`: Create a success result
- `createErrorResult(message, error?)`: Create an error result
- `getConnection()`: Get the MongoDB connection
- `getDatabaseName()`: Get the database name

### MigrationUtils

Utility functions for common operations:

- `batchProcess(items, processor, batchSize)`: Process large datasets in batches
- `executeWithRetry(operation, maxRetries, delayMs)`: Execute operations with retry logic

## Best Practices

1. **Backup First**: Always backup your database before running migrations
2. **Test Locally**: Test migrations on local/staging environments first
3. **Small Batches**: Process large datasets in small batches to avoid memory issues
4. **Rollback Ready**: Ensure your `down()` method properly reverses the `up()` changes
5. **Logging**: Include detailed logging for debugging and monitoring
6. **Error Handling**: Handle errors gracefully and provide meaningful error messages

## Example Migration Scenarios

### Dual-Connection: Copy Data Between Databases

```typescript
// Copy all quotes from source to destination with transformation
const sourceCollection = sourceDb.collection("quotes");
const destinationCollection = destinationDb.collection("quotes");

const quotes = await sourceCollection.find({}).toArray();
const transformedQuotes = quotes.map((quote) => ({
  ...quote,
  migratedAt: new Date(),
  source: "production-backup",
}));

await destinationCollection.insertMany(transformedQuotes);
```

### Dual-Connection: Selective Data Migration

```typescript
// Migrate only specific data based on criteria
const sourceCollection = sourceDb.collection("quotes");
const destinationCollection = destinationDb.collection("quotes");

const recentQuotes = await sourceCollection
  .find({
    createdAt: { $gte: new Date("2024-01-01") },
  })
  .toArray();

await MigrationUtils.batchProcess(recentQuotes, async (quote) => {
  await destinationCollection.insertOne({
    ...quote,
    migrationMetadata: { migratedAt: new Date() },
  });
});
```

### Single Database: Adding a New Field

```typescript
// Add a new field to all documents in a collection
const collection = db.collection("your-collection");
const result = await collection.updateMany(
  {},
  { $set: { newField: "defaultValue" } },
);
```

### Single Database: Data Transformation

```typescript
// Transform existing data
const cursor = collection.find({});
const documents = await cursor.toArray();

await MigrationUtils.batchProcess(documents, async (doc) => {
  const transformed = transformData(doc);
  await collection.replaceOne({ _id: doc._id }, transformed);
});
```

### Index Creation

```typescript
// Create indexes
await collection.createIndex({ fieldName: 1 });
await collection.createIndex({ field1: 1, field2: -1 });
```

## Troubleshooting

### Connection Issues

- Verify your MongoDB connection string
- Check if MongoDB is running and accessible
- Ensure proper network connectivity

### Permission Issues

- Verify database user has appropriate permissions
- Check if the user can read/write to the target collections

### Performance Issues

- Use batch processing for large datasets
- Consider running migrations during low-traffic periods
- Monitor memory usage during migration execution
