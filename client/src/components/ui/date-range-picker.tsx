import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "@/components/ui/date-picker.css";
import { Button } from "@/components/ui/button";
import { ChevronDown, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, subYears } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (startDate: Date, endDate: Date) => void;
  locale?: any;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate, 
  onChange,
  locale,
  className
}: DateRangePickerProps) {
  const [start, setStart] = useState<Date>(startDate);
  const [end, setEnd] = useState<Date>(endDate);

  useEffect(() => {
    setStart(startDate);
    setEnd(endDate);
  }, [startDate, endDate]);

  // Preset date ranges
  const today = new Date();
  const presetRanges = [
    {
      label: "هذا الشهر",
      range: {
        start: startOfMonth(today),
        end: endOfMonth(today)
      }
    },
    {
      label: "الشهر السابق",
      range: {
        start: startOfMonth(subMonths(today, 1)),
        end: endOfMonth(subMonths(today, 1))
      }
    },
    {
      label: "آخر 3 أشهر",
      range: {
        start: startOfMonth(subMonths(today, 2)),
        end: endOfMonth(today)
      }
    },
    {
      label: "السنة الدراسية الحالية",
      range: {
        start: startOfYear(today),
        end: endOfYear(today)
      }
    },
    {
      label: "السنة الدراسية السابقة",
      range: {
        start: startOfYear(subYears(today, 1)),
        end: endOfYear(subYears(today, 1))
      }
    }
  ];

  // Handle preset range selection
  const handlePresetSelect = (range: { start: Date; end: Date }) => {
    setStart(range.start);
    setEnd(range.end);
    onChange(range.start, range.end);
  };

  // Handle manual date changes
  const handleDateChange = (dates: [Date | null, Date | null]) => {
    const [newStart, newEnd] = dates;
    if (newStart) {
      setStart(newStart);
    }
    if (newEnd) {
      setEnd(newEnd);
    }
    if (newStart && newEnd) {
      onChange(newStart, newEnd);
    }
  };

  // Format the display of the selected range
  const formatDateRange = () => {
    if (!start || !end) return "اختر نطاق تاريخ";
    return `${format(start, "yyyy/MM/dd", { locale })} - ${format(end, "yyyy/MM/dd", { locale })}`;
  };

  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className={cn("w-full justify-between", className)}
          >
            <span>فترات زمنية مسبقة</span>
            <ChevronDown className="h-4 w-4 mr-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
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

      <div className={cn("w-full", className)}>
        <DatePicker
          selected={start}
          onChange={handleDateChange}
          startDate={start}
          endDate={end}
          selectsRange
          inline={false}
          locale={locale}
          customInput={
            <Button
              variant="outline"
              className="w-full justify-start text-right font-normal"
            >
              <CalendarIcon className="ml-2 h-4 w-4" />
              {formatDateRange()}
            </Button>
          }
          monthsShown={2}
          showMonthDropdown
          showYearDropdown
          dropdownMode="select"
          dateFormat="yyyy/MM/dd"
          popperPlacement="bottom-end"
          popperModifiers={[
            {
              name: "offset",
              options: {
                offset: [0, 8],
              },
            },
            {
              name: "preventOverflow",
              options: {
                boundary: "viewport",
                padding: 8,
              },
            },
          ]}
          calendarClassName="shadow-lg rounded-md border border-border"
        />
      </div>
    </div>
  );
}