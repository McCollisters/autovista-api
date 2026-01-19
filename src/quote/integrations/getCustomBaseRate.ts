import { IPortal } from "@/_global/models";
import { ICustomRate } from "../../portal/schema";

export const getCustomBaseRate = (miles: number, portal: IPortal): number | undefined => {
  try {
    if (!portal.customRates) {
      return undefined;
    }

    const matchingRate = portal.customRates.find(
      (customRate: ICustomRate) =>
        miles >= customRate.min && miles <= customRate.max,
    );

    if (!matchingRate) {
      return undefined;
    }

    return matchingRate.value;
  } catch (error) {
    console.log(error);
    return undefined;
  }
};
