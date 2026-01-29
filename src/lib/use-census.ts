/**
 * Census API Hooks
 *
 * React hooks for fetching data from the census database.
 */

import { useCallback, useEffect, useState } from "react";
import type {
  CensusAccount,
  CensusAttachment,
  CensusEmail,
  CensusEstimate,
  CensusProject,
  ClassificationStats,
  EmailClassification,
  LinkSuggestion,
} from "./census-types";

// ============================================
// Generic Fetch Hook
// ============================================

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useFetch<T>(url: string | null): FetchState<T> & { refetch: () => void } {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: !!url,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (!url) {
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      setState({ data: json, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}

// ============================================
// Emails
// ============================================

interface EmailsResponse {
  emails: CensusEmail[];
  total: number;
}

export function useEmails(limit = 50) {
  return useFetch<EmailsResponse>(`/api/emails?limit=${limit}`);
}

interface EmailDetailResponse {
  email: CensusEmail;
  attachments: CensusAttachment[];
}

export function useEmail(id: number | null) {
  return useFetch<EmailDetailResponse>(id ? `/api/emails/${id}` : null);
}

interface SearchResponse {
  results: Array<CensusEmail & { matchSource: "subject" | "body" | "attachment" }>;
}

export function useEmailSearch(query: string, limit = 50) {
  const url = query ? `/api/emails/search?q=${encodeURIComponent(query)}&limit=${limit}` : null;
  return useFetch<SearchResponse>(url);
}

// ============================================
// Accounts
// ============================================

interface AccountsResponse {
  accounts: CensusAccount[];
}

export function useAccounts() {
  return useFetch<AccountsResponse>("/api/accounts");
}

interface AccountDetailResponse {
  account: CensusAccount;
  projects: CensusProject[];
  emails: CensusEmail[];
}

export function useAccount(domain: string | null) {
  return useFetch<AccountDetailResponse>(domain ? `/api/accounts/${domain}` : null);
}

// ============================================
// Projects
// ============================================

interface ProjectsResponse {
  projects: CensusProject[];
}

export function useProjects() {
  return useFetch<ProjectsResponse>("/api/projects");
}

interface ProjectDetailResponse {
  project: CensusProject;
  emails: CensusEmail[];
}

export function useProject(id: number | null) {
  return useFetch<ProjectDetailResponse>(id ? `/api/projects/${id}` : null);
}

// ============================================
// Estimates
// ============================================

interface EstimatesResponse {
  estimates: CensusEstimate[];
}

export function useEstimates() {
  return useFetch<EstimatesResponse>("/api/estimates");
}

// ============================================
// Stats
// ============================================

interface StatsResponse {
  totalEmails: number;
  totalAccounts: number;
  totalProjects: number;
  totalEstimates: number;
  classifications: ClassificationStats[];
}

export function useStats() {
  return useFetch<StatsResponse>("/api/stats");
}

// ============================================
// Smart Linking
// ============================================

interface LinkSuggestionsResponse {
  suggestions: LinkSuggestion[];
}

export function useLinkSuggestions(emailId: number | null) {
  return useFetch<LinkSuggestionsResponse>(
    emailId ? `/api/linking/suggest/${emailId}` : null
  );
}

// ============================================
// Actions (mutations)
// ============================================

export function useLinkEmail() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkEmail = useCallback(async (emailId: number, projectId: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/emails/${emailId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setLoading(false);
      return data.email as CensusEmail;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
      return null;
    }
  }, []);

  return { linkEmail, loading, error };
}

export function useClassifyEmail() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classifyEmail = useCallback(
    async (emailId: number, classification: EmailClassification) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/emails/${emailId}/classify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classification }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setLoading(false);
        return data.email as CensusEmail;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
        return null;
      }
    },
    []
  );

  return { classifyEmail, loading, error };
}

// ============================================
// Combined Context Hook
// ============================================

/**
 * Get full context for a selected email.
 * Returns project, account, estimates, and email history.
 */
export function useEmailContext(email: CensusEmail | null) {
  // Get project if linked
  const { data: projectData } = useProject(email?.projectId ?? null);
  
  // Get account if available
  const accountDomain = email?.fromEmail?.split("@")[1] ?? null;
  const { data: accountData } = useAccount(accountDomain);
  
  // Get link suggestions
  const { data: suggestionsData } = useLinkSuggestions(email?.id ?? null);

  return {
    project: projectData?.project ?? null,
    projectEmails: projectData?.emails ?? [],
    account: accountData?.account ?? null,
    accountProjects: accountData?.projects ?? [],
    linkSuggestions: suggestionsData?.suggestions ?? [],
  };
}
