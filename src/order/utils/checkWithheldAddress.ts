/**
 * Detect Super Dispatch withheld/redacted address placeholders.
 *
 * Create-partial uses the typo "WITTHELD"; later partial updates used the
 * correctly spelled "WITHHELD". Treat both as placeholders so they cannot
 * overwrite real Autovista or Super Dispatch street addresses.
 */

import { IOrder } from "@/_global/models";

const WITHHELD_ADDRESS_PATTERN = /WITTHELD|WITHHELD/i;

/**
 * Check if a specific address string is a withheld placeholder
 */
export const isWithheldAddress = (
  address: string | null | undefined,
): boolean => {
  if (!address) return false;
  return WITHHELD_ADDRESS_PATTERN.test(address);
};

/**
 * Check if any address in an order contains a withheld placeholder
 */
export const checkForWithheldAddress = (
  order: IOrder | Partial<IOrder>,
): boolean => {
  if (
    order.origin?.address?.address &&
    isWithheldAddress(order.origin.address.address)
  ) {
    return true;
  }

  if (
    order.destination?.address?.address &&
    isWithheldAddress(order.destination.address.address)
  ) {
    return true;
  }

  return false;
};
