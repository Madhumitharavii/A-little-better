import type { ToolId } from './types';

interface ToolboxGridProps {
  openTool: (tool: ToolId) => void;
}

const TILES: Array<{ id: ToolId; icon: string; title: string; subtitle: string; hoverBorder: string; hoverBg: string }> = [
  { id: 'procrastination', icon: '🌱', title: 'Procrastination', subtitle: 'Start small', hoverBorder: 'hover:border-terracotta-400/40', hoverBg: 'hover:bg-terracotta-100/20' },
  { id: 'overthinking', icon: '🌊', title: 'Overthinking', subtitle: 'Fact vs prediction', hoverBorder: 'hover:border-sage-500/40', hoverBg: 'hover:bg-sage-100/30' },
  { id: 'temper', icon: '🕊️', title: 'Temper & Anger', subtitle: 'Pause before acting', hoverBorder: 'hover:border-amber-400/40', hoverBg: 'hover:bg-amber-50' },
  { id: 'selfDoubt', icon: '🧭', title: 'Self-Doubt', subtitle: 'Check evidence', hoverBorder: 'hover:border-slate-400/40', hoverBg: 'hover:bg-slate-100' },
  { id: 'appearance', icon: '🪞', title: 'Insecurity', subtitle: 'Beyond appearance', hoverBorder: 'hover:border-terracotta-300/40', hoverBg: 'hover:bg-terracotta-50' },
];

export default function ToolboxGrid({ openTool }: ToolboxGridProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-sand-800/60">When I Need a Reset</h3>
        <span className="text-xs text-sand-800/50">Self-reflection & clarity</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {TILES.map((tile, i) => (
          <button
            key={tile.id}
            onClick={() => openTool(tile.id)}
            className={`p-3 bg-white rounded-2xl border border-sand-200 ${tile.hoverBorder} ${tile.hoverBg} text-left transition-all group flex flex-col justify-between ${
              i === TILES.length - 1 ? 'col-span-2 sm:col-span-1' : ''
            }`}
          >
            <span className="text-lg group-hover:scale-105 transition-transform mb-1">{tile.icon}</span>
            <div>
              <p className="text-xs font-semibold text-sand-900">{tile.title}</p>
              <p className="text-[10px] text-sand-800/60">{tile.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
