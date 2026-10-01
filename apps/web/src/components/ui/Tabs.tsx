import Link from 'next/link';

export interface TabItem {
  href: string;
  label: string;
  active: boolean;
}

export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav aria-label={label} className="my-3 flex gap-1 rounded-card bg-surface-2 p-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.active ? 'page' : undefined}
          className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-chip text-sm font-semibold transition-colors ${
            item.active ? 'bg-primary-fill text-on-primary' : 'text-muted hover:text-fg'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
