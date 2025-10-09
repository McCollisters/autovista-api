import { IOrder } from "../schema";
import { IAddress } from "../../_global/interfaces";
import { getDeliveryRanges } from "./getDeliveryRanges";
import { Portal } from "../../portal/schema";

function formatAddress({ address, addressLine2 }: IAddress): string {
  return addressLine2 ? `${address} ${addressLine2}` : address || "";
}

export const formatOrderForSD = async (order: IOrder) => {
  const {
    refId,
    reg,
    schedule,
    origin,
    destination,
    portalId,
    vehicles,
    transportType,
  } = order;

  try {
    const portal = await Portal.findById(portalId);

    if (!portal) {
      throw new Error();
    }

    let deliveryRanges = getDeliveryRanges({
      pickupStartDate: schedule.pickupSelected,
      serviceLevel: 3,
      transitTime: [0, 4],
      holidayDates: [],
    });

    const formattedVehicles = vehicles.map((vehicle) => {
      return {
        vin: vehicle.vin,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        is_inoperable: vehicle.isInoperable,
        tariff: vehicle.pricing?.base,
        pricingClass: vehicle.pricingClass,
      };
    });

    const pickupAddress = formatAddress(origin.address);
    const deliveryAddress = formatAddress(destination.address);

    return {
      number: refId,
      purchase_order_number: reg,
      pickup: {
        first_available_pickup_date: deliveryRanges[0],
        scheduled_at: deliveryRanges[0],
        scheduled_ends_at: deliveryRanges[1],
        notes: origin.contact?.notes,
        date_type: "estimated",
        venue: {
          address: pickupAddress,
          city: origin.address.city,
          state: origin.address.state,
          zip: origin.address.zip,
          name: origin.contact?.companyName,
          contact_name: origin.contact?.name,
          contact_email: origin.contact?.email,
          contact_phone: origin.contact?.phone,
          contact_mobile_phone: origin.contact?.phoneMobile,
        },
      },
      delivery: {
        scheduled_at: deliveryRanges[2],
        scheduled_ends_at: deliveryRanges[3],
        notes: destination.contact?.notes,
        date_type: "estimated",
        venue: {
          address: deliveryAddress,
          city: destination.address.city,
          state: destination.address.state,
          zip: destination.address.zip,
          name: destination.contact?.companyName,
          contact_name: destination.contact?.name,
          contact_email: destination.contact?.email,
          contact_phone: destination.contact?.phone,
          contact_mobile_phone: destination.contact?.phoneMobile,
        },
      },
      customer: {
        address: portal.address?.address,
        city: portal.address?.city,
        state: portal.address?.state,
        zip: portal.address?.zip,
        name: portal.companyName,
        business_type: "BUSINESS",
        email: portal.contact?.email,
        phone: portal.contact?.phone,
        contact_name: portal.contact?.name,
        contact_phone: portal.contact?.phone,
        contact_email: portal.contact?.email,
      },
      vehicles: formattedVehicles,
      transport_type: transportType.toUpperCase(),
    };
  } catch (err) {
    console.log(err);
  }
};
