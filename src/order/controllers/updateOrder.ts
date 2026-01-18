import express from "express";
import { Order, Portal } from "@/_global/models";
import { logger } from "@/core/logger";
import { PaymentType, TransportType } from "@/_global/enums";
import { sendPartialOrderToSuper } from "../integrations/sendPartialOrderToSuper";

const mergeNotificationEmails = (existing: any[], agents: any[]) => {
  const byEmail = new Map<string, any>();

  existing.forEach((entry) => {
    const email = String(entry?.email || "").trim().toLowerCase();
    if (!email) return;
    byEmail.set(email, { ...entry });
  });

  agents.forEach((agent) => {
    const email = String(agent?.email || "").trim().toLowerCase();
    if (!email) return;
    const existingEntry = byEmail.get(email) || {};
    byEmail.set(email, {
      ...existingEntry,
      email: existingEntry.email || agent.email,
      name: agent.name || existingEntry.name,
      pickup: Boolean(existingEntry.pickup || agent.pickup),
      delivery: Boolean(existingEntry.delivery || agent.delivery),
    });
  });

  return Array.from(byEmail.values());
};

export const updateOrder = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.orderId,
      req.body,
      { new: true },
    );

    if (updatedOrder && Array.isArray(req.body?.agents) && req.body.agents.length > 0) {
      const portalId = (updatedOrder as any).portalId;
      const portal = portalId ? await Portal.findById(portalId) : null;
      if (portal) {
        const merged = mergeNotificationEmails(
          (portal as any).notificationEmails || [],
          req.body.agents,
        );
        await Portal.findByIdAndUpdate(portalId, {
          notificationEmails: merged,
        });
      }
    }

    if (updatedOrder) {
      const paymentType = String(updatedOrder.paymentType || "").toLowerCase();
      const isCod = paymentType === PaymentType.Cod;
      const isWhiteGlove = updatedOrder.transportType === TransportType.WhiteGlove;
      const hasTmsGuid = Boolean(updatedOrder.tms?.guid);
      let shouldSave = false;

      if (updatedOrder.hasPaid === true && isCod) {
        updatedOrder.orderTableStatus = "New";
        shouldSave = true;
      }

      if (
        updatedOrder.hasPaid === true &&
        isCod &&
        !isWhiteGlove &&
        !hasTmsGuid
      ) {
        try {
          const portal = await Portal.findById(updatedOrder.portalId);
          const pickupStart =
            updatedOrder.schedule?.pickupEstimated?.[0] ||
            updatedOrder.schedule?.pickupSelected;
          const pickupEnd =
            updatedOrder.schedule?.pickupEstimated?.[1] ||
            updatedOrder.schedule?.pickupSelected;
          const deliveryStart = updatedOrder.schedule?.deliveryEstimated?.[0];
          const deliveryEnd = updatedOrder.schedule?.deliveryEstimated?.[1];
          const dateRanges = [
            pickupStart,
            pickupEnd,
            deliveryStart || pickupEnd,
            deliveryEnd || deliveryStart || pickupEnd,
          ].filter(Boolean) as Date[];

          if (!portal || dateRanges.length < 4) {
            logger.warn("Skipping SuperDispatch partial order send", {
              orderId: updatedOrder._id,
              hasPortal: Boolean(portal),
              dateRangesLength: dateRanges.length,
            });
          } else {
            const serviceLevel =
              updatedOrder.schedule?.serviceLevel || (updatedOrder as any).serviceLevel;

            const superResponse = await sendPartialOrderToSuper({
              quotes: (updatedOrder as any).vehicles || [],
              uniqueId:
                String((updatedOrder as any).uniqueId || updatedOrder.refId),
              reg: updatedOrder.reg ? Number(updatedOrder.reg) : undefined,
              portal,
              dateRanges,
              transportType: updatedOrder.transportType,
              pickupCity: updatedOrder.origin?.address?.city || "",
              pickupState: updatedOrder.origin?.address?.state || "",
              pickupZip: updatedOrder.origin?.address?.zip || "",
              deliveryCity: updatedOrder.destination?.address?.city || "",
              deliveryState: updatedOrder.destination?.address?.state || "",
              deliveryZip: updatedOrder.destination?.address?.zip || "",
              serviceLevel: Number(serviceLevel),
            });

            if (superResponse) {
              updatedOrder.tms = {
                guid: superResponse?.guid || null,
                status: superResponse?.status || null,
                createdAt: superResponse?.created_at
                  ? new Date(superResponse.created_at)
                  : null,
                updatedAt: superResponse?.changed_at
                  ? new Date(superResponse.changed_at)
                  : null,
              };
              updatedOrder.tmsPartialOrder = true;
              shouldSave = true;
            }
          }
        } catch (superError) {
          logger.error("Failed to send COD partial order to SuperDispatch", {
            orderId: updatedOrder._id,
            error: superError instanceof Error ? superError.message : superError,
          });
        }
      }

      if (shouldSave) {
        await updatedOrder.save();
      }
    }

    res.status(200).json(updatedOrder);
  } catch (error) {
    next(error);
  }
};
