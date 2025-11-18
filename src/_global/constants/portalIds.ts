/**
 * Portal IDs Constants
 *
 * Centralized portal ID definitions
 */

export const PORTAL_IDS = {
  MMI_1: "60d364c5176cba0017cbd78f", // MMI Portal 1 - special notifications
  MMI_2: "67d036b3e29c00962804a466", // MMI Portal 2 - special notifications
  SIRVA_1: "621e2882dee77a00351e5aac",
  SIRVA_2: "65fb221d27f5b6f47701f8ea",
  SIRVA_3: "66056b34982f1bf738687859",
  SIRVA_4: "5e99f0b420e68d5f479d7317",
} as const;

/**
 * Portals that receive MMI-specific notifications
 */
export const MMI_PORTALS = [PORTAL_IDS.MMI_1, PORTAL_IDS.MMI_2];

/**
 * Portals that are Sirva-related (use Sirva-specific templates)
 */
export const SIRVA_PORTALS = [
  PORTAL_IDS.SIRVA_1,
  PORTAL_IDS.SIRVA_2,
  PORTAL_IDS.SIRVA_3,
  PORTAL_IDS.SIRVA_4,
];
