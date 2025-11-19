/**
 * Convert a string to title case
 * @param str - The string to convert
 * @returns The string in title case, or undefined if input is falsy
 */
export const toTitleCase = (str: string | null | undefined): string | undefined => {
  if (!str) {
    return undefined;
  }

  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

