/**
 * Per-event accent color helpers.
 * Schema column: events.brand_primary (single hex).
 * Falls back to ink (--text) when an event has no brand color set.
 */

const FALLBACK = '#1F1F1D';

const sanitize = (hex: string | null | undefined): string => {
  if (!hex) return FALLBACK;
  const v = hex.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(v)) return v.startsWith('#') ? v : `#${v}`;
  if (/^#?[0-9a-fA-F]{3}$/.test(v)) {
    const t = v.replace('#', '');
    return `#${t[0]}${t[0]}${t[1]}${t[1]}${t[2]}${t[2]}`;
  }
  return FALLBACK;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const v = hex.replace('#', '');
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
};

const luminance = ([r, g, b]: [number, number, number]): number => {
  const norm = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * norm[0] + 0.7152 * norm[1] + 0.0722 * norm[2];
};

export interface AccentTokens {
  base: string;       // raw hex
  rgb: string;        // "r,g,b" for rgba use
  fg: string;         // contrasting ink ('white' | 'var(--text)')
  tint: string;       // soft fill (rgba 8%)
  border: string;     // border (rgba 24%)
  strip: string;      // gradient strip
}

export const accentTokens = (hex: string | null | undefined): AccentTokens => {
  const base = sanitize(hex);
  const rgb = hexToRgb(base).join(',');
  const fg = luminance(hexToRgb(base)) < 0.5 ? '#FFFFFF' : '#1F1F1D';
  return {
    base,
    rgb,
    fg,
    tint: `rgba(${rgb}, 0.08)`,
    border: `rgba(${rgb}, 0.24)`,
    strip: `linear-gradient(90deg, ${base} 0%, rgba(${rgb}, 0.55) 100%)`,
  };
};
