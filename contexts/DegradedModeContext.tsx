import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { DegradedModeEvent } from '../services/DegradedModeService';
import { eventBus, EVENTS } from '../utils/EventBus';

type DegradedModeState = {
  events: DegradedModeEvent[];
  latestByFeature: Record<string, DegradedModeEvent>;
  clear: (feature?: string) => void;
};

const DegradedModeContext = createContext<DegradedModeState | null>(null);

export const DegradedModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<DegradedModeEvent[]>([]);

  useEffect(() => {
    const sub = eventBus.on<any>(EVENTS.APP_DEGRADED, (payload) => {
      if (!payload) return;
      if (payload.error === null) {
        const feature = payload.feature;
        setEvents((prev) => (feature && feature !== '*' ? prev.filter((e) => e.feature !== feature) : []));
        return;
      }
      setEvents((prev) => [payload as DegradedModeEvent, ...prev].slice(0, 20));
    });
    return () => sub.unsubscribe();
  }, []);

  const latestByFeature = useMemo(() => {
    const map: Record<string, DegradedModeEvent> = {};
    for (const ev of events) {
      if (!map[ev.feature]) map[ev.feature] = ev;
    }
    return map;
  }, [events]);

  const value = useMemo<DegradedModeState>(() => {
    return {
      events,
      latestByFeature,
      clear: (feature?: string) => {
        if (!feature) setEvents([]);
        else setEvents((prev) => prev.filter((e) => e.feature !== feature));
      }
    };
  }, [events, latestByFeature]);

  return <DegradedModeContext.Provider value={value}>{children}</DegradedModeContext.Provider>;
};

export function useDegradedMode() {
  const ctx = useContext(DegradedModeContext);
  if (!ctx) throw new Error('useDegradedMode must be used within DegradedModeProvider');
  return ctx;
}

