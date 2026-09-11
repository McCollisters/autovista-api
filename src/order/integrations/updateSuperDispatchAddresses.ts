/**
 * Push Autovista origin/destination city, state, zip (and street after
 * full release) to Super Dispatch without releasing withheld streets on
 * partial loads.
 */

import { logger } from "@/core/logger";
import { IOrder } from "@/_global/models";
import { authenticateSuperDispatch } from "@/_global/integrations/authenticateSuperDispatch";
import { normalizeUsZip } from "@/_global/utils/normalizeUsZip";
import { isWithheldAddress } from "@/order/utils/checkWithheldAddress";

const WITHHELD_STREET = "123 Example St. ADDRESS WITHHELD";

const formatAutovistaStreet = (avAddress?: {
  address?: string;
  addressLine2?: string;
}): string | null => {
  if (!avAddress) {
    return null;
  }
  const base = avAddress.address || "";
  const line2 = avAddress.addressLine2 || "";
  const combined = line2 ? `${base} ${line2}`.trim() : base;
  return combined || null;
};

const toFloatOrNull = (value?: string | number | null) => {
  if (value == null || value === "") {
    return null;
  }
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

export const resolveStreetForSuperDispatch = ({
  isPartial,
  avStreet,
  sdStreet,
}: {
  isPartial: boolean;
  avStreet?: string | null;
  sdStreet?: string | null;
}): string | null => {
  if (isPartial) {
    return sdStreet || WITHHELD_STREET;
  }
  if (avStreet && !isWithheldAddress(avStreet)) {
    return avStreet;
  }
  if (sdStreet && !isWithheldAddress(sdStreet)) {
    return sdStreet;
  }
  return null;
};

const buildVenuePatch = ({
  isPartial,
  avAddress,
  avBusinessName,
  avContactName,
  sdVenue,
}: {
  isPartial: boolean;
  avAddress?: {
    address?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  avBusinessName?: string | null;
  avContactName?: string | null;
  sdVenue?: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
}) => ({
  name: isPartial
    ? sdVenue?.name || "Address Withheld"
    : avBusinessName || avContactName || sdVenue?.name || null,
  ...(isPartial
    ? {}
    : { contact_name: avContactName || avBusinessName || null }),
  address: resolveStreetForSuperDispatch({
    isPartial,
    avStreet: formatAutovistaStreet(avAddress),
    sdStreet: sdVenue?.address,
  }),
  city: avAddress?.city || sdVenue?.city || null,
  state: avAddress?.state || sdVenue?.state || null,
  zip: normalizeUsZip(avAddress?.zip || sdVenue?.zip) || null,
});

export const updateSuperDispatchAddresses = async (
  order: IOrder,
): Promise<void> => {
  if (!order.tms?.guid) {
    return;
  }

  const superDispatchGuid = order.tms.guid;
  const token = await authenticateSuperDispatch();
  const apiUrl = "https://api.shipper.superdispatch.com/v1/public";

  const getOrderResponse = await fetch(
    `${apiUrl}/orders/${superDispatchGuid}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!getOrderResponse.ok) {
    const errorText = await getOrderResponse.text();
    logger.error("Super Dispatch GET request error:", {
      status: getOrderResponse.status,
      statusText: getOrderResponse.statusText,
      error: errorText,
      orderRefId: order.refId,
      superDispatchGuid,
    });
    throw new Error(
      `Super Dispatch GET API error: ${getOrderResponse.status} ${getOrderResponse.statusText}`,
    );
  }

  const getOrderResult = await getOrderResponse.json();
  if (getOrderResult.data?.error_id) {
    throw new Error(
      `Super Dispatch GET validation error: ${getOrderResult.data.message}`,
    );
  }

  const existingOrder = getOrderResult.data?.object;
  if (!existingOrder) {
    throw new Error("Invalid response from Super Dispatch API");
  }

  const isPartial = order.tmsPartialOrder === true;

  const addressPatch = {
    pickup: {
      latitude: toFloatOrNull(order.origin?.latitude),
      longitude: toFloatOrNull(order.origin?.longitude),
      ...(isPartial ? {} : { notes: order.origin?.notes || null }),
      venue: buildVenuePatch({
        isPartial,
        avAddress: order.origin?.address,
        avBusinessName: order.origin?.contact?.companyName,
        avContactName: order.origin?.contact?.name,
        sdVenue: existingOrder.pickup?.venue,
      }),
    },
    delivery: {
      latitude: toFloatOrNull(order.destination?.latitude),
      longitude: toFloatOrNull(order.destination?.longitude),
      ...(isPartial ? {} : { notes: order.destination?.notes || null }),
      venue: buildVenuePatch({
        isPartial,
        avAddress: order.destination?.address,
        avBusinessName: order.destination?.contact?.companyName,
        avContactName: order.destination?.contact?.name,
        sdVenue: existingOrder.delivery?.venue,
      }),
    },
  };

  const patchOrderResponse = await fetch(
    `${apiUrl}/orders/${superDispatchGuid}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/merge-patch+json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(addressPatch),
    },
  );

  if (!patchOrderResponse.ok) {
    const errorText = await patchOrderResponse.text();
    logger.error("Super Dispatch address PATCH error:", {
      status: patchOrderResponse.status,
      statusText: patchOrderResponse.statusText,
      error: errorText,
      orderRefId: order.refId,
      superDispatchGuid,
    });
    throw new Error(
      `Super Dispatch PATCH API error: ${patchOrderResponse.status} ${patchOrderResponse.statusText}`,
    );
  }

  const patchResult = await patchOrderResponse.json();
  if (patchResult.data?.error_id) {
    throw new Error(
      `Super Dispatch validation error: ${patchResult.data.message}`,
    );
  }

  logger.info("Updated Super Dispatch venues from Autovista address edit", {
    orderRefId: order.refId,
    superDispatchGuid,
    tmsPartialOrder: isPartial,
  });
};
