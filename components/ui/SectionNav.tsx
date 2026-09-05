export function SectionNav({
  items,
  label = "On this page",
}: {
  items: Array<{ id: string; label: string }>;
  label?: string;
}) {
  if (items.length === 0) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-x-2 gap-y-1 border-y border-gold-dim py-1">
      <span className="mr-2 text-sm text-text-secondary">{label}</span>
      {items.map(item => (
        <a key={item.id} href={`#${item.id}`} className="inline-flex min-h-11 items-center rounded-sm px-3 text-sm font-semibold text-gold hover:bg-bg-hover hover:text-gold-light">
          {item.label}
        </a>
      ))}
    </nav>
  );
}
