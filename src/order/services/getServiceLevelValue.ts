import { IServiceLevelModifier } from "../../_global/interfaces";

// Returns markup for selected service level
export function getServiceLevelValue(
  serviceLevels: IServiceLevelModifier[],
  targetServiceLevel: string,
): number | undefined {
  const match = serviceLevels.find(
    (level) => level.serviceLevelOption === targetServiceLevel,
  );
  return match?.value;
}
