# Migration Debugging Guide

## Understanding the Migration Cron Job

The cron job in `src/core/cron.ts` runs **database migrations** every 3 hours. This is NOT business logic processing - it's data migration between databases/formats.

### What Migrations Should Run

The `migrate:all` script should process **ALL** collections in this order:

1. ✅ **Portals** (must be first - other docs reference portals)
2. ✅ **Users** (must be second - other docs reference users)
3. ✅ **Modifier Sets** (references portals)
4. ✅ **Quotes** (references portals, users)
5. ✅ **Orders** (references quotes, users, portals)
6. ✅ **Surveys**
7. ✅ **Survey Responses** (references surveys, orders, users)
8. ✅ **Notification Logs** (references orders)

### Why Only Portals Might Be Processing

If you're only seeing portals being processed, check:

1. **Migration Limits**: Each migration has a `MAX_*_TO_PROCESS` constant:
   - Portals: `MAX_PORTALS_TO_PROCESS = 15` (in `migrations/scripts/migrate-portals.ts`)
   - Quotes: `MAX_QUOTES_TO_PROCESS = 500` (in `migrations/scripts/migrate-quotes.ts`)
   - Orders: `MAX_ORDERS_TO_PROCESS = 250` (in `migrations/scripts/migrate-orders.ts`)

2. **Database Connection Issues**: Check if migrations are failing after portals:
   ```bash
   # Check migration logs
   tail -f logs/combined.log | grep -i migration
   ```

3. **Empty Source Collections**: If source database has no quotes/orders to migrate, you'll see 0 records processed.

4. **Migration Errors**: Check for errors in the migration output. The migration continues even if one fails, but errors might indicate issues.

### How to Verify All Migrations Are Running

1. **Check Migration Output**: Look for lines like:
   ```
   ✅ Portals migration completed: 15 records
   ✅ Quotes migration completed: 500 records
   ✅ Orders migration completed: 250 records
   ```

2. **Run Migration Manually**:
   ```bash
   npm run migrate:all
   ```
   
   This should show output for ALL collections.

3. **Check Logs**: The cron job logs to:
   - `logs/combined.log`
   - `logs/error.log`
   
   Look for migration job entries every 3 hours.

### Debugging Steps

1. **Check if migrations are actually running**:
   ```bash
   # Check recent cron job executions
   grep "Scheduled migration job" logs/combined.log | tail -20
   ```

2. **Verify environment variables are set**:
   ```bash
   # Required for migrations
   echo $MIGRATION_SOURCE_URI
   echo $MIGRATION_DEST_URI
   ```

3. **Run individual migrations** to test:
   ```bash
   # Test quotes migration
   npx tsx -r dotenv/config migrations/scripts/migrate-quotes.ts
   
   # Test orders migration
   npx tsx -r dotenv/config migrations/scripts/migrate-orders.ts
   ```

4. **Check migration limits**: If you want to process ALL records, set limits to `null`:
   ```typescript
   // In migrate-quotes.ts
   const MAX_QUOTES_TO_PROCESS = null; // Process all quotes
   
   // In migrate-orders.ts
   const MAX_ORDERS_TO_PROCESS = null; // Process all orders
   ```

### Expected Behavior

The migration system is designed to:
- ✅ Continue processing even if one migration fails
- ✅ Log all results (successful and failed)
- ✅ Process all collections, not just portals

If only portals are showing in logs, it's likely:
- Other migrations are failing silently
- Source database doesn't have quotes/orders to migrate
- Logs are being truncated/filtered

