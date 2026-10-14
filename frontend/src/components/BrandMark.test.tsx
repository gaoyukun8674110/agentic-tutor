import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BrandMark } from './BrandMark';
import { SettingsProvider } from '../utils/settings';

function renderMark(ui: React.ReactElement) {
  return render(ui, { wrapper: SettingsProvider });
}

describe('BrandMark', () => {
  it('renders the inkstone glyph with the default testid', () => {
    renderMark(<BrandMark />);
    const mark = screen.getByTestId('brand-mark');
    expect(mark).toBeInTheDocument();
    expect(mark).toHaveTextContent('砚');
  });

  it('uses the theme variant by default and reads the brand tile token', () => {
    renderMark(<BrandMark />);
    const mark = screen.getByTestId('brand-mark');
    expect(mark).toHaveAttribute('data-variant', 'theme');
    expect(mark).toHaveAttribute('data-tile', 'var(--ai-brand-tile)');
  });

  it('forces the light tile when hero is set', () => {
    renderMark(<BrandMark hero />);
    const mark = screen.getByTestId('brand-mark');
    expect(mark).toHaveAttribute('data-variant', 'hero');
    expect(mark).toHaveAttribute('data-tile', '#cfe4f7');
  });

  it('scales the glyph from the size prop', () => {
    renderMark(<BrandMark size={40} />);
    const mark = screen.getByTestId('brand-mark');
    expect(mark).toHaveStyle({ width: '40px', height: '40px', fontSize: '22px' });
  });
});
