/**
 * Phone Number Formatting Utility
 *
 * This utility formats phone numbers to a consistent format
 */

export const formatPhoneNumber = (
  phoneNumber: string | undefined | null,
): string => {
  if (!phoneNumber) {
    return "";
  }

  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, "");

  // Handle different phone number lengths
  if (cleaned.length === 10) {
    // Format as (XXX) XXX-XXXX
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === "1") {
    // Remove leading 1 and format as (XXX) XXX-XXXX
    const withoutOne = cleaned.slice(1);
    return `(${withoutOne.slice(0, 3)}) ${withoutOne.slice(3, 6)}-${withoutOne.slice(6)}`;
  } else {
    // Return original if not a standard US phone number
    return phoneNumber;
  }
};

