interface StarRatingProps {
  value: number | undefined;
  onChange?: (value: number | undefined) => void;
  size?: 'sm' | 'md';
}

/**
 * Tap a star to set the rating; tap the same star again to clear it.
 * Read-only when onChange is omitted — then it's plain text (not buttons),
 * so it can sit inside a clickable card without nesting buttons.
 */
export default function StarRating({ value = 0, onChange, size = 'md' }: StarRatingProps) {
  const textSize = size === 'sm' ? 'text-sm' : 'text-xl';
  const colour = (star: number) => (star <= value ? 'text-terracotta-400' : 'text-sand-300');

  if (!onChange) {
    return (
      <div className={`flex items-center gap-0.5 ${textSize}`} role="img" aria-label={`${value} of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={`leading-none ${colour(star)}`} aria-hidden="true">
            ★
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-0.5 ${textSize}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(value === star ? undefined : star)}
          className={`leading-none cursor-pointer ${colour(star)}`}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
