import {
  MigrationBase,
  MigrationResult,
  MigrationUtils,
} from "../utils/migration-base";

// Configuration constants
const MAX_ORDERS_TO_PROCESS: number | null = null; // Set to null or undefined to process all orders

/**
 * Order Migration Script
 *
 * This migration transforms orders from the old format to the new schema structure.
 * Key transformations:
 * - Restructures pricing modifiers from nested objects to flat structure
 * - Transforms vehicle pricing from old format to new format
 * - Updates totalPricing structure to match new schema
 * - Ensures all required fields are present with proper defaults
 *
 * IMPORTANT: This migration processes orders from the source database and
 * overwrites any existing orders in the destination database with the same _id.
 *
 * Testing vs Production:
 * - Set MAX_ORDERS_TO_PROCESS = 15 (or any number) for testing with limited orders
 * - Set MAX_ORDERS_TO_PROCESS = null to process ALL orders in production
 *
 * To run this migration:
 * 1. Set your MongoDB connection strings:
 *    export MIGRATION_SOURCE_URI="mongodb://localhost:27017/source-database"
 *    export MIGRATION_DEST_URI="mongodb://localhost:27017/destination-database"
 * 2. Run: npx tsx -r dotenv/config migrations/scripts/migrate-orders.ts
 */

interface OldOrder {
  _id: any;
  uniqueId?: string;
  uniqueIdNum?: number;
  reg?: string;
  status: string;
  archived?: boolean;
  sdStatus?: string;
  sdCreated?: Date;
  sdUpdated?: Date;
  sdGuid?: string;
  miles: number;
  transportType: string;
  transitTime?: number[];
  serviceLevel?: string;
  captivatedId?: string;
  driverPhone?: string;
  driverPhoneType?: string;
  driverLong?: string;
  driverLat?: string;
  driverUpdated?: string;

  // Order table fields for antd
  orderTableCustomer?: string;
  orderTablePickupEst?: Date;
  orderTablePickupEnd?: Date;
  orderTablePickupActual?: Date;
  orderTableDeliveryEst?: Date;
  orderTableDeliveryEnd?: Date;
  orderTableDeliveryActual?: Date;
  orderTableStatus?: string;
  moveType?: string;
  temp?: boolean;
  isCustomerPortal?: boolean;

  // User and portal references
  userId: string;
  userName?: string;
  agentId?: string;
  agentName?: string;
  portalId: string;
  portal?: any;
  origPortal?: any;
  quote?: any;

  // Notification flags
  portalNotificationEmail?: string;
  portalPickupAutoNotificationSent?: boolean;
  agentPickupAutoNotificationSent?: boolean;
  portalDeliveryAutoNotificationSent?: boolean;
  agentDeliveryAutoNotificationSent?: boolean;
  awaitingPickupConfirmation?: boolean;
  awaitingDeliveryConfirmation?: boolean;

  // Company info
  companyName?: string;
  companyLogo?: string;

  // Customer information
  customer: {
    customerFullName?: string;
    customerPhone?: string;
    customerMobilePhone?: string;
    customerAltPhone?: string;
    customerAddress?: string;
    customerCity?: string;
    customerState?: string;
    customerZip?: number;
    customerEmail?: string;
    customerNotes?: string;
    surveySent?: boolean;
    surveyCompleted?: boolean;
  };

  // Agents
  agents?: Array<{
    name?: string;
    email?: string;
    pickup?: boolean;
    delivery?: boolean;
  }>;
  agent?: {
    agentFullName?: string;
    agentEmail?: string;
  };

  // Pickup information
  pickup: {
    pickupBusinessName?: string;
    pickupContactName?: string;
    pickupPhone?: string;
    pickupMobilePhone?: string;
    pickupAltPhone?: string;
    pickupAddress?: string;
    pickupCity?: string;
    pickupState?: string;
    pickupZip?: string;
    pickupNotes?: string;
    pickupLongitude?: number;
    pickupLatitude?: number;
    pickupScheduledAt?: Date;
    pickupScheduledAtString?: string;
    pickupScheduledEndsAt?: Date;
    pickupScheduledEndsAtString?: string;
    pickupDateType?: string;
    pickupAdjustedDate?: Date;
    pickupAdjustedDateString?: string;
  };

  // Delivery information
  delivery: {
    deliveryBusinessName?: string;
    deliveryContactName?: string;
    deliveryPhone?: string;
    deliveryMobilePhone?: string;
    deliveryAddress?: string;
    deliveryCity?: string;
    deliveryState?: string;
    deliveryZip?: string;
    deliveryNotes?: string;
    deliveryLongitude?: number;
    deliveryLatitude?: number;
    deliveryScheduledAt?: Date;
    deliveryScheduledAtString?: string;
    deliveryScheduledEndsAt?: Date;
    deliveryScheduledEndsAtString?: string;
    deliveryDateType?: string;
    deliveryAdjustedDate?: Date;
    deliveryAdjustedDateString?: string;
  };

  deliveryLocationType?: string;
  pickupLocationType?: string;

  // On-time tracking
  ontime?: {
    pickup?: boolean;
    delivery?: boolean;
  };

  // Vehicle counts
  vehicleCount?: number;
  classCountSedan?: number;
  classCountSuv?: number;
  classCountVan?: number;
  classCountPickup?: number;
  classCountOther?: number;

  // Vehicles array
  vehicles: Array<{
    tariff?: number;
    vin?: string;
    year?: string;
    make: string;
    model: string;
    operable?: string;
    operableBool?: boolean;
    pricingClass?: string;
    pricing: {
      basePriceOverride?: number;
      totalPriceOverride?: number;
      baseQuote?: number;
      discount?: number;
      commission?: number;
      enclosedMarkup?: number;
      serviceLevelMarkup?: number;
      inoperableMarkup?: number;
      companyTariff?: number;
      companyTariffOpen?: number;
      companyTariffEnclosed?: number;
      enclosedModifier?: number;
      vanMarkup?: number;
      pickupMarkup?: number;
      suvMarkup?: number;
      irrMarkup?: number;
      fuelMarkup?: number;
      totalSD?: number;
      totalPortal?: number;
    };
    sdVehicleGuid?: string;
  }>;

  // Billing
  billRate?: number;
  paymentType?: string;
  termsAccepted?: boolean;
  paid?: boolean;

  // Total pricing
  totalPricing: {
    totalPriceOverride?: number;
    totalSD?: number;
    totalPortal?: number;
    totalDiscount?: number;
    totalVanMarkup?: number;
    totalPickupMarkup?: number;
    totalSuvMarkup?: number;
    totalEnclosedMarkup?: number;
    totalInoperableMarkup?: number;
    totalIrrMarkup?: number;
    totalFuelMarkup?: number;
    totalCompanyTariff?: number;
    totalCommission?: number;
  };

  // Additional fields
  revisions?: Array<{ revisionDate?: Date }>;
  files?: Array<{
    url?: string;
    name?: string;
    key?: string;
  }>;
  sirvaNonDomestic?: boolean;
  signatureRequestSent?: boolean;
  signatureReceived?: boolean;
  signatureRequestId?: string;
  reminderSent?: boolean;
  hasClaim?: boolean;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}

export class OrderMigration extends MigrationBase {
  async up(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running order migration UP...");

      // Get source connection (prod database) for reading
      const sourceConnection = this.getSourceConnection();
      const sourceDb = sourceConnection.db;

      // Get destination connection (dev database) for writing
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!sourceDb || !destinationDb) {
        throw new Error("Database connections not available");
      }

      const sourceOrdersCollection = sourceDb.collection("orders");
      const destinationOrdersCollection = destinationDb.collection("orders");

      // Count existing documents in source
      const totalOrders = await sourceOrdersCollection.countDocuments();
      console.log(`📊 Found ${totalOrders} orders to migrate from source`);

      if (totalOrders === 0) {
        return this.createSuccessResult("No orders found to migrate");
      }

      // Get orders from source (sorted by createdAt descending - most recent first)
      let cursor = sourceOrdersCollection.find({}).sort({ createdAt: -1 });

      // Apply limit if specified for testing
      if (MAX_ORDERS_TO_PROCESS) {
        cursor = cursor.limit(MAX_ORDERS_TO_PROCESS);
        console.log(
          `🔬 Testing mode: Processing only ${MAX_ORDERS_TO_PROCESS} orders (most recent first)`,
        );
      } else {
        console.log(
          `🚀 Production mode: Processing ALL orders (most recent first)`,
        );
      }

      const orders = await cursor.toArray();

      let migratedCount = 0;
      let errorCount = 0;

      await MigrationUtils.batchProcess(
        orders as OldOrder[],
        async (order: OldOrder, index) => {
          try {
            const transformedOrder = this.transformOrder(order);

            // Replace or insert the transformed order into destination database
            // This will overwrite existing orders with the same _id
            const replaceResult = await destinationOrdersCollection.replaceOne(
              { _id: order._id },
              transformedOrder,
              { upsert: true },
            );

            if (
              replaceResult.modifiedCount > 0 ||
              replaceResult.upsertedCount > 0
            ) {
              migratedCount++;
              if (index % 10 === 0) {
                console.log(`✅ Migrated ${index + 1}/${orders.length} orders`);
              }
            }
          } catch (error) {
            errorCount++;
            console.error(`❌ Error migrating order ${order._id}:`, error);
          }
        },
        50, // Process 50 orders at a time
      );

      const message = `Migration completed. Processed: ${migratedCount} orders (overwritten existing), Errors: ${errorCount}`;
      return this.createSuccessResult(message, migratedCount);
    } catch (error) {
      return this.createErrorResult(
        "Failed to run order migration",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async down(): Promise<MigrationResult> {
    try {
      console.log("🔄 Running order migration DOWN (rollback)...");

      // Get destination connection (dev database) for rollback
      const destinationConnection = this.getDestinationConnection();
      const destinationDb = destinationConnection.db;

      if (!destinationDb) {
        throw new Error("Destination database connection not available");
      }

      const destinationOrdersCollection = destinationDb.collection("orders");

      // Remove ALL orders from destination (since we're doing a full migration)
      const result = await destinationOrdersCollection.deleteMany({});

      return this.createSuccessResult(
        `Rolled back ${result.deletedCount} orders (cleared destination database)`,
        result.deletedCount,
      );
    } catch (error) {
      return this.createErrorResult(
        "Failed to run migration down",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private transformOrder(oldOrder: OldOrder): any {
    const transformedOrder: any = {
      // Preserve existing fields
      _id: oldOrder._id,
      refId:
        (oldOrder.uniqueId ? parseInt(oldOrder.uniqueId) : 0) ||
        oldOrder.uniqueIdNum ||
        (oldOrder._id ? parseInt(oldOrder._id.toString()) : 0) ||
        0,
      status: this.determineOrderStatus(oldOrder),
      portalId: oldOrder.portalId,
      userId: oldOrder.userId,
      quoteId: oldOrder.quote,
      miles: oldOrder.miles,
      transitTime: oldOrder.transitTime || [],
      paymentType: oldOrder.paymentType?.toLowerCase() || "cod",
      transportType: oldOrder.transportType.toLowerCase(),

      // Transform origin from pickup information
      origin: {
        notes: oldOrder.pickup.pickupNotes || "",
        locationType:
          oldOrder.pickupLocationType?.toLowerCase() || "residential",
        contact: {
          companyName: oldOrder.pickup.pickupBusinessName,
          name: oldOrder.pickup.pickupContactName || "",
          email: "", // Not available in old structure
          phone: oldOrder.pickup.pickupPhone || "",
          phoneMobile: oldOrder.pickup.pickupMobilePhone,
          notes: oldOrder.pickup.pickupNotes,
        },
        address: {
          address: oldOrder.pickup.pickupAddress || "",
          city: oldOrder.pickup.pickupCity || "",
          state: oldOrder.pickup.pickupState || "",
          zip: oldOrder.pickup.pickupZip || "",
        },
        longitude: oldOrder.pickup.pickupLongitude?.toString() || "",
        latitude: oldOrder.pickup.pickupLatitude?.toString() || "",
      },

      // Transform destination from delivery information
      destination: {
        notes: oldOrder.delivery.deliveryNotes || "",
        locationType: oldOrder.deliveryLocationType || "residential",
        contact: {
          companyName: oldOrder.delivery.deliveryBusinessName,
          name: oldOrder.delivery.deliveryContactName || "",
          email: "", // Not available in old structure
          phone: oldOrder.delivery.deliveryPhone || "",
          phoneMobile: oldOrder.delivery.deliveryMobilePhone,
          notes: oldOrder.delivery.deliveryNotes,
        },
        address: {
          address: oldOrder.delivery.deliveryAddress || "",
          city: oldOrder.delivery.deliveryCity || "",
          state: oldOrder.delivery.deliveryState || "",
          zip: oldOrder.delivery.deliveryZip || "",
        },
        longitude: oldOrder.delivery.deliveryLongitude?.toString() || "",
        latitude: oldOrder.delivery.deliveryLatitude?.toString() || "",
      },

      // Transform customer information
      customer: {
        companyName: oldOrder.customer.customerFullName,
        name: oldOrder.customer.customerFullName || "",
        email: oldOrder.customer.customerEmail || "",
        phone: oldOrder.customer.customerPhone || "",
        phoneMobile: oldOrder.customer.customerMobilePhone,
        notes: oldOrder.customer.customerNotes,
      },

      // Transform vehicles
      vehicles: oldOrder.vehicles.map((vehicle) =>
        this.transformVehicle(vehicle, oldOrder.transportType),
      ),

      // Transform totalPricing
      totalPricing: this.transformTotalPricing(oldOrder),

      // Transform schedule
      schedule: {
        serviceLevel: oldOrder.serviceLevel || "3",
        ontimePickup: this.calculateOntimePickup(oldOrder),
        ontimeDelivery: this.calculateOntimeDelivery(oldOrder),
        pickupSelected: oldOrder.pickup.pickupScheduledAt || new Date(),
        pickupEstimated: this.getPickupEstimated(oldOrder.pickup),
        deliveryEstimated: this.getDeliveryEstimated(oldOrder.delivery),
        pickupCompleted:
          oldOrder.orderTablePickupActual ||
          oldOrder.pickup.pickupAdjustedDate ||
          null,
        deliveryCompleted:
          oldOrder.orderTableDeliveryActual ||
          oldOrder.delivery.deliveryAdjustedDate ||
          null,
        notes: "",
      },

      // Add new required fields with defaults
      bookedAt: oldOrder.createdAt ? new Date(oldOrder.createdAt) : new Date(),
      isDirect: oldOrder.isCustomerPortal || false,
      reg: oldOrder.reg || null, // reg should never be 0, use null if not present
      hasAcceptedTerms: oldOrder.termsAccepted || false,
      hasPaid: oldOrder.paid || false,
      tms: {
        guid: oldOrder.sdGuid || "",
        status: oldOrder.sdStatus || "",
        updatedAt: oldOrder.sdUpdated || null,
        createdAt: oldOrder.sdCreated || null,
      },
      hasClaim: oldOrder.hasClaim || false,
      driver: {
        captivatedId: oldOrder.captivatedId || "",
        latitude: oldOrder.driverLat || "",
        longitude: oldOrder.driverLong || "",
        phone: oldOrder.driverPhone || "",
        updatedAt: oldOrder.driverUpdated
          ? new Date(oldOrder.driverUpdated)
          : null,
      },
      agents: this.transformAgents(oldOrder),
      notifications: this.transformNotifications(oldOrder),
      createdAt: oldOrder.createdAt ? new Date(oldOrder.createdAt) : new Date(),
      updatedAt: oldOrder.updatedAt ? new Date(oldOrder.updatedAt) : new Date(),
      __v: oldOrder.__v || 0,
    };

    return transformedOrder;
  }

  private transformVehicle(oldVehicle: any, transportType?: string): any {
    return {
      make: oldVehicle.make,
      model: oldVehicle.model,
      year: oldVehicle.year || null,
      vin: oldVehicle.vin || null,
      class: oldVehicle.pricingClass || "sedan",
      isInoperable:
        oldVehicle.operable === "false" || oldVehicle.operableBool === false,
      pricingClass: this.normalizePricingClass(oldVehicle.pricingClass),
      pricing: this.transformVehiclePricing(oldVehicle, transportType),
    };
  }

  private transformVehiclePricing(
    oldVehicle: any,
    transportType?: string,
  ): any {
    const oldPricing = oldVehicle.pricing;
    const isOpenTransport = transportType?.toLowerCase() === "open";

    // Calculate oversize modifier
    const oversizeModifier =
      (oldPricing.vanMarkup || 0) +
      (oldPricing.pickupMarkup || 0) +
      (oldPricing.suvMarkup || 0);

    // Base price should exclude all modifiers (including oversize)
    // If oversize exists, subtract it from baseQuote to ensure base excludes all modifiers
    const base = Math.max(0, (oldPricing.baseQuote || 0) - oversizeModifier);

    return {
      base,
      modifiers: {
        inoperable: oldPricing.inoperableMarkup || 0,
        routes: 0, // Not available in old structure
        states: 0, // Not available in old structure
        oversize: oversizeModifier,
        vehicles: 0, // Not available in old structure
        globalDiscount: oldPricing.discount || 0,
        portalDiscount: 0, // Not available in old structure
        irr: oldPricing.irrMarkup || 0,
        fuel: oldPricing.fuelMarkup || 0,
        enclosedFlat: isOpenTransport ? 0 : oldPricing.enclosedMarkup || 0,
        enclosedPercent: isOpenTransport ? 0 : oldPricing.enclosedModifier || 0,
        commission: oldPricing.commission || 0,
        serviceLevel: oldPricing.serviceLevelMarkup || 0,
        companyTariff: this.getCompanyTariff(oldPricing),
      },
      total: oldPricing.totalSD || 0,
      totalWithCompanyTariffAndCommission: oldPricing.totalPortal || 0,
    };
  }

  private transformTotalPricing(oldOrder: any): any {
    const oldPricing = oldOrder.totalPricing;
    const isOpenTransport = oldOrder.transportType?.toLowerCase() === "open";

    // Calculate oversize modifier
    const totalOversizeModifier =
      (oldPricing.totalVanMarkup || 0) +
      (oldPricing.totalPickupMarkup || 0) +
      (oldPricing.totalSuvMarkup || 0);

    // Calculate base from vehicles (after subtracting oversize from each vehicle's baseQuote)
    // Base price should exclude all modifiers (including oversize)
    const base = oldOrder.vehicles.reduce((sum: number, vehicle: any) => {
      const vehicleOversize =
        (vehicle.pricing.vanMarkup || 0) +
        (vehicle.pricing.pickupMarkup || 0) +
        (vehicle.pricing.suvMarkup || 0);
      const vehicleBase = Math.max(
        0,
        (vehicle.pricing.baseQuote || 0) - vehicleOversize,
      );
      return sum + vehicleBase;
    }, 0);

    return {
      base,
      modifiers: {
        inoperable: oldPricing.totalInoperableMarkup || 0,
        routes: 0, // Not available in old structure
        states: 0, // Not available in old structure
        oversize: totalOversizeModifier,
        vehicles: 0, // Not available in old structure
        globalDiscount: oldPricing.totalDiscount || 0,
        portalDiscount: 0, // Not available in old structure
        irr: oldPricing.totalIrrMarkup || 0,
        fuel: oldPricing.totalFuelMarkup || 0,
        enclosedFlat: isOpenTransport ? 0 : oldPricing.totalEnclosedMarkup || 0,
        enclosedPercent: isOpenTransport ? 0 : 0, // Not available in old structure, but set to 0 for OPEN
        commission: oldPricing.totalCommission || 0,
        serviceLevel: this.getServiceLevel(oldOrder),
        companyTariff: this.getTotalCompanyTariff(oldPricing),
      },
      total: oldPricing.totalSD || 0,
      totalWithCompanyTariffAndCommission: oldPricing.totalPortal || 0,
    };
  }

  private transformAgents(oldOrder: OldOrder): any[] {
    const agents: any[] = [];

    // Add agents from the agents array
    if (oldOrder.agents && oldOrder.agents.length > 0) {
      oldOrder.agents.forEach((agent) => {
        if (agent.name && agent.email) {
          agents.push({
            name: agent.name,
            email: agent.email,
            enablePickupNotifications: agent.pickup !== false,
            enableDeliveryNotifications: agent.delivery !== false,
          });
        }
      });
    }

    // Add single agent if available
    if (
      oldOrder.agent &&
      oldOrder.agent.agentFullName &&
      oldOrder.agent.agentEmail
    ) {
      agents.push({
        name: oldOrder.agent.agentFullName,
        email: oldOrder.agent.agentEmail,
        enablePickupNotifications: true,
        enableDeliveryNotifications: true,
      });
    }

    return agents;
  }

  private transformNotifications(oldOrder: OldOrder): any {
    return {
      paymentRequest: {
        status: "pending",
        sentAt: null,
        failedAt: null,
        recipientEmail: null,
      },
      paymentReminder: {
        status: "pending",
        sentAt: null,
        failedAt: null,
        recipientEmail: null,
      },
      signatureRequest: {
        status: oldOrder.signatureRequestSent ? "sent" : "pending",
        sentAt: oldOrder.signatureRequestSent ? new Date() : null,
        failedAt: null,
        recipientEmail: null,
      },
      signatureRequestReminder: {
        status: "pending",
        sentAt: null,
        failedAt: null,
        recipientEmail: null,
      },
      survey: {
        status: oldOrder.customer.surveySent ? "sent" : "pending",
        sentAt: oldOrder.customer.surveySent ? new Date() : null,
        failedAt: null,
        recipientEmail: null,
      },
      surveyReminder: {
        status: "pending",
        sentAt: null,
        failedAt: null,
        recipientEmail: null,
      },
      pickupReminder: {
        status: "pending",
        sentAt: null,
        failedAt: null,
        recipientEmail: null,
      },
      agentsConfirmation: {
        status: "pending",
        sentAt: null,
        failedAt: null,
        recipientEmail: null,
      },
      agentsPickupConfirmation: {
        status: oldOrder.agentPickupAutoNotificationSent ? "sent" : "pending",
        sentAt: oldOrder.agentPickupAutoNotificationSent ? new Date() : null,
        failedAt: null,
        recipientEmail: null,
      },
      agentsDeliveryConfirmation: {
        status: oldOrder.agentDeliveryAutoNotificationSent ? "sent" : "pending",
        sentAt: oldOrder.agentDeliveryAutoNotificationSent ? new Date() : null,
        failedAt: null,
        recipientEmail: null,
      },
      customerConfirmation: {
        status: "pending",
        sentAt: null,
        failedAt: null,
        recipientEmail: null,
      },
      customerPickupConfirmation: {
        status: "pending",
        sentAt: null,
        failedAt: null,
        recipientEmail: null,
      },
      customerDeliveryConfirmation: {
        status: "pending",
        sentAt: null,
        failedAt: null,
        recipientEmail: null,
      },
      portalAdminPickupConfirmation: {
        status: oldOrder.portalPickupAutoNotificationSent ? "sent" : "pending",
        sentAt: oldOrder.portalPickupAutoNotificationSent ? new Date() : null,
        failedAt: null,
        recipientEmail: null,
      },
      portalAdminDeliveryConfirmation: {
        status: oldOrder.portalDeliveryAutoNotificationSent
          ? "sent"
          : "pending",
        sentAt: oldOrder.portalDeliveryAutoNotificationSent ? new Date() : null,
        failedAt: null,
        recipientEmail: null,
      },
    };
  }

  private getCompanyTariff(pricing: any): number {
    // Use whichever is > 0, prioritizing companyTariffOpen, then companyTariffEnclosed, then companyTariff
    if (pricing.companyTariffOpen && pricing.companyTariffOpen > 0) {
      return pricing.companyTariffOpen;
    }
    if (pricing.companyTariffEnclosed && pricing.companyTariffEnclosed > 0) {
      return pricing.companyTariffEnclosed;
    }
    if (pricing.companyTariff && pricing.companyTariff > 0) {
      return pricing.companyTariff;
    }
    return 0;
  }

  private getServiceLevel(oldOrder: any): number {
    // Sum up service level markups from all vehicles
    return oldOrder.vehicles.reduce((sum: number, vehicle: any) => {
      return sum + (vehicle.pricing.serviceLevelMarkup || 0);
    }, 0);
  }

  private getTotalCompanyTariff(pricing: any): number {
    // Use totalCompanyTariff if available and > 0, otherwise return 0
    if (pricing.totalCompanyTariff && pricing.totalCompanyTariff > 0) {
      return pricing.totalCompanyTariff;
    }
    return 0;
  }

  private determineOrderStatus(oldOrder: any): string {
    // If deliveryCompleted has a value, status should be "complete"
    if (oldOrder.delivery.deliveryAdjustedDate) {
      return "complete";
    }

    // Otherwise, use the original status (converted to lowercase)
    return oldOrder.status.toLowerCase();
  }

  private calculateOntimePickup(oldOrder: any): boolean | null {
    const pickupEndsAt = oldOrder.pickup.pickupScheduledEndsAt;
    const pickupCompleted =
      oldOrder.orderTablePickupActual || oldOrder.pickup.pickupAdjustedDate;

    // If no pickup completed date, return null
    if (!pickupCompleted) {
      return null;
    }

    // If no pickup ends date, return null
    if (!pickupEndsAt) {
      return null;
    }

    // Add 8-hour grace period to the scheduled end time
    const gracePeriodEnd = new Date(pickupEndsAt);
    gracePeriodEnd.setHours(gracePeriodEnd.getHours() + 8);

    // Compare dates: ontime if pickupCompleted <= (pickupScheduledEndsAt + 8 hours)
    return new Date(pickupCompleted) <= gracePeriodEnd;
  }

  private calculateOntimeDelivery(oldOrder: any): boolean | null {
    const deliveryEndsAt = oldOrder.delivery.deliveryScheduledEndsAt;
    const deliveryCompleted =
      oldOrder.orderTableDeliveryActual ||
      oldOrder.delivery.deliveryAdjustedDate;

    // If no delivery completed date, return null
    if (!deliveryCompleted) {
      return null;
    }

    // If no delivery ends date, return null
    if (!deliveryEndsAt) {
      return null;
    }

    // Add 8-hour grace period to the scheduled end time
    const gracePeriodEnd = new Date(deliveryEndsAt);
    gracePeriodEnd.setHours(gracePeriodEnd.getHours() + 8);

    // Compare dates: ontime if deliveryCompleted <= (deliveryScheduledEndsAt + 8 hours)
    return new Date(deliveryCompleted) <= gracePeriodEnd;
  }

  private getPickupEstimated(pickup: any): Date[] {
    const pickupEstimated: Date[] = [];

    // Add pickupScheduledAt as the first element if available
    if (pickup.pickupScheduledAt) {
      pickupEstimated.push(new Date(pickup.pickupScheduledAt));
    }

    // Add pickupScheduledEndsAt as the second element if available
    if (pickup.pickupScheduledEndsAt) {
      pickupEstimated.push(new Date(pickup.pickupScheduledEndsAt));
    }

    return pickupEstimated;
  }

  private getDeliveryEstimated(delivery: any): Date[] {
    const deliveryEstimated: Date[] = [];

    // Add deliveryScheduledAt as the first element if available
    if (delivery.deliveryScheduledAt) {
      deliveryEstimated.push(new Date(delivery.deliveryScheduledAt));
    }

    // Add deliveryScheduledEndsAt as the second element if available
    if (delivery.deliveryScheduledEndsAt) {
      deliveryEstimated.push(new Date(delivery.deliveryScheduledEndsAt));
    }

    return deliveryEstimated;
  }

  private normalizePricingClass(vehicleClass: string): string {
    if (!vehicleClass) return "sedan";

    const lowerClass = vehicleClass.toLowerCase();

    // Map to the correct enum values
    switch (lowerClass) {
      case "sedan":
        return "sedan";
      case "suv":
        return "suv";
      case "van":
        return "van";
      case "pickup":
      case "pickup_2_doors":
        return "pickup_2_doors";
      case "pickup_4_doors":
        return "pickup_4_doors";
      default:
        // Default to sedan for unknown types
        return "sedan";
    }
  }
}

// Run the migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new OrderMigration();

  const direction = process.argv[2] === "down" ? "down" : "up";

  migration
    .run(direction)
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("💥 Migration execution failed:", error);
      process.exit(1);
    });
}

// need to write separate scripts to migrate logs for notifications, files, and quote modifier breakdown
