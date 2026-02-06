import ObjectsToCsv from "objects-to-csv";
import { DateTime } from "luxon";
import { Types } from "mongoose";
import { Order, Portal } from "@/_global/models";

export type PortalMonthlyReportDateField = "createdAt" | "schedule.pickupSelected";

export interface PortalMonthlyReportOptions {
  portalIdOrName: string;
  month: DateTime;
  dateField?: PortalMonthlyReportDateField;
}

export interface PortalMonthlyReportResult {
  portal: any;
  monthLabel: string;
  ordersCount: number;
  rows: Record<string, string | number | null>[];
  csvRows: Record<string, string | number | null>[];
  csvString: string;
}

const DEFAULT_DATE_FIELD: PortalMonthlyReportDateField = "createdAt";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatAddress(address: any): string {
  if (!address) {
    return "";
  }

  const line1 = address.address || "";
  const city = address.city || "";
  const state = address.state || "";
  const zip = address.zip || "";

  return [line1, city, state, zip].filter(Boolean).join(", ");
}

function formatVehicleInfo(vehicles: any[]): string {
  if (!vehicles || vehicles.length === 0) {
    return "";
  }

  return vehicles
    .map((vehicle) => {
      const parts = [
        vehicle.year || "",
        vehicle.make || "",
        vehicle.model || "",
      ].filter(Boolean);
      let text = parts.join(" ");
      if (vehicle.vin) {
        text += ` (VIN: ${vehicle.vin})`;
      }
      if (vehicle.isInoperable) {
        text += " - INOP";
      }
      return text.trim();
    })
    .join("\n")
    .replace(/,/g, " ");
}

function sumVehicleModifier(vehicles: any[], key: string): number {
  return (vehicles || []).reduce(
    (total, vehicle) => total + (vehicle?.pricing?.modifiers?.[key] || 0),
    0,
  );
}

function formatDate(value?: Date | null): string {
  if (!value) {
    return "";
  }
  return DateTime.fromJSDate(value).toFormat("MM/dd/yyyy");
}

async function resolvePortal(portalArg: string) {
  if (Types.ObjectId.isValid(portalArg)) {
    const portal = await Portal.findById(portalArg).lean();
    if (portal) {
      return portal;
    }
  }

  const escaped = escapeRegExp(portalArg.trim());
  return Portal.findOne({
    companyName: { $regex: new RegExp(`^${escaped}$`, "i") },
  }).lean();
}

export function getPortalMonthlyReportFilename(
  portalName: string,
  monthLabel: string,
): string {
  return `portal-report-${portalName}-${monthLabel}.csv`.replace(
    /[^a-z0-9-_\.]/gi,
    "_",
  );
}

export async function buildPortalMonthlyReport(
  options: PortalMonthlyReportOptions,
): Promise<PortalMonthlyReportResult> {
  const { portalIdOrName, month } = options;
  const dateField = options.dateField || DEFAULT_DATE_FIELD;

  const portal = await resolvePortal(portalIdOrName);
  if (!portal) {
    throw new Error(`Portal not found: ${portalIdOrName}`);
  }

  const monthStart = DateTime.fromObject(
    { year: month.year, month: month.month, day: 1 },
    { zone: "utc" },
  );
  const monthLabel = monthStart.toFormat("yyyy-MM");
  const startDate = monthStart.toJSDate();
  const endDate = monthStart.plus({ months: 1 }).toJSDate();

  const dateQuery =
    dateField === "createdAt"
      ? { createdAt: { $gte: startDate, $lt: endDate } }
      : {
          "schedule.pickupSelected": { $gte: startDate, $lt: endDate },
        };

  const orders = await Order.find({
    portalId: portal._id,
    ...dateQuery,
  })
    .sort({ refId: 1 })
    .lean();

  let totalVehiclesCount = 0;
  let totalPrice = 0;
  let totalCommission = 0;
  let totalCompanyTariff = 0;
  let totalGrandTotal = 0;

  const rows: Record<string, string | number | null>[] = orders.map(
    (order: any) => {
      const commission = sumVehicleModifier(order.vehicles, "commission");
      const companyTariff = sumVehicleModifier(order.vehicles, "companyTariff");
      const totalPricing = order.totalPricing?.total || 0;
      const grandTotal =
        order.totalPricing?.totalWithCompanyTariffAndCommission ??
        totalPricing + commission + companyTariff;
      const vehiclesCount = order.vehicles?.length || 0;

      totalVehiclesCount += vehiclesCount;
      totalPrice += totalPricing;
      totalCommission += commission;
      totalCompanyTariff += companyTariff;
      totalGrandTotal += grandTotal;

      const pickupDate = order.schedule?.pickupSelected || null;
      const deliveryDate =
        order.schedule?.deliveryCompleted ||
        order.schedule?.deliveryEstimated?.[0] ||
        null;

      return {
        "customer name": order.customer?.name || "",
        origin: formatAddress(order.origin?.address),
        destination: formatAddress(order.destination?.address),
        "pickup date": formatDate(pickupDate),
        "delivery date": formatDate(deliveryDate),
        "number of vehicles": vehiclesCount,
        "vehicle information": formatVehicleInfo(order.vehicles),
        price: totalPricing,
        commission,
        "company tariff": companyTariff,
        "grand total": grandTotal,
      };
    },
  );

  const totalRow: Record<string, string | number | null> = {
    "customer name": "",
    origin: "",
    destination: "",
    "pickup date": "",
    "delivery date": "",
    "number of vehicles": totalVehiclesCount,
    "vehicle information": "TOTAL",
    price: totalPrice,
    commission: totalCommission,
    "company tariff": totalCompanyTariff,
    "grand total": totalGrandTotal,
  };

  const csvRows = [totalRow, ...rows];
  const csv = new ObjectsToCsv(csvRows);
  const csvString = await csv.toString();

  return {
    portal,
    monthLabel,
    ordersCount: rows.length,
    rows,
    csvRows,
    csvString,
  };
}
