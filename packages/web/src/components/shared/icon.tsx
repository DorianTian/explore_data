'use client';

/**
 * Centralized icon system using Lucide-compatible SVG paths.
 * Each icon is a 24x24 viewBox with stroke-based rendering.
 */

const ICON_PATHS: Record<string, string[]> = {
  home: [
    'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    'M9 22V12h6v10',
  ],
  message: [
    'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  ],
  database: [
    'M21 5c0 1.66-4.03 3-9 3S3 6.66 3 5s4.03-3 9-3 9 1.34 9 3',
    'M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5',
    'M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3',
  ],
  chart: ['M18 20V10', 'M12 20V4', 'M6 20v-6'],
  book: [
    'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronRight: ['M9 18l6-6-6-6'],
  chevronLeft: ['M15 18l-6-6 6-6'],
  copy: [
    'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z',
    'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  ],
  check: ['M20 6L9 17l-5-5'],
  thumbUp: [
    'M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z',
    'M4 22h0a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h0',
  ],
  thumbDown: [
    'M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z',
    'M20 2h0a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h0',
  ],
  send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4z'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  search: [
    'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
  ],
  star: [
    'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  ],
  panelRight: ['M3 3h18v18H3z', 'M15 3v18'],
  panelRightClose: ['M3 3h18v18H3z', 'M15 3v18', 'M10 15l-3-3 3-3'],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  play: ['M5 3l14 9-14 9V3z'],
  save: [
    'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z',
    'M17 21v-8H7v8',
    'M7 3v5h8',
  ],
  table: [
    'M3 3h18v18H3z',
    'M3 9h18',
    'M3 15h18',
    'M9 3v18',
    'M15 3v18',
  ],
  layout: ['M3 3h18v18H3z', 'M3 9h18', 'M9 9v12'],
  clock: [
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
    'M12 6v6l4 2',
  ],
  download: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M7 10l5 5 5-5',
    'M12 15V3',
  ],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54L22 3z'],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  ],
  heart: [
    'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  ],
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  ],
  ellipsis: [
    'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    'M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    'M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  ],
  link: [
    'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
    'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  ],
  key: [
    'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
  ],
  columns: [
    'M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18',
  ],
  eye: [
    'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z',
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  ],
  grid: ['M3 3h18v18H3z', 'M3 9h18', 'M3 15h18', 'M9 3v18', 'M15 3v18'],
};

/** Filled icons render with fill instead of stroke */
const FILLED_ICONS = new Set(['star']);

export type IconName = keyof typeof ICON_PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  filled?: boolean;
}

export function Icon({
  name,
  size = 16,
  className = '',
  strokeWidth = 2,
  filled = false,
}: IconProps) {
  const paths = ICON_PATHS[name];
  if (!paths) return null;

  const useFill = filled || FILLED_ICONS.has(name);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={useFill && filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
