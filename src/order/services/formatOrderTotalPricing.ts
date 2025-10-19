import { IQuote } from "@/_global/models";
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
        ? (totalPricing.modifiers.conditional?.enclosedFlat || 0) +
          (totalPricing.modifiers.conditional?.enclosedPercent || 0)
        : 0;

    const serviceLevelFee =
      getServiceLevelValue(
        totalPricing?.modifiers.conditional?.serviceLevels || [],
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
      (globalMod?.inoperable || 0) +
      (globalMod?.oversize || 0) +
      (globalMod?.routes || 0) +
      (globalMod?.states || 0) +
      (globalMod?.discount || 0) +
      (portalMod?.commission || 0) +
      (portalMod?.companyTariff || 0) +
      (portalMod?.discount || 0) +
      enclosedFee +
      serviceLevelFee;

    return {
      base,
      modifiers: {
        global: {
          inoperable: globalMod?.inoperable || 0,
          oversize: globalMod?.oversize || 0,
          routes: globalMod?.routes || 0,
          states: globalMod?.states || 0,
          discount: globalMod?.discount || 0,
        },
        portal: {
          commission: totalPricing.modifiers.portal?.commission || 0,
          companyTariff: totalPricing.modifiers.portal?.companyTariff || 0,
          discount: totalPricing.modifiers.portal?.discount || 0,
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
        (totalPricing.modifiers.portal?.commission || 0) -
        (totalPricing.modifiers.portal?.companyTariff || 0),
      total: base + modifiers,
    };
  } catch (err) {
    throw err;
  }
};
