import * as React from "react"
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, subYears } from "date-fns"
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

  // Preset date ranges
  const today = new Date()
  
  const presetRanges = [
    {
      label: "هذا الشهر",
      range: {
        from: startOfMonth(today),
        to: endOfMonth(today)
      }
    },
    {
      label: "الشهر السابق",
      range: {
        from: startOfMonth(subMonths(today, 1)),
        to: endOfMonth(subMonths(today, 1))
      }
    },
    {
      label: "آخر 3 أشهر",
      range: {
        from: startOfMonth(subMonths(today, 2)),
        to: endOfMonth(today)
      }
    },
    {
      label: "السنة الدراسية الحالية",
      range: {
        from: startOfYear(today),
        to: endOfYear(today)
      }
    },
    {
      label: "السنة الدراسية السابقة",
      range: {
        from: startOfYear(subYears(today, 1)),
        to: endOfYear(subYears(today, 1))
      }
    }
  ]

  // Handle preset range selection
  const handlePresetSelect = (range: { from: Date; to: Date }) => {
    setSelectedRange(range)
    onSelect?.(range)
  }

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex space-x-2 rtl:space-x-reverse">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant={"outline"}
              className={cn(
                "flex-1 justify-start text-right font-normal",
                !selectedRange && "text-muted-foreground",
                className
              )}
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
            <div className="p-2 border-b">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span>اختر فترة زمنية</span>
                    <ChevronDown className="h-4 w-4 mr-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {presetRanges.map((preset, index) => (
                    <DropdownMenuItem 
                      key={index} 
                      onClick={() => handlePresetSelect(preset.range)}
                    >
                      {preset.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}