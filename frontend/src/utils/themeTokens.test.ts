import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsProvider, useSettings } from './settings';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf-8');
const darkIdx = css.indexOf("body[data-theme='dark']");
const rootBlock = css.slice(0, darkIdx);
const darkBlock = css.slice(darkIdx);

const BRAND_VARS = [
  '--ai-brand-tile: #002b42;',
  '--ai-brand-glyph: #e9f5ff;',
  '--ai-brand-ring: rgba(233, 245, 255, 0.5);',
  '--ai-brand-shadow: 0 6px 16px rgba(0, 43, 66, 0.28);',
  '--ai-wall-panel: rgba(255, 255, 255, 0.72);',
  '--ai-wall-border: rgba(22, 51, 77, 0.16);',
  '--ai-wall-glow: rgba(31, 110, 170, 0.18);',
  '--ai-wall-title: #002b42;',
  '--ai-wall-tick: #3f5a72;',
];

const DARK_VARS = [
  '--ai-brand-tile: #cfe4f7;',
  '--ai-brand-glyph: #002b42;',
  '--ai-brand-ring: rgba(0, 43, 66, 0.35);',
  '--ai-brand-shadow: 0 6px 16px rgba(2, 18, 31, 0.5);',
  '--ai-wall-panel: rgba(10, 39, 68, 0.72);',
  '--ai-wall-border: rgba(150, 190, 230, 0.22);',
  '--ai-wall-glow: rgba(127, 196, 255, 0.3);',
  '--ai-wall-title: #e8f1fb;',
  '--ai-wall-tick: #aac2d8;',
];

describe('theme tokens', () => {
  it('declares the five light-mode brand and wall variables', () => {
    for (const declaration of BRAND_VARS) {
      expect(rootBlock).toContain(declaration);
    }
  });

  it('declares the five dark-mode brand and wall variables', () => {
    for (const declaration of DARK_VARS) {
      expect(darkBlock).toContain(declaration);
    }
  });

  it('keeps the pre-existing seal colour in both blocks', () => {
    expect(rootBlock).toContain('--ai-seal: #9e4a3c;');
    expect(darkBlock).toContain('--ai-seal: #cd7a68;');
  });

  it('maps every new token to its css variable', () => {
    const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider });
    const tokens = result.current.tokens;
    expect(tokens.brandTile).toBe('var(--ai-brand-tile)');
    expect(tokens.brandGlyph).toBe('var(--ai-brand-glyph)');
    expect(tokens.brandRing).toBe('var(--ai-brand-ring)');
    expect(tokens.brandShadow).toBe('var(--ai-brand-shadow)');
    expect(tokens.wallPanel).toBe('var(--ai-wall-panel)');
    expect(tokens.wallBorder).toBe('var(--ai-wall-border)');
    expect(tokens.wallGlow).toBe('var(--ai-wall-glow)');
    expect(tokens.wallTitle).toBe('var(--ai-wall-title)');
    expect(tokens.wallTick).toBe('var(--ai-wall-tick)');
  });
});
