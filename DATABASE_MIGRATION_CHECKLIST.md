# Database Migration Checklist

This document lists all configuration values that were **hardcoded in the original API** (`mc_portal_api`) and have been **moved to the database** in the new API (`autovista-api`). Use this checklist to ensure all portals and settings are properly configured in your database.

## Table of Contents

- [Portal Options (portal.options)](#portal-options-portaloptions)
- [Portal Custom Rates (portal.customRates)](#portal-custom-rates-portalcustomrates)
- [Global Settings (Settings Model)](#global-settings-settings-model)
- [Modifier Sets (ModifierSet Model)](#modifier-sets-modifierset-model)
- [Migration Mapping Reference](#migration-mapping-reference)

---

## Portal Options (portal.options)

These flags and settings were previously direct fields on the Portal model and are now nested under `portal.options`:

### Rate Calculation Options

| Old Field (mc_portal_api) | New Field (autovista-api) | Default | Description |
|---------------------------|---------------------------|---------|-------------|
| `hasCustomRates` | `options.enableCustomRates` | `false` | Enable custom rate calculation instead of TMS rates |
| `hasJKRateCalculation` | `options.enableJKRateCalculation` | `false` | Enable JK Moving-specific rate calculation (70/30 split) |
| `hasVariableCompanyTariff` | `options.enableVariableCompanyTariff` | `false` | Enable variable company tariff calculation |
| `hasWhiteGloveOverride` | `options.enableWhiteGloveOverride` | `false` | Enable white glove override pricing |

**How to Check:**
```javascript
// MongoDB query
db.portals.find({}, { companyName: 1, "options.enableCustomRates": 1, "options.enableJKRateCalculation": 1 })

// Example update
db.portals.updateOne(
  { _id: ObjectId("portal_id_here") },
  { $set: { "options.enableJKRateCalculation": true } }
)
```

### Display & UI Options

| Old Field (mc_portal_api) | New Field (autovista-api) | Default | Description |
|---------------------------|---------------------------|---------|-------------|
| `displayMCLogo` | `options.overrideLogo` | `false` | **Inverted**: `false` = show MC logo, `true` = override with portal logo |
| `displayAgent` | `options.orderForm.enableAgent` | `true` | Show/hide agent field in order form |
| `displayPaymentType` | `options.orderForm.defaultPaymentType` | `null` | If `false` in old API, set to `"cod"`; otherwise `null` |
| `displayPDFTotalPriceOnly` | `options.orderPDF.enablePriceBreakdown` | `true` | **Inverted**: `false` = show breakdown, `true` = total only |
| `displayDiscountOption` | `options.portalAdmin.enableDiscount` | `true` | Enable/disable discount option for portal admin |
| `displayPortalCommission` | `options.quoteDetail.displayCommission` | `true` | Display commission in quote details |
| `displayCommissionPerVehicle` | `options.quoteForm.enableCommissionPerVehicle` | `true` | Enable commission per vehicle in quote form |

**How to Check:**
```javascript
// Check all display options
db.portals.find({}, {
  companyName: 1,
  "options.orderForm": 1,
  "options.quoteDetail": 1,
  "options.orderPDF": 1,
  "options.portalAdmin": 1
})
```

### Feature Flags

| Old Field (mc_portal_api) | New Field (autovista-api) | Default | Description |
|---------------------------|---------------------------|---------|-------------|
| `allowsCustomerTracking` | `options.enableOrderTrackingByCustomer` | `true` | Allow customers to track orders |
| `locationTypeIsRequired` | `options.orderForm.requireLocationType` | `true` | Require location type (Residence/Business) in order form |
| N/A (new) | `options.enableSurvey` | `true` | Enable survey functionality (new feature) |

### Quote Expiration

| Old Field (mc_portal_api) | New Field (autovista-api) | Default | Description |
|---------------------------|---------------------------|---------|-------------|
| `portalQuoteExpirationDays` | `options.quoteExpiryDays` | `30` | Number of days before quote expires |

**How to Check:**
```javascript
// Check quote expiration settings
db.portals.find({}, {
  companyName: 1,
  "options.quoteExpiryDays": 1
})
```

---

## Portal Custom Rates (portal.customRates)

Custom rates were previously stored in `portal.customRates` as an object with nested properties. They are now stored as an array of rate objects.

### Old Format (mc_portal_api)
```javascript
{
  customRates: {
    mileage: {
      "1-250": 200,
      "251-500": 400,
      // ... etc
    },
    largeClassSurcharge: 50,
    suvClassSurcharge: 75,
    vanClassSurcharge: 100,
    pickUp4DoorClassSurcharge: 25,
    enclosedSurcharge: 200,
    enclosedSurchargeOver1500: 300,
    fuelSurcharge: 5
  }
}
```

### New Format (autovista-api)
```javascript
{
  customRates: [
    {
      label: "1-250 miles",
      min: 1,
      max: 250,
      value: 200
    },
    {
      label: "251-500 miles",
      min: 251,
      max: 500,
      value: 400
    },
    {
      label: "SUV Class Surcharge",
      min: 0,
      max: 0,
      value: 75
    },
    {
      label: "Enclosed Surcharge Over 1500",
      min: 1500,
      max: 999999,
      value: 300
    }
    // ... etc
  ]
}
```

### Custom Rate Fields to Migrate

| Old Field | New Format | Notes |
|-----------|------------|-------|
| `customRates.mileage["1-250"]` | `{ label: "1-250 miles", min: 1, max: 250, value: X }` | Mileage-based rates |
| `customRates.mileage["251-500"]` | `{ label: "251-500 miles", min: 251, max: 500, value: X }` | |
| `customRates.mileage["501-750"]` | `{ label: "501-750 miles", min: 501, max: 750, value: X }` | |
| `customRates.mileage["751-1000"]` | `{ label: "751-1000 miles", min: 751, max: 1000, value: X }` | |
| `customRates.mileage["1001-1250"]` | `{ label: "1001-1250 miles", min: 1001, max: 1250, value: X }` | |
| `customRates.mileage["1251-1500"]` | `{ label: "1251-1500 miles", min: 1251, max: 1500, value: X }` | |
| `customRates.mileage["1501-1750"]` | `{ label: "1501-1750 miles", min: 1501, max: 1750, value: X }` | |
| `customRates.mileage["1751-2000"]` | `{ label: "1751-2000 miles", min: 1751, max: 2000, value: X }` | |
| `customRates.mileage["2001-2500"]` | `{ label: "2001-2500 miles", min: 2001, max: 2500, value: X }` | |
| `customRates.mileage["2501-3000"]` | `{ label: "2501-3000 miles", min: 2501, max: 3000, value: X }` | |
| `customRates.mileage["3001-3500"]` | `{ label: "3001-3500 miles", min: 3001, max: 3500, value: X }` | |
| `customRates.mileage["3501"]` | `{ label: "3501+ miles", min: 3501, max: 999999, value: X }` | |
| `customRates.largeClassSurcharge` | `{ label: "Large Class Surcharge", min: 0, max: 0, value: X }` | Flat surcharge |
| `customRates.suvClassSurcharge` | `{ label: "SUV Class Surcharge", min: 0, max: 0, value: X }` | Flat surcharge |
| `customRates.vanClassSurcharge` | `{ label: "Van Class Surcharge", min: 0, max: 0, value: X }` | Flat surcharge |
| `customRates.pickUp4DoorClassSurcharge` | `{ label: "Pickup 4-Door Class Surcharge", min: 0, max: 0, value: X }` | Flat surcharge |
| `customRates.enclosedSurcharge` | `{ label: "Enclosed Surcharge", min: 0, max: 0, value: X }` | Flat surcharge |
| `customRates.enclosedSurchargeOver1500` | `{ label: "Enclosed Surcharge Over 1500", min: 1500, max: 999999, value: X }` | Conditional surcharge |
| `customRates.fuelSurcharge` | `{ label: "Fuel Surcharge", min: 0, max: 0, value: X }` | Percentage surcharge |

**How to Check:**
```javascript
// Find portals with custom rates
db.portals.find({ "options.enableCustomRates": true }, {
  companyName: 1,
  customRates: 1
})

// Check if custom rates are in old format (object) or new format (array)
db.portals.find({
  $or: [
    { "customRates.mileage": { $exists: true } }, // Old format
    { "customRates.0": { $exists: true } } // New format (array)
  ]
})
```

---

## Global Settings (Settings Model)

These values were previously in the Settings model but may have been hardcoded in some places. They are now stored in the `Settings` collection:

### Transit Times

| Old Field | New Field | Type | Description |
|-----------|-----------|------|-------------|
| `transitTimes` | `transitTimes` | Array | Array of `{ minMiles, maxMiles, minDays, maxDays }` |

**Example:**
```javascript
{
  transitTimes: [
    { minMiles: 0, maxMiles: 500, minDays: 1, maxDays: 3 },
    { minMiles: 501, maxMiles: 1000, minDays: 3, maxDays: 5 },
    // ... etc
  ]
}
```

### Holidays

| Old Field | New Field | Type | Description |
|-----------|-----------|------|-------------|
| `holidays[].date` | `holidays[]` | Array of Date | Array of holiday dates (now Date objects, not strings) |

**How to Check:**
```javascript
db.settings.find({}, { holidays: 1, transitTimes: 1 })
```

### Service Levels

| Old Field | New Field | Type | Description |
|-----------|-----------|------|-------------|
| `serviceLevels[]` | `serviceLevels[]` | Array | Array of `{ name, value, markup }` |

**Example:**
```javascript
{
  serviceLevels: [
    { name: "1 Day", value: "1", markup: 0 },
    { name: "3 Day", value: "3", markup: 100 },
    { name: "5 Day", value: "5", markup: 200 },
    { name: "7 Day", value: "7", markup: 300 }
  ]
}
```

### Quote Expiration (Global)

| Old Field | New Field | Default | Description |
|-----------|-----------|---------|-------------|
| `quoteExpirationDays` | `quoteExpirationDays` | `10` | Global default quote expiration days |

**Note:** Portal-specific `quoteExpiryDays` in `portal.options` overrides this global setting.

---

## Modifier Sets (ModifierSet Model)

**NEW FEATURE**: Modifier sets are a new concept that consolidates pricing modifiers that were previously scattered across portals and settings.

### Global Modifier Set

A single global modifier set (`isGlobal: true`) contains system-wide pricing modifiers:

| Old Source | New Field (ModifierSet) | Type | Description |
|------------|-------------------------|------|-------------|
| `settings.inoperableMarkup` | `modifiers.inoperable` | `{ value, valueType }` | Inoperable vehicle markup |
| `settings.enclosedMarkup` | `modifiers.enclosedFlat` | `{ value, valueType }` | Flat enclosed transport fee |
| `settings.enclosedModifier` | `modifiers.enclosedPercent` | `{ value, valueType }` | Percentage enclosed modifier |
| `settings.whiteGloveMinimum` | `whiteGlove.minimum` | Number | White glove minimum price |
| `settings.whiteGloveModifier` | `whiteGlove.multiplier` | Number | White glove multiplier |
| `settings.serviceLevels[]` | `modifiers.serviceLevels[]` | Array | Service level markups |
| `settings.stateModifiers[]` | `modifiers.states` | Map | State-specific modifiers |
| `settings.stateToStateModifiers[]` | `modifiers.routes` | Map | Route-specific modifiers |

**How to Check:**
```javascript
// Find global modifier set
db.modifiersets.find({ isGlobal: true })

// Check if it exists
db.modifiersets.countDocuments({ isGlobal: true })
```

### Portal-Specific Modifier Sets

Each portal can have its own modifier set (`portalId` field) that overrides global modifiers:

| Old Source | New Field (ModifierSet) | Type | Description |
|------------|-------------------------|------|-------------|
| `portal.companyTariff` | `companyTariff` | `{ value, valueType }` | Portal company tariff |
| `portal.companyTariffOpenTransport` | `companyTariffOpen` | `{ value, valueType }` | Open transport tariff |
| `portal.companyTariffEnclosedTransport` | `companyTariffEnclosed` | `{ value, valueType }` | Enclosed transport tariff |
| `portal.companyTariffIsPercent` | `companyTariff.valueType` | `"percentage"` or `"flat"` | Tariff type |
| `portal.discount` | `modifiers.portalDiscount` | `{ value, valueType }` | Portal discount |
| `portal.portalAdminDiscount` | `modifiers.portalDiscount` | `{ value, valueType }` | Portal admin discount |
| `portal.portalCommission` | `modifiers.commission` | `{ value, valueType }` | Portal commission |

**How to Check:**
```javascript
// Find portal-specific modifier sets
db.modifiersets.find({ isGlobal: false }, { portalId: 1 })

// Check which portals have modifier sets
db.modifiersets.aggregate([
  { $match: { isGlobal: false } },
  { $group: { _id: "$portalId", count: { $sum: 1 } } }
])
```

---

## Migration Mapping Reference

### Complete Field Mapping

#### Portal Options Mapping

```javascript
// Old API → New API mapping
{
  // Rate calculation flags
  hasCustomRates → options.enableCustomRates
  hasJKRateCalculation → options.enableJKRateCalculation (NEW - check if portal needs JK rates)
  hasVariableCompanyTariff → options.enableVariableCompanyTariff
  hasWhiteGloveOverride → options.enableWhiteGloveOverride
  
  // Display options (some inverted logic)
  displayMCLogo → options.overrideLogo (INVERTED: false = show MC logo)
  displayAgent → options.orderForm.enableAgent
  displayPaymentType → options.orderForm.defaultPaymentType (false → "cod", true → null)
  displayPDFTotalPriceOnly → options.orderPDF.enablePriceBreakdown (INVERTED)
  displayDiscountOption → options.portalAdmin.enableDiscount
  displayPortalCommission → options.quoteDetail.displayCommission
  displayCommissionPerVehicle → options.quoteForm.enableCommissionPerVehicle
  
  // Feature flags
  allowsCustomerTracking → options.enableOrderTrackingByCustomer
  locationTypeIsRequired → options.orderForm.requireLocationType
  portalQuoteExpirationDays → options.quoteExpiryDays
  
  // NEW fields (set defaults)
  options.enableSurvey → true (default)
}
```

#### Custom Rates Mapping

```javascript
// Old format (object) → New format (array)
{
  customRates.mileage["1-250"] → customRates: [{ label: "1-250 miles", min: 1, max: 250, value: X }]
  customRates.mileage["251-500"] → customRates: [{ label: "251-500 miles", min: 251, max: 500, value: X }]
  // ... all mileage ranges
  
  customRates.largeClassSurcharge → customRates: [{ label: "Large Class Surcharge", min: 0, max: 0, value: X }]
  customRates.suvClassSurcharge → customRates: [{ label: "SUV Class Surcharge", min: 0, max: 0, value: X }]
  customRates.vanClassSurcharge → customRates: [{ label: "Van Class Surcharge", min: 0, max: 0, value: X }]
  customRates.pickUp4DoorClassSurcharge → customRates: [{ label: "Pickup 4-Door Class Surcharge", min: 0, max: 0, value: X }]
  customRates.enclosedSurcharge → customRates: [{ label: "Enclosed Surcharge", min: 0, max: 0, value: X }]
  customRates.enclosedSurchargeOver1500 → customRates: [{ label: "Enclosed Surcharge Over 1500", min: 1500, max: 999999, value: X }]
  customRates.fuelSurcharge → customRates: [{ label: "Fuel Surcharge", min: 0, max: 0, value: X }]
}
```

---

## Quick Checklist for Database Updates

### ✅ Portal Options Checklist

- [ ] **JK Rate Calculation**: Check if any portals need `options.enableJKRateCalculation: true`
  - Typically: JK Moving portal
  - **Action**: Set flag for JK Moving portal(s)

- [ ] **Custom Rates**: Verify `options.enableCustomRates` matches old `hasCustomRates`
  - **Action**: Update portals that had custom rates enabled

- [ ] **Variable Company Tariff**: Verify `options.enableVariableCompanyTariff` matches old `hasVariableCompanyTariff`
  - **Action**: Update portals that had variable company tariff

- [ ] **White Glove Override**: Verify `options.enableWhiteGloveOverride` matches old `hasWhiteGloveOverride`
  - **Action**: Update portals that had white glove override

- [ ] **Display Options**: Verify all display flags are correctly migrated
  - **Action**: Check inverted logic for `overrideLogo` and `enablePriceBreakdown`

- [ ] **Quote Expiration**: Verify `options.quoteExpiryDays` matches old `portalQuoteExpirationDays`
  - **Action**: Update portals with custom expiration days

### ✅ Custom Rates Checklist

- [ ] **Mileage Rates**: Verify all mileage-based rates are converted to array format
  - **Action**: Run migration script or manually convert

- [ ] **Class Surcharges**: Verify class surcharges (SUV, Van, Pickup) are in array format
  - **Action**: Convert flat surcharges to array format

- [ ] **Enclosed Surcharges**: Verify enclosed surcharges are properly migrated
  - **Action**: Check both `enclosedSurcharge` and `enclosedSurchargeOver1500`

- [ ] **Fuel Surcharge**: Verify fuel surcharge is migrated
  - **Action**: Convert percentage to array format

### ✅ Modifier Sets Checklist

- [ ] **Global Modifier Set**: Verify global modifier set exists
  - **Action**: Create if missing, migrate from Settings

- [ ] **Portal Modifier Sets**: Verify portal-specific modifier sets exist where needed
  - **Action**: Create modifier sets for portals with custom company tariffs, discounts, or commissions

- [ ] **Company Tariff**: Verify company tariff values are in modifier sets
  - **Action**: Migrate `portal.companyTariff` to `ModifierSet.companyTariff`

- [ ] **Discounts**: Verify portal discounts are in modifier sets
  - **Action**: Migrate `portal.discount` and `portal.portalAdminDiscount` to modifier sets

### ✅ Settings Checklist

- [ ] **Transit Times**: Verify transit times are in Settings
  - **Action**: Ensure all transit time ranges are configured

- [ ] **Holidays**: Verify holidays are in Settings (as Date objects, not strings)
  - **Action**: Convert string dates to Date objects if needed

- [ ] **Service Levels**: Verify service levels are in Settings
  - **Action**: Ensure all service levels have correct markup values

- [ ] **Quote Expiration**: Verify global quote expiration days
  - **Action**: Set default if missing

---

## MongoDB Queries for Verification

### Check Portals Missing Options

```javascript
// Find portals without options object
db.portals.find({ options: { $exists: false } })

// Find portals with incomplete options
db.portals.find({
  $or: [
    { "options.enableCustomRates": { $exists: false } },
    { "options.enableJKRateCalculation": { $exists: false } },
    { "options.orderForm": { $exists: false } }
  ]
})
```

### Check Custom Rates Format

```javascript
// Find portals with old format custom rates (object)
db.portals.find({ "customRates.mileage": { $exists: true } })

// Find portals with new format custom rates (array)
db.portals.find({ "customRates.0": { $exists: true } })

// Find portals that should have custom rates but don't
db.portals.find({
  "options.enableCustomRates": true,
  $or: [
    { customRates: { $exists: false } },
    { customRates: { $size: 0 } }
  ]
})
```

### Check Modifier Sets

```javascript
// Check if global modifier set exists
db.modifiersets.findOne({ isGlobal: true })

// Find portals without modifier sets
db.portals.find({}, { _id: 1, companyName: 1 }).forEach(portal => {
  const modifierSet = db.modifiersets.findOne({ portalId: portal._id });
  if (!modifierSet) {
    print(`Portal ${portal.companyName} (${portal._id}) has no modifier set`);
  }
})

// Find modifier sets without portal reference
db.modifiersets.find({
  isGlobal: false,
  portalId: { $exists: false }
})
```

### Check Settings

```javascript
// Check if settings document exists
db.settings.findOne()

// Check transit times
db.settings.findOne({}, { transitTimes: 1 })

// Check holidays format (should be Date objects)
db.settings.findOne({}, { holidays: 1 })

// Check service levels
db.settings.findOne({}, { serviceLevels: 1 })
```

---

## Common Issues & Solutions

### Issue: Portal has `enableCustomRates: true` but no custom rates

**Solution:**
```javascript
// Either disable custom rates or add custom rates
db.portals.updateOne(
  { _id: ObjectId("portal_id") },
  { $set: { "options.enableCustomRates": false } }
)
// OR
// Add custom rates array (see Custom Rates section above)
```

### Issue: Portal needs JK rates but flag is not set

**Solution:**
```javascript
// Enable JK rate calculation
db.portals.updateOne(
  { _id: ObjectId("jk_portal_id") },
  { $set: { "options.enableJKRateCalculation": true } }
)
```

### Issue: Custom rates in old format (object instead of array)

**Solution:**
Run the portal migration script:
```bash
npm run migrate:portals
```

Or manually convert using the mapping in the Custom Rates section.

### Issue: Missing global modifier set

**Solution:**
Create a global modifier set with default values:
```javascript
db.modifiersets.insertOne({
  isGlobal: true,
  modifiers: {
    inoperable: { value: 0, valueType: "flat" },
    enclosedFlat: { value: 0, valueType: "flat" },
    enclosedPercent: { value: 0, valueType: "flat" },
    // ... other modifiers
  },
  whiteGlove: {
    multiplier: 2,
    minimum: 1500
  }
})
```

### Issue: Portal has company tariff but no modifier set

**Solution:**
Create a portal-specific modifier set:
```javascript
db.modifiersets.insertOne({
  isGlobal: false,
  portalId: ObjectId("portal_id"),
  companyTariff: {
    value: 30, // or whatever the portal.companyTariff was
    valueType: "percentage" // or "flat" based on portal.companyTariffIsPercent
  }
})
```

---

## Notes

1. **JK Rate Calculation**: This is a **NEW** feature in the new API. If a portal used JK Moving rates in the old API, you need to set `options.enableJKRateCalculation: true` in the new API.

2. **Inverted Logic**: Some display options have inverted logic:
   - `displayMCLogo: false` → `options.overrideLogo: true` (show portal logo, not MC logo)
   - `displayPDFTotalPriceOnly: true` → `options.orderPDF.enablePriceBreakdown: false` (show total only, not breakdown)

3. **Custom Rates Format**: The old API stored custom rates as an object with nested properties. The new API stores them as an array of rate objects. The migration script handles this conversion.

4. **Modifier Sets**: This is a **NEW** concept that consolidates pricing modifiers. Portals that had custom company tariffs, discounts, or commissions need modifier sets created.

5. **Settings**: The Settings model structure is similar, but holidays are now Date objects instead of strings.

---

## Need Help?

If you're unsure about a specific portal's configuration:
1. Check the old database for the portal's original values
2. Use the migration mapping reference above
3. Verify the new database has the correct values
4. Test the portal functionality to ensure it works correctly

For questions, refer to:
- Migration scripts: `migrations/scripts/migrate-portals.ts`
- Portal schema: `src/portal/schema.ts`
- Modifier set schema: `src/modifierSet/schema.ts`
- Settings schema: `src/settings/schema.ts`

