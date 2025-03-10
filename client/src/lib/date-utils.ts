import { format } from "date-fns";
import { format as formatTZ } from "date-fns-tz";

// Timezone for Riyadh (GMT+3)
const TIMEZONE = "Asia/Riyadh";

export function formatGMT3Time(isoString: string | Date): string {
  const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
  return format(date, 'EEEE, MMMM d, yyyy h:mm a');
}

export function getGMT3ISOString(date: Date): string {
  // Format with the GMT+3 timezone offset
  return formatTZ(date, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", { timeZone: TIMEZONE });
}