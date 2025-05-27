import { IServiceLevelModifier } from "../../_global/interfaces";

// Returns markup for selected service level
export function getServiceLevelValue(
  serviceLevels: IServiceLevelModifier[],
  targetServiceLevel: string,
): number {
  const match = serviceLevels.find(
    (level) => level.serviceLevelOption === targetServiceLevel.toString(),
  );

  if (!match) {
    return 0;
  }

  return match.value;
}
