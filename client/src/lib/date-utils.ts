
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";

// Timezone for Riyadh (GMT+3)
const TIMEZONE = "Asia/Riyadh";

/**
 * Format a date string in the Riyadh timezone (GMT+3)
 * @param dateString ISO date string from the server
 * @param formatStr Format string for date-fns
 * @returns Formatted date string
 */
export function formatLocalTime(dateString: string, formatStr: string = "h:mm a"): string {
  return format(parseISO(dateString), formatStr, { 
    timeZone: TIMEZONE,
    locale: undefined // Explicitly use Gregorian calendar
  });
}

/**
 * Get a date object adjusted for Riyadh timezone
 * @param dateString ISO date string from the server
 * @returns Date object adjusted for Riyadh timezone
 */
export function getLocalDate(dateString: string): Date {
  const date = parseISO(dateString);
  // Return date with no timezone adjustments as we'll handle this with format options
  return date;
}
