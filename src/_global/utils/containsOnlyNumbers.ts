/**
 * Check if a string contains only numbers
 * @param str - The string to check
 * @returns true if string contains only numbers, false otherwise, or null if input is falsy
 */
export const containsOnlyNumbers = (str: string | null | undefined): boolean | null => {
  if (!str) {
    return null;
  }

  return /^\d+$/.test(str);
};

