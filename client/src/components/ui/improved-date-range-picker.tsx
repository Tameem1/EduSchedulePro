import React, { useState, useEffect } from "react";
import { format, subDays, addDays, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, subYears } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronDown, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { DateRange } from "react-day-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ImprovedDateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (startDate: Date, endDate: Date) => void;
  locale?: any;
  className?: string;
}

export function ImprovedDateRangePicker({
  startDate,
  endDate, 
  onChange,
  locale,
  className
}: ImprovedDateRangePickerProps) {
  const [dateRange, setDateRange] = useState<DateRange>({ 
    from: startDate, 
    to: endDate 
  });
  
  // Update internal state when props change
  useEffect(() => {
    setDateRange({ from: startDate, to: endDate });
  }, [startDate, endDate]);

  // Handle date changes
  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from) {
      const newRange = {
        from: range.from,
        to: range.to || range.from,
      };
      setDateRange(newRange);
      onChange(newRange.from, newRange.to);
    }
  };

  // Preset date ranges
  const today = new Date();
  const presetRanges = [
    {
      label: "اليوم",
      onSelect: () => {
        const range = { from: today, to: today };
        setDateRange(range);
        onChange(range.from, range.to);
      }
    },
    {
      label: "أمس",
      onSelect: () => {
        const yesterday = subDays(today, 1);
        const range = { from: yesterday, to: yesterday };
        setDateRange(range);
        onChange(range.from, range.to);
      }
    },
    {
      label: "آخر 7 أيام",
      onSelect: () => {
        const range = { from: subDays(today, 6), to: today };
        setDateRange(range);
        onChange(range.from, range.to);
      }
    },
    {
      label: "آخر 30 يوم",
      onSelect: () => {
        const range = { from: subDays(today, 29), to: today };
        setDateRange(range);
        onChange(range.from, range.to);
      }
    },
    {
      label: "هذا الشهر",
      onSelect: () => {
        const range = { from: startOfMonth(today), to: endOfMonth(today) };
        setDateRange(range);
        onChange(range.from, range.to);
      }
    },
    {
      label: "الشهر السابق",
      onSelect: () => {
        const lastMonth = subMonths(today, 1);
        const range = { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
        setDateRange(range);
        onChange(range.from, range.to);
      }
    },
    {
      label: "آخر 3 أشهر",
      onSelect: () => {
        const range = { from: startOfMonth(subMonths(today, 2)), to: endOfMonth(today) };
        setDateRange(range);
        onChange(range.from, range.to);
      }
    },
    {
      label: "العام الدراسي الحالي",
      onSelect: () => {
        const range = { from: startOfYear(today), to: endOfYear(today) };
        setDateRange(range);
        onChange(range.from, range.to);
      }
    },
    {
      label: "العام الدراسي السابق",
      onSelect: () => {
        const lastYear = subYears(today, 1);
        const range = { from: startOfYear(lastYear), to: endOfYear(lastYear) };
        setDateRange(range);
        onChange(range.from, range.to);
      }
    }
  ];

  // Quick adjustment buttons
  const adjustDateRange = (adjustment: 'start-back' | 'start-forward' | 'end-back' | 'end-forward', days: number) => {
    const newRange = { ...dateRange };
    
    if (adjustment === 'start-back' && newRange.from) {
      newRange.from = subDays(newRange.from, days);
    } else if (adjustment === 'start-forward' && newRange.from && newRange.to) {
      // Don't allow start date to go beyond end date
      const newStart = addDays(newRange.from, days);
      if (newStart <= newRange.to) {
        newRange.from = newStart;
      }
    } else if (adjustment === 'end-back' && newRange.from && newRange.to) {
      // Don't allow end date to go before start date
      const newEnd = subDays(newRange.to, days);
      if (newEnd >= newRange.from) {
        newRange.to = newEnd;
      }
    } else if (adjustment === 'end-forward' && newRange.to) {
      newRange.to = addDays(newRange.to, days);
    }

    setDateRange(newRange);
    if (newRange.from && newRange.to) {
      onChange(newRange.from, newRange.to);
    }
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return format(date, "yyyy/MM/dd", { locale });
  };

  return (
    <div className={cn("", className)}>
      {/* Calendar picker for both dates */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start"
          >
            <CalendarIcon className="ml-2 h-4 w-4" />
            {dateRange.from ? (
              dateRange.to ? (
                <>
                  {formatDate(dateRange.from)} - {formatDate(dateRange.to)}
                </>
              ) : (
                formatDate(dateRange.from)
              )
            ) : (
              "اختر التاريخ..."
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange.from}
            selected={dateRange}
            onSelect={handleDateRangeChange}
            numberOfMonths={2}
            locale={locale}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}