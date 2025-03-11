import { format } from "date-fns";
import { format as formatTZ } from "date-fns-tz";

// Timezone for Riyadh (GMT+3)
const TIMEZONE = "Asia/Riyadh";

export function formatGMT3Time(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  return `${hours}:${minutes} ${ampm}`;
}

export function getGMT3ISOString(date: Date): string {
  // Format with the GMT+3 timezone offset
  return formatTZ(date, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", { timeZone: TIMEZONE });
}