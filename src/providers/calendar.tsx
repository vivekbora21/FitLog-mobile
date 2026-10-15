import React, { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { toDateKey } from '../lib/format';

interface CalendarContextValue {
  selectedDate: string;
  setSelectedDate: (dateKey: string) => void;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: PropsWithChildren) {
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const value = useMemo(() => ({ selectedDate, setSelectedDate }), [selectedDate]);

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) throw new Error('useCalendar must be used inside CalendarProvider');
  return context;
}
