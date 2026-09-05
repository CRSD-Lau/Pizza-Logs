import { DIFFICULTY_FILTERS, type DifficultyFilterValue, type ReportSearchParams } from "@/lib/difficulty-filter";

export function DifficultyFilter({ action, id, difficulty, searchParams, bosses, boss = "" }: {
  action: string;
  id: string;
  difficulty: DifficultyFilterValue;
  searchParams: ReportSearchParams;
  bosses?: Array<{ slug: string; name: string }>;
  boss?: string;
}) {
  const replacedFields = bosses ? ["difficulty", "boss"] : ["difficulty"];
  return (
    <form action={action} method="get" className="flex flex-wrap items-end gap-3" aria-label="Comparison filters">
      {Object.entries(searchParams).filter(([key]) => !replacedFields.includes(key)).flatMap(([key, value]) => (
        (Array.isArray(value) ? value : value === undefined ? [] : [value]).map((item, index) => (
          <input key={`${key}-${index}`} type="hidden" name={key} value={item} />
        ))
      ))}
      {bosses && (
        <div className="grid min-w-0 flex-1 gap-1.5 sm:flex-none">
          <label htmlFor={`${id}-boss`} className="text-sm font-semibold text-text-secondary">Boss</label>
          <select id={`${id}-boss`} name="boss" defaultValue={boss} className="min-h-11 max-w-full rounded-sm border border-gold-dim bg-bg-card px-3 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-gold">
            <option value="">All bosses</option>
            {bosses.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
        </div>
      )}
      <div className="grid min-w-0 flex-1 gap-1.5 sm:flex-none">
        <label htmlFor={`${id}-difficulty`} className="text-sm font-semibold text-text-secondary">Difficulty</label>
        <select id={`${id}-difficulty`} name="difficulty" defaultValue={difficulty} className="min-h-11 max-w-full rounded-sm border border-gold-dim bg-bg-card px-3 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-gold">
          {DIFFICULTY_FILTERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-sm border border-gold px-4 text-sm font-semibold text-gold-light hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-gold">Apply filters</button>
    </form>
  );
}
