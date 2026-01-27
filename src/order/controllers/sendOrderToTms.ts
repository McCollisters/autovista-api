import express from "express";
import { Order, Portal } from "@/_global/models";
import { logger } from "@/core/logger";
import { sendPartialOrderToSuper } from "../integrations/sendPartialOrderToSuper";
import { sendOrderToSuper } from "../integrations/sendOrderToSuper";
import { updateSuperWithCompleteOrder } from "../integrations/updateSuperWithCompleteOrder";
import { updateSuperWithPartialOrder } from "../integrations/updateSuperWithPartialOrder";

const formatAddress = (address?: {
  address?: string;
  addressLine2?: string;
}) => {
  if (!address) {
    return "";
  }
  const base = address.address || "";
  const line2 = address.addressLine2 || "";
  return line2 ? `${base} ${line2}`.trim() : base;
};

const buildDateRanges = (order: any) => {
  const pickupStart =
    order.schedule?.pickupEstimated?.[0] || order.schedule?.pickupSelected;
  const pickupEnd =
    order.schedule?.pickupEstimated?.[1] || order.schedule?.pickupSelected;
  const deliveryStart = order.schedule?.deliveryEstimated?.[0];
  const deliveryEnd = order.schedule?.deliveryEstimated?.[1];

  return [
    pickupStart,
    pickupEnd,
    deliveryStart || pickupEnd,
    deliveryEnd || deliveryStart || pickupEnd,
  ].filter(Boolean) as Date[];
};

export const sendOrderToTms = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return next({ statusCode: 404, message: "Order not found." });
    }

    const isPartialOrder = order.tmsPartialOrder === true;
    let result: any = null;

    if (isPartialOrder) {
      if (order.tms?.guid) {
        result = await updateSuperWithCompleteOrder(order);

        if (result && order.tms) {
          order.tms.status = result.status || order.tms.status || null;
          order.tms.createdAt = result.created_at
            ? new Date(result.created_at)
            : order.tms.createdAt ?? undefined;
          order.tms.updatedAt = result.changed_at
            ? new Date(result.changed_at)
            : order.tms.updatedAt ?? undefined;
        }
      } else {
        const portal = await Portal.findById(order.portalId);
        const dateRanges = buildDateRanges(order);
        if (!portal || dateRanges.length < 4) {
          return next({
            statusCode: 400,
            message: "Missing portal or schedule dates for full TMS send.",
          });
        }

        result = await sendOrderToSuper({
          quotes: (order as any).vehicles || [],
          orderNumber: String(order.refId),
          reg: order.reg ? Number(order.reg) : undefined,
          portal,
          dateRanges,
          pickupCoords: {
            latitude: String(order.origin?.latitude || ""),
            longitude: String(order.origin?.longitude || ""),
          },
          deliveryCoords: {
            latitude: String(order.destination?.latitude || ""),
            longitude: String(order.destination?.longitude || ""),
          },
          pickupNotes: order.origin?.notes || null,
          deliveryNotes: order.destination?.notes || null,
          transportType: order.transportType,
          pickupAddress: formatAddress(order.origin?.address),
          pickupCity: order.origin?.address?.city || "",
          pickupState: order.origin?.address?.state || "",
          pickupZip: order.origin?.address?.zip || "",
          pickupBusinessName: order.origin?.contact?.companyName || "",
          pickupContactName: order.origin?.contact?.name || "",
          pickupEmail: order.origin?.contact?.email || "",
          pickupPhone: order.origin?.contact?.phone || "",
          pickupMobile: order.origin?.contact?.phoneMobile || "",
          deliveryAddress: formatAddress(order.destination?.address),
          deliveryCity: order.destination?.address?.city || "",
          deliveryState: order.destination?.address?.state || "",
          deliveryZip: order.destination?.address?.zip || "",
          deliveryBusinessName: order.destination?.contact?.companyName || "",
          deliveryContactName: order.destination?.contact?.name || "",
          deliveryEmail: order.destination?.contact?.email || "",
          deliveryPhone: order.destination?.contact?.phone || "",
          deliveryMobile: order.destination?.contact?.phoneMobile || "",
          serviceLevel: Number(
            order.schedule?.serviceLevel || (order as any).serviceLevel || 0,
          ),
        });

        if (result) {
          order.tms = {
            guid: result.guid || null,
            status: result.status || null,
            createdAt: result.created_at
              ? new Date(result.created_at)
              : undefined,
            updatedAt: result.changed_at
              ? new Date(result.changed_at)
              : undefined,
          };
        }
      }

      order.tmsPartialOrder = false;
    } else {
      if (order.tms?.guid) {
        result = await updateSuperWithPartialOrder(order);

        if (result && order.tms) {
          order.tms.status = result.status || order.tms.status || null;
          order.tms.createdAt = result.created_at
            ? new Date(result.created_at)
            : order.tms.createdAt ?? undefined;
          order.tms.updatedAt = result.changed_at
            ? new Date(result.changed_at)
            : order.tms.updatedAt ?? undefined;
        }
      } else {
        const portal = await Portal.findById(order.portalId);
        const dateRanges = buildDateRanges(order);
        if (!portal || dateRanges.length < 4) {
          return next({
            statusCode: 400,
            message: "Missing portal or schedule dates for partial TMS send.",
          });
        }

        const serviceLevel =
          order.schedule?.serviceLevel || (order as any).serviceLevel;

        result = await sendPartialOrderToSuper({
          quotes: (order as any).vehicles || [],
          orderNumber: String(order.refId),
          reg: order.reg ? Number(order.reg) : undefined,
          portal,
          dateRanges,
          transportType: order.transportType,
          pickupCity: order.origin?.address?.city || "",
          pickupState: order.origin?.address?.state || "",
          pickupZip: order.origin?.address?.zip || "",
          deliveryCity: order.destination?.address?.city || "",
          deliveryState: order.destination?.address?.state || "",
          deliveryZip: order.destination?.address?.zip || "",
          serviceLevel: Number(serviceLevel),
        });

        if (result) {
          order.tms = {
            guid: result.guid || null,
            status: result.status || null,
            createdAt: result.created_at
              ? new Date(result.created_at)
              : undefined,
            updatedAt: result.changed_at
              ? new Date(result.changed_at)
              : undefined,
          };
        }
      }

      order.tmsPartialOrder = true;
    }

    const savedOrder = await Order.findByIdAndUpdate(
      order._id,
      {
        $set: {
          tms: order.tms,
          tmsPartialOrder: order.tmsPartialOrder,
        },
      },
      { new: true },
    );

    res.status(200).json({
      success: true,
      tmsPartialOrder: savedOrder?.tmsPartialOrder ?? order.tmsPartialOrder,
      tms: savedOrder?.tms ?? order.tms,
      result,
    });
  } catch (error) {
    logger.error("Error sending order to TMS:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orderId: req.params.orderId,
    });
    next(error);
  }
};
