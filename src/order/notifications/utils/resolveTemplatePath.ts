import { access } from "fs/promises";

export const resolveTemplatePath = async (
  primaryPath: string,
  fallbackPath: string,
): Promise<string> => {
  try {
    await access(primaryPath);
    return primaryPath;
  } catch (primaryError) {
    try {
      await access(fallbackPath);
      return fallbackPath;
    } catch (fallbackError) {
      return primaryPath;
    }
  }
};
