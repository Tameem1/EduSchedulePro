
// Use date-fns for formatting dates
import { format, formatISO } from "date-fns";

// Define timezone
export const TIMEZONE = "Asia/Riyadh"; // GMT+3

/**
 * Format a date or ISO string to GMT+3 time (HH:mm format)
 */
export function formatGMT3Time(isoString: string | Date): string {
  const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
  return format(date, 'EEEE, MMMM d, yyyy h:mm a');
}

/**
 * Convert a Date object to an ISO string without any timezone adjustments
 * This ensures the exact time selected is what gets stored
 */
export function getGMT3ISOString(date: Date): string {
  // Create a new Date to avoid mutating the original
  const d = new Date(date);
  // Return the ISO string without any adjustments
  return formatISO(d);
}
