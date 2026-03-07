const JWT_STORAGE_KEY = "jwt_token";

function getToken(): string {
  return localStorage.getItem(JWT_STORAGE_KEY) || "";
}

async function fetchJson<T>(
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new ApiError(res.status, await res.text().catch(() => res.statusText));
  }

  if (res.status === 204 || res.status === 201 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// --- Types ---

export type Paper = {
  id: number;
  conference_name: string;
  year: number;
  title: string;
  url: string | null;
  authors: string | null;
  abstract_text: string | null;
};

export type Conference = {
  name: string;
  year: number;
};

export type User = {
  user_id: number;
  username: string;
};

export type AuthToken = {
  token: string;
  token_type: string;
};

export type StatsResponse = {
  daily: { date: string; count: number }[];
  summary: { today: number; week: number; total: number };
};

export type ReadPaper = {
  id: number;
  conference_name: string;
  year: number;
  title: string;
  url: string | null;
  authors: string | null;
  abstract_text: string | null;
  read_at: string;
  liked_at: string | null;
};

// --- API Functions ---

export const api = {
  // Auth
  register(username: string, password: string) {
    return fetchJson<User>("POST", "/api/auth/register", { username, password });
  },
  login(username: string, password: string) {
    return fetchJson<AuthToken>("POST", "/api/auth/login", { username, password });
  },
  getMe() {
    return fetchJson<User>("GET", "/api/auth/me");
  },
  logout() {
    return fetchJson<void>("POST", "/api/auth/logout");
  },

  // Papers
  getConferences() {
    return fetchJson<Conference[]>("GET", "/api/papers/conferences");
  },
  getNextPaper(params?: { conference?: string; year?: string }) {
    return fetchJson<Paper>("GET", "/api/papers/next", undefined, params);
  },
  getLikedPapers() {
    return fetchJson<Paper[]>("GET", "/api/papers/liked");
  },
  likePaper(paperId: number) {
    return fetchJson<void>("POST", `/api/papers/${paperId}/like`);
  },
  unlikePaper(paperId: number) {
    return fetchJson<void>("DELETE", `/api/papers/${paperId}/like`);
  },
  readPaper(paperId: number) {
    return fetchJson<void>("POST", `/api/papers/${paperId}/read`);
  },
  getStats() {
    return fetchJson<StatsResponse>("GET", "/api/papers/stats");
  },
  getReadPapers() {
    return fetchJson<ReadPaper[]>("GET", "/api/papers/read");
  },
};
