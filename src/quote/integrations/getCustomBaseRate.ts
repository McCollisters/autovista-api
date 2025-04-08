import { IPortal, ICustomRate } from "../../portal/schema";

export const getCustomBaseRate = (miles: number, portal: IPortal) => {
  try {
    if (!portal.customRates) {
      throw new Error(`Rate sheet not found`);
    }

    const matchingRate = portal.customRates.find(
      (customRate: ICustomRate) =>
        miles >= customRate.min && miles <= customRate.max,
    );

    if (!matchingRate) {
      throw new Error(`Rate not found`);
    }

    return matchingRate.value;
  } catch (error) {
    console.log(error);
  }
};
