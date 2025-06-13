import { ExternalLink, Globe, Calendar, ArrowRight } from "lucide-react";

interface WebSearchResultProps {
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    date?: string;
    source?: string;
  }>;
}

export function WebSearchResult({ results }: WebSearchResultProps) {
  if (!results || results.length === 0) {
    return null;
  }

  const getDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return domain.replace("www.", "");
    } catch {
      return "web";
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-3.5 h-3.5 text-[var(--c3-primary)]" />
        <span className="text-xs font-medium text-[var(--c3-text-secondary)]">
          Web Results
        </span>
      </div>

      <div className="space-y-2">
        {results.slice(0, 3).map((result, index) => (
          <a
            key={index}
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 bg-[var(--c3-surface-primary)] border border-[var(--c3-border-subtle)] rounded-[var(--c3-radius-md)] hover:border-[var(--c3-primary)] transition-all hover:shadow-sm group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-medium text-[var(--c3-text-primary)] truncate group-hover:text-[var(--c3-primary)]">
                  {result.title}
                </h4>
                <p className="text-xs text-[var(--c3-text-tertiary)] truncate">
                  {getDomain(result.url)}
                  {result.date && (
                    <>
                      <span className="mx-1">•</span>
                      <Calendar className="inline w-3 h-3 mr-1" />
                      {result.date}
                    </>
                  )}
                </p>
                <p className="text-xs text-[var(--c3-text-secondary)] mt-1 line-clamp-2">
                  {result.snippet}
                </p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-[var(--c3-text-tertiary)] group-hover:text-[var(--c3-primary)] flex-shrink-0" />
            </div>
          </a>
        ))}
      </div>

      {results.length > 3 && (
        <button className="flex items-center gap-1 text-xs text-[var(--c3-primary)] hover:underline">
          View {results.length - 3} more results
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
