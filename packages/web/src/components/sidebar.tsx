'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Chat', icon: '💬' },
  { href: '/schema', label: 'Schema', icon: '📋' },
  { href: '/metrics', label: 'Metrics', icon: '📊' },
  { href: '/knowledge', label: 'Knowledge', icon: '📚' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-zinc-200 bg-zinc-50 flex flex-col dark:bg-zinc-900 dark:border-zinc-800">
      <div className="px-4 py-5 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          NL2SQL
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">Query with natural language</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-zinc-200 text-zinc-900 font-medium dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
