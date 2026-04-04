'use client';

interface FollowUpSuggestionsProps {
  suggestions: string[];
  onSelect: (query: string) => void;
}

export function FollowUpSuggestions({
  suggestions,
  onSelect,
}: FollowUpSuggestionsProps) {
  if (!suggestions.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          onClick={() => onSelect(suggestion)}
          className="px-3 py-1.5 text-xs rounded-[var(--radius-full)] border border-border text-muted hover:text-foreground hover:bg-surface hover:border-primary/30 transition-colors cursor-pointer"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
