import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, type Paper } from "../api";
import type { ConferenceFilter } from "../context/ConferenceFilterContext";

const MAX_DEDUP_RETRIES = 3;

function toParams(f: ConferenceFilter | null) {
  return f ? { conference: f.conference, year: f.year } : undefined;
}

function matchesFilter(paper: Paper, f: ConferenceFilter | null): boolean {
  if (f === null) return true;
  return paper.conference_name === f.conference && String(paper.year) === f.year;
}

/** Fetch one random unread paper. Returns null when none remain (404). */
async function fetchPaper(f: ConferenceFilter | null): Promise<Paper | null> {
  try {
    return await api.getNextPaper(toParams(f));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Fetch a paper whose id differs from excludeId, retrying up to MAX_DEDUP_RETRIES times. */
async function fetchDedupedPaper(
  f: ConferenceFilter | null,
  excludeId: number,
): Promise<Paper | null> {
  for (let i = 0; i <= MAX_DEDUP_RETRIES; i++) {
    const paper = await fetchPaper(f);
    if (paper === null || paper.id !== excludeId) return paper;
  }
  return null;
}

export function usePaperQueue(filter: ConferenceFilter | null) {
  const [current, setCurrent] = useState<Paper | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [allDone, setAllDone] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const nextRef = useRef<Paper | null>(null);
  const genRef = useRef(0);
  const filterRef = useRef(filter);
  const currentRef = useRef(current);
  const allDoneRef = useRef(allDone);
  filterRef.current = filter;
  currentRef.current = current;
  allDoneRef.current = allDone;

  /** Fetch current + next papers. Stale calls (gen mismatch) are discarded. */
  const loadPair = useCallback(async (gen: number, f: ConferenceFilter | null) => {
    try {
      const first = await fetchPaper(f);
      if (genRef.current !== gen) return;

      if (first === null) {
        setAllDone(true);
        setIsLoading(false);
        return;
      }

      setCurrent(first);
      setIsLoading(false);

      const second = await fetchDedupedPaper(f, first.id);
      if (genRef.current !== gen) return;

      nextRef.current = second;
      if (second === null) setAllDone(true);
    } catch (e) {
      if (genRef.current !== gen) return;
      setError(e instanceof Error ? e : new Error(String(e)));
      setIsLoading(false);
    }
  }, []);

  // Load on mount + reload when filter changes (if buffered papers don't match)
  useEffect(() => {
    if (genRef.current > 0) {
      const cur = currentRef.current;
      const nxt = nextRef.current;
      if (
        (cur === null || matchesFilter(cur, filter)) &&
        (nxt === null || matchesFilter(nxt, filter))
      )
        return;
    }

    const gen = ++genRef.current;
    nextRef.current = null;
    setCurrent(null);
    setIsLoading(true);
    setAllDone(false);
    setError(null);
    loadPair(gen, filter);
  }, [filter, loadPair]);

  const advance = useCallback(() => {
    const next = nextRef.current;
    nextRef.current = null;

    // 1) Happy path: show prefetched paper, start background prefetch
    if (next !== null) {
      setCurrent(next);
      const gen = ++genRef.current;
      fetchDedupedPaper(filterRef.current, next.id)
        .then((paper) => {
          if (genRef.current !== gen) return;
          nextRef.current = paper;
          if (paper === null) setAllDone(true);
        })
        .catch(() => {});
      return;
    }

    // 2) No prefetch + all done: clear current to surface "all done" UI
    setCurrent(null);
    if (allDoneRef.current) return;

    // 3) No prefetch + not done: reload pair
    setIsLoading(true);
    const gen = ++genRef.current;
    loadPair(gen, filterRef.current);
  }, [loadPair]);

  return {
    paper: current,
    isLoading,
    allDone: allDone && current === null,
    error,
    advance,
  };
}
