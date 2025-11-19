/**
 * Utility functions to check if addresses contain "WITTHELD"
 * This prevents updates to orders with withheld/sensitive address information
 */

import { IOrder } from "@/_global/models";

/**
 * Check if a specific address string contains "WITTHELD"
 * @param address - The address string to check
 * @returns True if address contains "WITTHELD", false otherwise
 */
export const isWithheldAddress = (address: string | null | undefined): boolean => {
  if (!address) return false;
  return address.toUpperCase().includes("WITTHELD");
};

/**
 * Check if any address in an order contains "WITTHELD"
 * This prevents updates to orders with withheld/sensitive address information
 * @param order - The order object to check
 * @returns True if any address contains "WITTHELD", false otherwise
 */
export const checkForWithheldAddress = (order: IOrder | Partial<IOrder>): boolean => {
  // Check pickup address
  if (
    order.origin?.address?.address &&
    isWithheldAddress(order.origin.address.address)
  ) {
    return true;
  }

  // Check delivery address
  if (
    order.destination?.address?.address &&
    isWithheldAddress(order.destination.address.address)
  ) {
    return true;
  }

  return false;
};

