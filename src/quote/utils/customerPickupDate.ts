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

export function formatEmbedDateDot(date: Date): string | null {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}.${dd}.${yyyy}`;
}

export function formatEmbedDateRange(startDate: Date, endDate: Date): string | null {
  const start = formatEmbedDateDot(startDate);
  const end = formatEmbedDateDot(endDate);
  if (!start || !end) return null;
  return `${start}\u2013${end}`;
}

/**
 * Customer pickup window end — matches quote embed / book-order review:
 * 1-Day Pickup → selected date through the next calendar day (+1), etc.
 */
export function getCustomerPickupWindowEndDate(
  startDate: Date | string,
  serviceLevelDays: number,
): Date {
  const start =
    startDate instanceof Date ? new Date(startDate) : new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + serviceLevelDays);
  return end;
}

/**
 * Match public quote detail pickup-window display:
 * - 1-day
 * - 04.27.2026-04.30.2026 style dotted ranges
 */
export function formatPickupWindowEmailLabel(
  startDate: Date,
  serviceLevelDays: number,
): string {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = getCustomerPickupWindowEndDate(start, serviceLevelDays);
  const range = formatEmbedDateRange(start, end);
  const windowLabel = `${serviceLevelDays}-day pickup`;
  return range ? `${windowLabel}: ${range}` : windowLabel;
}

/**
 * @deprecated Use formatPickupWindowEmailLabel for customer quote emails.
 */
export function formatPickupWindowBetweenLabel(
  startDate: Date,
  endOffsetCalendarDays: number,
): string {
  return formatPickupWindowEmailLabel(startDate, endOffsetCalendarDays);
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
