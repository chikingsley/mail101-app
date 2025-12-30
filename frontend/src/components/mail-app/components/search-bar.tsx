import * as Popover from "@radix-ui/react-popover";
import { Filter, Search, X } from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";

interface SearchFilters {
  query: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachments?: boolean;
  startDate?: string;
  endDate?: string;
}

interface SearchBarProps {
  onSearch: (filters: SearchFilters) => void;
  onClear?: () => void;
  isLoading?: boolean;
}

export function SearchBar({
  onSearch,
  onClear,
  isLoading = false,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({ query: "" });
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const searchFilters: SearchFilters = {
        query,
        ...filters,
      };
      onSearch(searchFilters);
    },
    [query, filters, onSearch]
  );

  const handleFilterChange = (key: keyof SearchFilters, value: unknown) => {
    const newFilters = { ...filters, [key]: value };

    // Check if there are active filters besides the query
    const activeFilters = Object.entries(newFilters).filter(
      ([k, v]) =>
        k !== "query" &&
        v !== "" &&
        v !== false &&
        v !== null &&
        v !== undefined
    );

    setHasActiveFilters(activeFilters.length > 0);
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setQuery("");
    setFilters({ query: "" });
    setHasActiveFilters(false);
    onClear?.();
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setFilters({ ...filters, query: value });
  };

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <form className="flex gap-2" onSubmit={handleSearch}>
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-10 pl-10 text-gray-900 placeholder-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search emails..."
            type="text"
            value={query}
          />
          {query && (
            <button
              className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => handleQueryChange("")}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Button */}
        <Popover.Root onOpenChange={setShowFilters} open={showFilters}>
          <Popover.Trigger asChild>
            <button
              className={`rounded-lg px-3 py-2 transition-colors ${
                hasActiveFilters
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              }`}
              type="button"
            >
              <Filter className="h-4 w-4" />
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              align="end"
              className="w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Search Filters
                </h3>

                {/* From Filter */}
                <div>
                  <label className="block font-medium text-gray-700 text-sm dark:text-gray-300">
                    From
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    onChange={(e) => handleFilterChange("from", e.target.value)}
                    placeholder="sender@example.com"
                    type="email"
                    value={filters.from || ""}
                  />
                </div>

                {/* To Filter */}
                <div>
                  <label className="block font-medium text-gray-700 text-sm dark:text-gray-300">
                    To
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    onChange={(e) => handleFilterChange("to", e.target.value)}
                    placeholder="recipient@example.com"
                    type="email"
                    value={filters.to || ""}
                  />
                </div>

                {/* Subject Filter */}
                <div>
                  <label className="block font-medium text-gray-700 text-sm dark:text-gray-300">
                    Subject
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    onChange={(e) =>
                      handleFilterChange("subject", e.target.value)
                    }
                    placeholder="Search subject..."
                    type="text"
                    value={filters.subject || ""}
                  />
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-gray-700 text-sm dark:text-gray-300">
                      Start Date
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      onChange={(e) =>
                        handleFilterChange("startDate", e.target.value)
                      }
                      type="date"
                      value={filters.startDate || ""}
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700 text-sm dark:text-gray-300">
                      End Date
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      onChange={(e) =>
                        handleFilterChange("endDate", e.target.value)
                      }
                      type="date"
                      value={filters.endDate || ""}
                    />
                  </div>
                </div>

                {/* Has Attachments Filter */}
                <div className="flex items-center gap-2">
                  <input
                    checked={filters.hasAttachments}
                    className="h-4 w-4 rounded border-gray-300"
                    id="hasAttachments"
                    onChange={(e) =>
                      handleFilterChange("hasAttachments", e.target.checked)
                    }
                    type="checkbox"
                  />
                  <label
                    className="font-medium text-gray-700 text-sm dark:text-gray-300"
                    htmlFor="hasAttachments"
                  >
                    Only emails with attachments
                  </label>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    className="flex-1 rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    onClick={handleClearFilters}
                    type="button"
                  >
                    Clear
                  </button>
                  <button
                    className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
                    onClick={() => setShowFilters(false)}
                    type="button"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {/* Search Button */}
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.from && (
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-blue-900 text-xs dark:bg-blue-900 dark:text-blue-100">
              From: {filters.from}
              <button
                className="text-blue-600 hover:text-blue-800"
                onClick={() => handleFilterChange("from", "")}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.to && (
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-blue-900 text-xs dark:bg-blue-900 dark:text-blue-100">
              To: {filters.to}
              <button
                className="text-blue-600 hover:text-blue-800"
                onClick={() => handleFilterChange("to", "")}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.subject && (
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-blue-900 text-xs dark:bg-blue-900 dark:text-blue-100">
              Subject: {filters.subject}
              <button
                className="text-blue-600 hover:text-blue-800"
                onClick={() => handleFilterChange("subject", "")}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.hasAttachments && (
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-blue-900 text-xs dark:bg-blue-900 dark:text-blue-100">
              Has Attachments
              <button
                className="text-blue-600 hover:text-blue-800"
                onClick={() => handleFilterChange("hasAttachments", false)}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
