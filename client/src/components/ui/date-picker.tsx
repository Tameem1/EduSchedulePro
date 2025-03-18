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

interface DatePickerProps {
  date?: Date
  selected?: Date
  onSelect?: (date: Date | undefined) => void
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
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    selected || date
  )

  // Update internal state when prop changes
  React.useEffect(() => {
    setSelectedDate(selected || date)
  }, [selected, date])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[240px] justify-start text-left font-normal",
            !selectedDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? (
            format(selectedDate, "PPP", { locale })
          ) : (
            <span>اختر تاريخاً</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            setSelectedDate(date)
            onSelect?.(date)
          }}
          initialFocus
          locale={locale}
        />
      </PopoverContent>
    </Popover>
  )
}
