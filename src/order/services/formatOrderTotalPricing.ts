import { IQuote } from "../../quote/schema";
import { getServiceLevelValue } from "./getServiceLevelValue";
import { TransportType } from "../../_global/enums";

export const formatOrderTotalPricing = async ({
  quote,
  transportType,
  serviceLevel,
}: {
  quote: IQuote;
  transportType: string;
  serviceLevel: string;
}) => {
  try {
    const { totalPricing } = quote;

    if (!totalPricing) {
      throw new Error();
    }

    const enclosedFee =
      transportType === "enclosed"
        ? totalPricing.modifiers.conditional.enclosed
        : 0;

    const serviceLevelFee =
      getServiceLevelValue(
        totalPricing?.modifiers.conditional.serviceLevels,
        serviceLevel,
      ) || 0;

    const base =
      quote.transportType === TransportType.WhiteGlove
        ? totalPricing.base.whiteGlove
        : quote.totalPricing.base.tms > 0
          ? totalPricing.base.tms
          : totalPricing.base.custom || 0;

    const globalMod = totalPricing.modifiers.global;
    const portalMod = totalPricing.modifiers.portal;

    const modifiers =
      globalMod.inoperable +
      globalMod.oversize +
      globalMod.routes +
      globalMod.discount +
      portalMod.commission +
      portalMod.companyTariff +
      portalMod.discount +
      enclosedFee +
      serviceLevelFee;

    return {
      base,
      modifiers: {
        global: {
          inoperable: globalMod.inoperable,
          oversize: globalMod.oversize,
          routes: globalMod.routes,
          discount: globalMod.discount,
        },
        portal: {
          commission: totalPricing.modifiers.portal.commission,
          companyTariff: totalPricing.modifiers.portal.companyTariff,
          discount: totalPricing.modifiers.portal.discount,
        },
        conditional: {
          enclosed: enclosedFee,
          serviceLevel: serviceLevelFee,
        },
      },
      totalModifiers: modifiers,
      totalTms:
        base +
        modifiers -
        totalPricing.modifiers.portal.commission -
        totalPricing.modifiers.portal.companyTariff,
      total: base + modifiers,
    };
  } catch (err) {
    throw err;
  }
};
