import type { CSSProperties } from 'react';

import { useSettings } from '../utils/settings';

const BRAND_SERIF = "'Noto Serif SC', 'Songti SC', 'Georgia', serif";

const HERO_TILE = '#cfe4f7';
const HERO_GLYPH = '#002b42';
const HERO_RING = 'rgba(0, 43, 66, 0.35)';
const HERO_SHADOW = '0 6px 16px rgba(2, 18, 31, 0.5)';

interface BrandMarkProps {
  /** 边长 px，默认 44 */
  size?: number;
  /** 砚字字号 px，默认 Math.round(size * 0.55) */
  glyphSize?: number;
  /** true = 强制「浅牌」配色（用于底色恒为夜空蓝的 hero） */
  hero?: boolean;
  /** 附加到最外层 span 的类名 */
  className?: string;
}

export function BrandMark({ size, glyphSize, hero, className }: BrandMarkProps) {
  const { tokens } = useSettings();

  const tile = hero ? HERO_TILE : tokens.brandTile ?? 'var(--ai-brand-tile)';
  const glyph = hero ? HERO_GLYPH : tokens.brandGlyph ?? 'var(--ai-brand-glyph)';
  const ring = hero ? HERO_RING : tokens.brandRing ?? 'var(--ai-brand-ring)';
  const shadow = hero ? HERO_SHADOW : tokens.brandShadow ?? 'var(--ai-brand-shadow)';

  const side = size ?? 44;
  const glyphPx = glyphSize ?? Math.round(side * 0.55);

  return (
    <span
      data-testid="brand-mark"
      data-variant={hero ? 'hero' : 'theme'}
      data-tile={tile}
      className={`relative flex items-center justify-center ${side >= 44 ? 'rounded-xl' : 'rounded-[10px]'}${className ? ` ${className}` : ''}`}
      style={
        {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          width: side,
          height: side,
          background: tile,
          color: glyph,
          fontFamily: BRAND_SERIF,
          fontWeight: 700,
          fontSize: glyphPx,
          boxShadow: shadow,
        } as CSSProperties
      }
    >
      <span
        className="pointer-events-none absolute rounded-md"
        style={{ inset: 4, border: `1px solid ${ring}` }}
      />
      砚
    </span>
  );
}
