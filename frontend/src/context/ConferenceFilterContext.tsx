import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

const STORAGE_KEY = "conference_filter";

export type ConferenceFilter = {
  conference: string;
  year: string;
};

type ConferenceFilterContextType = {
  filter: ConferenceFilter | null;
  setFilter: (filter: ConferenceFilter | null) => void;
};

const ConferenceFilterContext = createContext<ConferenceFilterContextType | undefined>(undefined);

function loadFilter(): ConferenceFilter | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const [conference, year] = raw.split("|");
  if (!conference || !year) return null;
  return { conference, year };
}

function saveFilter(filter: ConferenceFilter | null) {
  if (filter) {
    localStorage.setItem(STORAGE_KEY, `${filter.conference}|${filter.year}`);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function ConferenceFilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<ConferenceFilter | null>(loadFilter);

  const setFilter = useCallback((f: ConferenceFilter | null) => {
    saveFilter(f);
    setFilterState(f);
  }, []);

  return (
    <ConferenceFilterContext.Provider value={{ filter, setFilter }}>
      {children}
    </ConferenceFilterContext.Provider>
  );
}

export function useConferenceFilter() {
  const context = useContext(ConferenceFilterContext);
  if (context === undefined) {
    throw new Error("useConferenceFilter must be used within a ConferenceFilterProvider");
  }
  return context;
}
