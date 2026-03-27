import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-2 sm:space-x-3 sm:space-y-0",
        month: "space-y-2",
        caption: "flex justify-center pt-0.5 relative items-center",
        caption_label: "text-xs font-medium text-foreground",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-6 w-6 bg-transparent p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50",
        ),
        nav_button_previous: "absolute left-0.5",
        nav_button_next: "absolute right-0.5",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-7 font-normal text-[0.65rem] uppercase",
        row: "flex w-full mt-1",
        cell: "h-7 w-7 text-center text-xs p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-primary/20 [&:has([aria-selected])]:bg-primary/20 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(buttonVariants({ variant: "ghost" }), "h-7 w-7 p-0 text-xs font-normal text-foreground aria-selected:opacity-100 hover:bg-muted/50"),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-primary/20 text-primary font-semibold",
        day_outside:
          "day-outside text-muted-foreground/50 aria-selected:bg-primary/10 aria-selected:text-muted-foreground aria-selected:opacity-50",
        day_disabled: "text-muted-foreground/30",
        day_range_middle: "aria-selected:bg-primary/20 aria-selected:text-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-3.5 w-3.5" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-3.5 w-3.5" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
