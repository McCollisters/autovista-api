/**
 * Request Signature via HelloSign
 *
 * This service sends a signature request to customers using HelloSign.
 * Handles both regular and MMI portal orders with different templates.
 */

import { logger } from "@/core/logger";
import { Order } from "@/_global/models";
import { getPickupDatesString } from "./utils/getPickupDatesString";
import { getDeliveryDatesString } from "./utils/getDeliveryDatesString";
import { MMI_PORTALS } from "@/_global/constants/portalIds";

interface RequestSignatureParams {
  orderId: string;
  recipientEmail: string;
  recipientName: string;
}

// HelloSign template IDs
const HELLOSIGN_TEMPLATE_REGULAR = "a6512df71953b6fb7290ad32d452f90e52d853bf";
const HELLOSIGN_TEMPLATE_MMI = "0becbee2fecda15bf3b5d0a820d08cfb4c4ce90b";

/**
 * Request signature for regular (non-MMI) orders
 */
export async function requestSignature({
  orderId,
  recipientEmail,
  recipientName,
}: RequestSignatureParams): Promise<{ success: boolean; error?: string }> {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    // Extract pickup information
    const pickupContactName =
      order.origin?.contact?.name || order.origin?.contact?.companyName || "";
    const pickupPhone = order.origin?.contact?.phone || "";
    const pickupMobilePhone = order.origin?.contact?.phoneMobile || "";
    const pickupAddress =
      order.origin?.address?.address ||
      order.origin?.address?.addressLine1 ||
      "";
    const pickupCity = order.origin?.address?.city || "";
    const pickupState = order.origin?.address?.state || "";
    const pickupZip = order.origin?.address?.zip || "";

    // Extract delivery information
    const deliveryContactName =
      order.destination?.contact?.name ||
      order.destination?.contact?.companyName ||
      "";
    const deliveryPhone = order.destination?.contact?.phone || "";
    const deliveryMobilePhone = order.destination?.contact?.phoneMobile || "";
    const deliveryAddress =
      order.destination?.address?.address ||
      order.destination?.address?.addressLine1 ||
      "";
    const deliveryCity = order.destination?.address?.city || "";
    const deliveryState = order.destination?.address?.state || "";
    const deliveryZip = order.destination?.address?.zip || "";

    const pickupDates = getPickupDatesString(order);
    const deliveryDates = getDeliveryDatesString(order);

    // Format vehicles string
    let vehiclesString = "";
    order.vehicles.forEach((vehicle) => {
      vehiclesString += `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

      if (vehicle.vin) {
        vehiclesString += `, VIN#: ${vehicle.vin} `;
      } else {
        vehiclesString += ` (Please contact us ASAP with the VIN for this vehicle.)`;
      }
    });

    const pickupAddressLine2 = `${pickupCity}, ${pickupState} ${pickupZip}`;
    const deliveryAddressLine2 = `${deliveryCity}, ${deliveryState} ${deliveryZip}`;

    const pickupMobileString = pickupMobilePhone
      ? `Mobile: ${pickupMobilePhone}`
      : "";
    const deliveryMobileString = deliveryMobilePhone
      ? `Mobile: ${deliveryMobilePhone}`
      : "";

    // Prepare HelloSign options
    const opts = {
      test_mode: 0,
      template_id: HELLOSIGN_TEMPLATE_REGULAR,
      subject: "Confirm your vehicle transport order",
      message: "Please sign to confirm your order details.",
      signers: [
        {
          email_address: recipientEmail,
          name: recipientName,
          role: "Customer",
        },
      ],
      custom_fields: [
        {
          name: "uniqueId",
          value: `# ${order.refId}`,
        },
        {
          name: "pickupDates",
          value: pickupDates,
        },
        {
          name: "deliveryDates",
          value: deliveryDates,
        },
        {
          name: "pickupAddressLine1",
          value: pickupAddress,
        },
        {
          name: "pickupAddressLine2",
          value: pickupAddressLine2,
        },
        {
          name: "pickupContactName",
          value: pickupContactName,
        },
        {
          name: "pickupPhone",
          value: pickupPhone,
        },
        {
          name: "pickupMobilePhone",
          value: pickupMobileString,
        },
        {
          name: "deliveryAddressLine1",
          value: deliveryAddress,
        },
        {
          name: "deliveryAddressLine2",
          value: deliveryAddressLine2,
        },
        {
          name: "deliveryContactName",
          value: deliveryContactName,
        },
        {
          name: "deliveryPhone",
          value: deliveryPhone,
        },
        {
          name: "deliveryMobilePhone",
          value: deliveryMobileString,
        },
        {
          name: "vehicles",
          value: vehiclesString,
        },
        {
          name: "transportType",
          value: order.transportType,
        },
      ],
    };

    // Initialize HelloSign SDK
    const hellosign = require("hellosign-sdk")({
      key: process.env.HELLOSIGN_API_KEY,
    });

    // Send signature request
    const hsResponse = await hellosign.signatureRequest.sendWithTemplate(opts);

    if (hsResponse && hsResponse.signature_request) {
      // Update order with signature request information
      await Order.findByIdAndUpdate(orderId, {
        signatureRequestSent: true,
        signatureReceived: false,
        signatureRequestId: hsResponse.signature_request.signature_request_id,
      });

      logger.info("Signature request sent successfully", {
        orderId,
        uniqueId: order.refId,
        recipientEmail,
        signatureRequestId: hsResponse.signature_request.signature_request_id,
      });

      return { success: true };
    } else {
      logger.error("HelloSign did not return a valid response", {
        orderId,
        uniqueId: order.refId,
      });
      return { success: false, error: "Failed to send signature request" };
    }
  } catch (error) {
    logger.error("Error requesting signature:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orderId,
    });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to request signature",
    };
  }
}

/**
 * Request signature for MMI portal orders
 */
export async function requestSignatureMMI({
  orderId,
  recipientEmail,
  recipientName,
}: RequestSignatureParams): Promise<{ success: boolean; error?: string }> {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    // Extract pickup information
    const pickupContactName =
      order.origin?.contact?.name || order.origin?.contact?.companyName || "";
    const pickupPhone = order.origin?.contact?.phone || "";
    const pickupMobilePhone = order.origin?.contact?.phoneMobile || "";
    const pickupAddress =
      order.origin?.address?.address ||
      order.origin?.address?.addressLine1 ||
      "";
    const pickupCity = order.origin?.address?.city || "";
    const pickupState = order.origin?.address?.state || "";
    const pickupZip = order.origin?.address?.zip || "";

    // Extract delivery information
    const deliveryContactName =
      order.destination?.contact?.name ||
      order.destination?.contact?.companyName ||
      "";
    const deliveryPhone = order.destination?.contact?.phone || "";
    const deliveryMobilePhone = order.destination?.contact?.phoneMobile || "";
    const deliveryAddress =
      order.destination?.address?.address ||
      order.destination?.address?.addressLine1 ||
      "";
    const deliveryCity = order.destination?.address?.city || "";
    const deliveryState = order.destination?.address?.state || "";
    const deliveryZip = order.destination?.address?.zip || "";

    const pickupDates = getPickupDatesString(order);
    const deliveryDates = getDeliveryDatesString(order);

    // Format vehicles string
    let vehiclesString = "";
    order.vehicles.forEach((vehicle) => {
      vehiclesString += `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

      if (vehicle.vin) {
        vehiclesString += `, VIN#: ${vehicle.vin} `;
      } else {
        vehiclesString += ` (NOTE: Please contact us ASAP with the VIN for this vehicle.)`;
      }
    });

    const pickupAddressLine2 = `${pickupCity}, ${pickupState} ${pickupZip}`;
    const deliveryAddressLine2 = `${deliveryCity}, ${deliveryState} ${deliveryZip}`;

    const pickupMobileString = pickupMobilePhone
      ? `Mobile: ${pickupMobilePhone}`
      : "";
    const deliveryMobileString = deliveryMobilePhone
      ? `Mobile: ${deliveryMobilePhone}`
      : "";

    // Prepare HelloSign options
    const opts = {
      test_mode: 0,
      template_id: HELLOSIGN_TEMPLATE_MMI,
      subject: "Confirm your vehicle transport order",
      message: "Please sign to confirm your order details.",
      signers: [
        {
          email_address: recipientEmail,
          name: recipientName,
          role: "Customer",
        },
      ],
      custom_fields: [
        {
          name: "uniqueId",
          value: `# ${order.refId}`,
        },
        {
          name: "pickupDates",
          value: pickupDates,
        },
        {
          name: "deliveryDates",
          value: deliveryDates,
        },
        {
          name: "pickupAddressLine1",
          value: pickupAddress,
        },
        {
          name: "pickupAddressLine2",
          value: pickupAddressLine2,
        },
        {
          name: "pickupContactName",
          value: pickupContactName,
        },
        {
          name: "pickupPhone",
          value: pickupPhone,
        },
        {
          name: "pickupMobilePhone",
          value: pickupMobileString,
        },
        {
          name: "deliveryAddressLine1",
          value: deliveryAddress,
        },
        {
          name: "deliveryAddressLine2",
          value: deliveryAddressLine2,
        },
        {
          name: "deliveryContactName",
          value: deliveryContactName,
        },
        {
          name: "deliveryPhone",
          value: deliveryPhone,
        },
        {
          name: "deliveryMobilePhone",
          value: deliveryMobileString,
        },
        {
          name: "vehicles",
          value: vehiclesString,
        },
        {
          name: "transportType",
          value: order.transportType,
        },
      ],
    };

    // Initialize HelloSign SDK
    const hellosign = require("hellosign-sdk")({
      key: process.env.HELLOSIGN_API_KEY,
    });

    // Send signature request
    const hsResponse = await hellosign.signatureRequest.sendWithTemplate(opts);

    if (hsResponse && hsResponse.signature_request) {
      // Update order with signature request information
      await Order.findByIdAndUpdate(orderId, {
        signatureRequestSent: true,
        signatureReceived: false,
        signatureRequestId: hsResponse.signature_request.signature_request_id,
      });

      logger.info("Signature request sent successfully (MMI)", {
        orderId,
        uniqueId: order.refId,
        recipientEmail,
        signatureRequestId: hsResponse.signature_request.signature_request_id,
      });

      return { success: true };
    } else {
      logger.error("HelloSign did not return a valid response (MMI)", {
        orderId,
        uniqueId: order.refId,
      });
      return { success: false, error: "Failed to send signature request" };
    }
  } catch (error) {
    logger.error("Error requesting signature (MMI):", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orderId,
    });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to request signature",
    };
  }
}

/**
 * Main function to request signature - automatically determines if MMI or regular
 */
export async function requestOrderSignature({
  orderId,
  recipientEmail,
  recipientName,
}: RequestSignatureParams): Promise<{ success: boolean; error?: string }> {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    const portalId = String(order.portalId);
    const isMMI = MMI_PORTALS.includes(portalId);

    if (isMMI) {
      return await requestSignatureMMI({
        orderId,
        recipientEmail,
        recipientName,
      });
    } else {
      return await requestSignature({ orderId, recipientEmail, recipientName });
    }
  } catch (error) {
    logger.error("Error in requestOrderSignature:", {
      error: error instanceof Error ? error.message : String(error),
      orderId,
    });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to request signature",
    };
  }
}
