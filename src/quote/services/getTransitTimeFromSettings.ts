const DEFAULT_TRANSIT_TIMES = [
  { minMiles: 0, maxMiles: 200, minDays: 1, maxDays: 3 },
  { minMiles: 200, maxMiles: 600, minDays: 1, maxDays: 8 },
  { minMiles: 600, maxMiles: 1000, minDays: 2, maxDays: 10 },
  { minMiles: 1000, maxMiles: 1500, minDays: 2, maxDays: 11 },
  { minMiles: 1500, maxMiles: 2000, minDays: 3, maxDays: 14 },
  { minMiles: 2000, maxMiles: 2400, minDays: 4, maxDays: 14 },
  { minMiles: 2400, maxMiles: 9000, minDays: 5, maxDays: 14 },
];

export const getTransitTimeFromSettings = (
  miles: number,
  transitTimes: Array<{
    minMiles: number;
    maxMiles: number;
    minDays: number;
    maxDays: number;
  }> = [],
): [number, number] | null => {
  console.log("[transitTime] input miles:", miles);
  console.log(
    "[transitTime] settings transitTimes count:",
    Array.isArray(transitTimes) ? transitTimes.length : "non-array",
  );

  if (!Number.isFinite(miles)) {
    console.log("[transitTime] invalid miles, returning null");
    return null;
  }

  const availableTransitTimes =
    transitTimes.length > 0 ? transitTimes : DEFAULT_TRANSIT_TIMES;

  const normalizedRanges = availableTransitTimes
    .map((range) => ({
      minMiles: Number(range?.minMiles),
      maxMiles: Number(range?.maxMiles),
      minDays: Number(range?.minDays),
      maxDays: Number(range?.maxDays),
      raw: range,
    }))
    .filter(
      (range) =>
        Number.isFinite(range.minMiles) &&
        Number.isFinite(range.maxMiles) &&
        Number.isFinite(range.minDays) &&
        Number.isFinite(range.maxDays),
    )
    .sort((a, b) => a.minMiles - b.minMiles);

  const matchedRange = normalizedRanges.find(
    (range) => miles >= range.minMiles && miles <= range.maxMiles,
  );

  if (!matchedRange) {
    console.log("[transitTime] no matching range found");
    const lastRange = normalizedRanges[normalizedRanges.length - 1];
    if (!lastRange) {
      return null;
    }
    const fallbackResult: [number, number] = [
      lastRange.minDays,
      lastRange.maxDays,
    ];
    console.log(
      "[transitTime] falling back to last range:",
      lastRange.raw,
      "result:",
      fallbackResult,
    );
    return fallbackResult;
  }

  const result: [number, number] = [matchedRange.minDays, matchedRange.maxDays];
  console.log(
    "[transitTime] matched range:",
    matchedRange.raw,
    "result:",
    result,
  );
  return result;
};
