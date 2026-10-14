import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsProvider } from '../utils/settings';

import { FullscreenHero } from './FullscreenHero';

function renderHero() {
  return render(<FullscreenHero />, { wrapper: SettingsProvider });
}

describe('FullscreenHero', () => {
  it('renders the adapted AI Tutor headline fragments', () => {
    renderHero();
    expect(screen.getByText('mistakes')).toBeInTheDocument();
    expect(screen.getByText('memory.')).toBeInTheDocument();
  });

  it('renders a background video element with the CloudFront source', () => {
    const { container } = renderHero();
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    const source = container.querySelector('video > source');
    expect(source?.getAttribute('src')).toContain('d8j0ntlcm91z4.cloudfront.net');
  });

  it('exposes CTAs but never labels one "Sign in"', () => {
    renderHero();
    expect(screen.getByRole('button', { name: 'Begin Journey' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start learning' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  });

  it('renders the inkstone brand mark in the hero variant', () => {
    renderHero();
    const mark = screen.getByTestId('brand-mark');
    expect(mark).toBeInTheDocument();
    expect(mark).toHaveAttribute('data-variant', 'hero');
    expect(mark).toHaveAttribute('data-tile', '#cfe4f7');
  });
});
