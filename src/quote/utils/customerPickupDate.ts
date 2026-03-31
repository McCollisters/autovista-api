/**
 * Customer pickup date rules — mirrors Book Order embed (OrderFormEmbed.js):
 * minimum date is the 3rd business day from today (weekends and holidays excluded).
 */

export function getMinimumCustomerPickupDate(now: Date, holidays: Date[]): Date {
  const holidayStrings = holidays.map((holiday) => {
    const d = holiday instanceof Date ? holiday : new Date(holiday as string);
    return d.toString();
  });

  const todayDate = new Date(now);
  todayDate.setHours(0, 0, 0, 0);
  const minDate = new Date(todayDate);
  minDate.setHours(0, 0, 0, 0);
  let count = 0;

  while (count < 3) {
    minDate.setDate(minDate.getDate() + 1);
    const isHoliday = holidayStrings.includes(minDate.toString());
    const day = minDate.getDay();
    if (day !== 0 && day !== 6 && !isHoliday) {
      count += 1;
    }
  }

  return minDate;
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isPickupDateAllowed(
  selected: Date,
  minimum: Date,
  holidays: Date[],
): boolean {
  const sel = new Date(selected);
  sel.setHours(0, 0, 0, 0);
  const min = new Date(minimum);
  min.setHours(0, 0, 0, 0);
  if (sel.getTime() < min.getTime()) {
    return false;
  }
  const day = sel.getDay();
  if (day === 0 || day === 6) {
    return false;
  }
  for (const h of holidays) {
    const hd = h instanceof Date ? h : new Date(h as string);
    if (isSameCalendarDay(sel, hd)) {
      return false;
    }
  }
  return true;
}

/** Parse YYYY-MM-DD from the public form; returns local midnight. */
export function parseDateOnlyInput(input: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(input).trim());
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

/**
 * e.g. "Between 3/31/2026 and 4/1/2026" (calendar end = start + offset days).
 */
export function formatPickupWindowBetweenLabel(
  startDate: Date,
  endOffsetCalendarDays: number,
): string {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + endOffsetCalendarDays);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  return `Between ${fmt(start)} and ${fmt(end)}`;
}

/**
 * Parse pickup date from stored quote (ISO-safe) — mirrors QuoteDetailEmbed / public form.
 */
export function parsePickupStartDateFromQuote(quote: {
  pickupStartDate?: string | Date | null;
}): Date | null {
  const raw = quote?.pickupStartDate;
  if (raw == null || raw === "") return null;
  const s =
    typeof raw === "string"
      ? raw
      : raw instanceof Date
        ? raw.toISOString()
        : String(raw);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    const dt = new Date(y, mo, d);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const parsed = new Date(raw as string);
  if (isNaN(parsed.getTime())) return null;
  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
  );
}
