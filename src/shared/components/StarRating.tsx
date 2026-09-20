interface StarRatingProps {
  value: number | undefined;
  onChange?: (value: number | undefined) => void;
  size?: 'sm' | 'md';
}

/** Tap a star to set the rating; tap the same star again to clear it. Read-only when onChange is omitted. */
export default function StarRating({ value = 0, onChange, size = 'md' }: StarRatingProps) {
  const textSize = size === 'sm' ? 'text-sm' : 'text-xl';
  const readOnly = !onChange;

  return (
    <div className={`flex items-center gap-0.5 ${textSize}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(value === star ? undefined : star)}
          className={`leading-none ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${
            star <= value ? 'text-terracotta-400' : 'text-sand-300'
          }`}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
