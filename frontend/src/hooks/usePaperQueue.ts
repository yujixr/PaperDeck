import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, type Paper } from "../api";
import type { ConferenceFilter } from "../context/ConferenceFilterContext";
import { PAPER_QUEUE_CACHE_KEY } from "../lib/storageKeys";

type State =
  | { status: "loading" }
  | { status: "ready"; paper: Paper }
  | { status: "done" }
  | { status: "error"; error: Error };

function toParams(f: ConferenceFilter | null, excludeIds: number[]) {
  if (!f && excludeIds.length === 0) return undefined;
  return {
    ...(f && { conference: f.conference, year: f.year }),
    ...(excludeIds.length > 0 && { exclude_ids: excludeIds }),
  };
}

function matchesFilter(paper: Paper, f: ConferenceFilter | null): boolean {
  if (f === null) return true;
  return paper.conference_name === f.conference && String(paper.year) === f.year;
}

async function fetchPaper(f: ConferenceFilter | null, excludeIds: number[]): Promise<Paper | null> {
  try {
    return await api.getNextPaper(toParams(f, excludeIds));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

function loadInitialState(): State {
  try {
    const raw = localStorage.getItem(PAPER_QUEUE_CACHE_KEY);
    if (!raw) return { status: "loading" };
    const parsed = JSON.parse(raw);
    if (parsed.current) return { status: "ready", paper: parsed.current };
    if (parsed.allDone === true) return { status: "done" };
    return { status: "loading" };
  } catch {
    return { status: "loading" };
  }
}

function persistState(state: State) {
  if (state.status === "ready") {
    localStorage.setItem(
      PAPER_QUEUE_CACHE_KEY,
      JSON.stringify({ current: state.paper, allDone: false }),
    );
  } else if (state.status === "done") {
    localStorage.setItem(PAPER_QUEUE_CACHE_KEY, JSON.stringify({ current: null, allDone: true }));
  }
  // loading/error: keep existing cache so a reload mid-fetch still shows the previous paper.
}

export function usePaperQueue(filter: ConferenceFilter | null) {
  const [state, setState] = useState<State>(loadInitialState);

  const genRef = useRef(0);
  const filterRef = useRef(filter);
  const stateRef = useRef(state);
  filterRef.current = filter;
  stateRef.current = state;

  const startFetch = useCallback(async (f: ConferenceFilter | null, excludeIds: number[]) => {
    const gen = ++genRef.current;
    setState({ status: "loading" });
    try {
      const paper = await fetchPaper(f, excludeIds);
      if (genRef.current !== gen) return;
      const next: State = paper === null ? { status: "done" } : { status: "ready", paper };
      setState(next);
      persistState(next);
    } catch (e) {
      if (genRef.current !== gen) return;
      setState({ status: "error", error: e instanceof Error ? e : new Error(String(e)) });
    }
  }, []);

  // Re-runs only on filter change. Reads state via ref so the loading transition
  // inside `startFetch` does NOT re-trigger this effect.
  useEffect(() => {
    const s = stateRef.current;
    if (s.status === "ready" && matchesFilter(s.paper, filter)) return;
    startFetch(filter, []);
  }, [filter, startFetch]);

  const advance = useCallback(
    (dismissedId: number) => startFetch(filterRef.current, [dismissedId]),
    [startFetch],
  );

  return {
    paper: state.status === "ready" ? state.paper : null,
    isLoading: state.status === "loading",
    allDone: state.status === "done",
    error: state.status === "error" ? state.error : null,
    advance,
  };
}
