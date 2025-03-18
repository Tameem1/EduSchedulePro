import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { DateRange } from "react-day-picker"

interface DatePickerProps {
  date?: Date
  selected?: {
    from: Date;
    to: Date;
  }
  onSelect?: (range: { from: Date; to: Date } | undefined) => void
  locale?: any
  showMonthYearPicker?: boolean
  className?: string
}

export function DatePicker({
  date,
  selected,
  onSelect,
  locale,
  showMonthYearPicker = false,
  className,
}: DatePickerProps) {
  const [selectedRange, setSelectedRange] = React.useState<{
    from: Date;
    to: Date;
  } | undefined>(selected)

  // Update internal state when prop changes
  React.useEffect(() => {
    setSelectedRange(selected)
  }, [selected])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={"outline"}
          className={cn(
            "w-[300px] justify-start text-right font-normal",
            !selectedRange && "text-muted-foreground",
            className
          )}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <CalendarIcon className="ml-2 h-4 w-4" />
          {selectedRange?.from ? (
            selectedRange.to ? (
              <>
                {format(selectedRange.from, "PPP", { locale })} -{" "}
                {format(selectedRange.to, "PPP", { locale })}
              </>
            ) : (
              format(selectedRange.from, "PPP", { locale })
            )
          ) : (
            <span>اختر نطاق تاريخ</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={selectedRange as DateRange | undefined}
          onSelect={(range: DateRange | undefined) => {
            if (range?.from && range?.to) {
              const validRange = {
                from: range.from,
                to: range.to
              };
              setSelectedRange(validRange);
              onSelect?.(validRange);
            }
          }}
          initialFocus
          locale={locale}
        />
      </PopoverContent>
    </Popover>
  )
}