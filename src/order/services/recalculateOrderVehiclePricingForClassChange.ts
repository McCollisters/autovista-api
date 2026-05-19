import type { IOrder } from "@/order/schema";
import type { IPortal } from "@/_global/models";
import { logger } from "@/core/logger";
import { updateVehiclesWithPricing } from "@/quote/services/updateVehiclesWithPricing";
import { calculateTotalPricing } from "@/quote/services/calculateTotalPricing";

const normalizePricingClass = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .trim();

/**
 * True when any vehicle's pricingClass changed between the prior order snapshot
 * and the updated order (matched by array index).
 */
export function didOrderVehiclePricingClassChange(
  beforeVehicles: unknown[] | undefined | null,
  afterVehicles: unknown[] | undefined | null,
): boolean {
  if (!Array.isArray(beforeVehicles) || !Array.isArray(afterVehicles)) {
    return false;
  }
  if (beforeVehicles.length !== afterVehicles.length) {
    return true;
  }
  for (let i = 0; i < beforeVehicles.length; i += 1) {
    const a = normalizePricingClass((beforeVehicles[i] as any)?.pricingClass);
    const b = normalizePricingClass((afterVehicles[i] as any)?.pricingClass);
    if (a !== b) {
      return true;
    }
  }
  return false;
}

/** "City, ST" for quote pricing / TMS base rate (matches createQuote / recalculateExistingQuote). */
export function orderOriginDestinationForPricing(order: {
  origin?: { address?: { city?: string; state?: string | { value?: string } } };
  destination?: {
    address?: { city?: string; state?: string | { value?: string } };
  };
}): { origin: string; destination: string } {
  const rawState = (s: unknown) => {
    if (s && typeof s === "object" && "value" in (s as object)) {
      return String((s as { value?: string }).value ?? "").trim();
    }
    return String(s ?? "").trim();
  };
  const oc = order?.origin?.address?.city?.trim() || "";
  const os = rawState(order?.origin?.address?.state);
  const dc = order?.destination?.address?.city?.trim() || "";
  const ds = rawState(order?.destination?.address?.state);
  const origin =
    oc && os ? `${oc}, ${os.length === 2 ? os.toUpperCase() : os}` : "";
  const destination =
    dc && ds ? `${dc}, ${ds.length === 2 ? ds.toUpperCase() : ds}` : "";
  return { origin, destination };
}

/**
 * Re-runs vehicle line pricing after an explicit pricingClass change so oversize
 * modifiers and isOversize align with the new class (and totals refresh).
 */
export async function recalculateOrderVehiclesAfterPricingClassChange(
  order: IOrder,
  portal: IPortal,
): Promise<IOrder> {
  const { origin, destination } = orderOriginDestinationForPricing(order);
  if (!origin || !destination) {
    throw new Error(
      "Order is missing origin/destination city+state required for pricing",
    );
  }

  const miles = Number(order.miles) || 0;
  const commission = Number(order.totalPricing?.modifiers?.commission ?? 0);

  const vehiclesInput = (order.vehicles || []).map((v: any) => {
    const plain =
      typeof v?.toObject === "function" ? v.toObject() : { ...v };
    const { isOversize: _drop, ...rest } = plain;
    return {
      ...rest,
      transportType: order.transportType,
    };
  });

  const vehicles = await updateVehiclesWithPricing({
    portal,
    vehicles: vehiclesInput,
    miles,
    origin,
    destination,
    commission,
    options: { skipBrandModelPricingClassLookup: true },
  });

  const totalPricing = await calculateTotalPricing(vehicles, portal);

  order.set("vehicles", vehicles);
  order.set("totalPricing", totalPricing);

  logger.info("Recalculated order vehicle pricing after pricingClass change", {
    orderId: order._id,
    refId: order.refId,
  });

  return order.save();
}
