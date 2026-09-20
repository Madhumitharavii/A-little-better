interface LifeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function LifeSearchBar({ value, onChange }: LifeSearchBarProps) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sand-800/40 text-sm">🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search books, movies, artwork, experiences…"
        className="w-full pl-10 pr-4 py-3 bg-white border border-sand-200 rounded-2xl text-sm text-sand-900 focus:outline-none focus:border-sand-300 shadow-sm"
      />
    </div>
  );
}
