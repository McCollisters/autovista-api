import express from "express";
import { Order, Portal } from "@/_global/models";
import { logger } from "@/core/logger";
import { PaymentType, TransportType } from "@/_global/enums";
import { sendPartialOrderToSuper } from "../integrations/sendPartialOrderToSuper";
import { updateOrderTariffsInSuper } from "../integrations/updateOrderTariffsInSuper";

const mergeNotificationEmails = (existing: any[], agents: any[]) => {
  const byEmail = new Map<string, any>();

  existing.forEach((entry) => {
    const email = String(entry?.email || "")
      .trim()
      .toLowerCase();
    if (!email) return;
    byEmail.set(email, { ...entry });
  });

  agents.forEach((agent) => {
    const email = String(agent?.email || "")
      .trim()
      .toLowerCase();
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

const normalizeBoolean = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return undefined;
};

export const updateOrder = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    logger.info("updateOrder request body", {
      orderId: req.params.orderId,
      user: (req as any).user?.email,
      body: req.body,
    });

    const updateDoc: Record<string, any> = { $set: { ...req.body } };
    const priceOverrides = req.body?.priceOverrides;
    if (updateDoc.$set.priceOverrides) {
      delete updateDoc.$set.priceOverrides;
    }
    if (updateDoc.$set.hasPaid !== undefined) {
      const normalized = normalizeBoolean(updateDoc.$set.hasPaid);
      if (normalized !== undefined) {
        updateDoc.$set.hasPaid = normalized;
      }
    }
    if (updateDoc.$set.paymentType !== undefined) {
      updateDoc.$set.paymentType = String(updateDoc.$set.paymentType).toLowerCase();
    }
    if (req.body?.pickupLocationType) {
      updateDoc.$set["origin.locationType"] = req.body.pickupLocationType;
      delete updateDoc.$set.pickupLocationType;
    }
    if (req.body?.deliveryLocationType) {
      updateDoc.$set["destination.locationType"] =
        req.body.deliveryLocationType;
      delete updateDoc.$set.deliveryLocationType;
    }

    const existingOrder = await Order.findById(req.params.orderId);
    const previousHasPaid = existingOrder?.hasPaid === true;

    let updatedOrder = await Order.findByIdAndUpdate(
      req.params.orderId,
      updateDoc,
      { new: true },
    );

    if (updatedOrder && priceOverrides) {
      let totalBase = 0;
      let totalCommission = 0;
      let totalCompanyTariff = 0;
      let totalWithCompanyTariffAndCommission = 0;

      updatedOrder.vehicles.forEach((vehicle: any) => {
        const override = priceOverrides?.[vehicle.model];
        if (!override) {
          return;
        }

        const baseTotal = Number(
          override.basePriceOverride ??
            override.total ??
            override.pricing?.total ??
            override.pricingTotal,
        );
        const commissionValue = Number(
          override.commissionOverride ??
            override.commission ??
            override.modifiers?.commission,
        );
        const companyTariffValue = Number(
          override.companyTariffOverride ??
            override.companyTariff ??
            override.modifiers?.companyTariff,
        );

        const nextTotal = Number.isFinite(baseTotal) ? baseTotal : 0;
        const nextCommission = Number.isFinite(commissionValue)
          ? commissionValue
          : 0;
        const nextCompanyTariff = Number.isFinite(companyTariffValue)
          ? companyTariffValue
          : 0;
        const nextTotalWith = nextTotal + nextCommission + nextCompanyTariff;

        vehicle.pricing = vehicle.pricing || {};
        vehicle.pricing.base = nextTotal;
        vehicle.pricing.total = nextTotal;
        vehicle.pricing.modifiers = {
          ...(vehicle.pricing.modifiers || {}),
          commission: nextCommission,
          companyTariff: nextCompanyTariff,
        };
        vehicle.pricing.totalWithCompanyTariffAndCommission = nextTotalWith;

        totalBase += nextTotal;
        totalCommission += nextCommission;
        totalCompanyTariff += nextCompanyTariff;
        totalWithCompanyTariffAndCommission += nextTotalWith;
      });

      updatedOrder.totalPricing = {
        ...(updatedOrder.totalPricing || {}),
        base: totalBase,
        modifiers: {
          ...(updatedOrder.totalPricing?.modifiers || {}),
          commission: totalCommission,
          companyTariff: totalCompanyTariff,
        },
        total: totalBase,
        totalWithCompanyTariffAndCommission,
      } as any;

      updatedOrder = await updatedOrder.save();

      if (updatedOrder.tms?.guid) {
        try {
          await updateOrderTariffsInSuper(updatedOrder);
        } catch (error) {
          logger.error("Failed to update Super Dispatch tariffs", {
            orderId: updatedOrder._id,
            tmsGuid: updatedOrder.tms?.guid,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    if (
      updatedOrder &&
      Array.isArray(req.body?.agents) &&
      req.body.agents.length > 0
    ) {
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
      const isWhiteGlove =
        updatedOrder.transportType === TransportType.WhiteGlove;
      const hasTmsGuid = Boolean(updatedOrder.tms?.guid);
      let shouldSave = false;

      const hasPaidFlipped =
        updatedOrder.hasPaid === true && previousHasPaid !== true;

      if (hasPaidFlipped && isCod) {
        updatedOrder.orderTableStatus = "New";
        shouldSave = true;
      }

      if (
        hasPaidFlipped &&
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
              updatedOrder.schedule?.serviceLevel ||
              (updatedOrder as any).serviceLevel;

            const superResponse = await sendPartialOrderToSuper({
              quotes: (updatedOrder as any).vehicles || [],
              orderNumber: String(updatedOrder.refId),
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
            error:
              superError instanceof Error ? superError.message : superError,
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
