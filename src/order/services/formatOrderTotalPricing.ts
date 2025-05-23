import { IQuote } from "../../quote/schema";
import { getServiceLevelValue } from "./getServiceLevelValue";

export const formatOrderTotalPricing = async ({
  quote,
  transportType,
}: {
  quote: IQuote;
  transportType: string;
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

    const serviceLevelFee = getServiceLevelValue(
      totalPricing?.modifiers.conditional.serviceLevels,
      "1",
    );

    const modifiersTotal = 0;
    const orderTotal = 0;

    return {
      base: 500,
      modifiers: {
        global: {
          inoperable: 20,
          oversize: 54,
          routes: 10,
        },
        portal: {
          commission: 20,
          companyTariff: 50,
        },
        conditional: {
          enclosed: 20,
          serviceLevel: 500,
        },
      },
      totalModifiers: 500,
      total: 1500,
    };
  } catch (err) {
    throw err;
  }
};
