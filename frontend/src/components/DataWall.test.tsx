import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataWall, KpiCell, WallPanel, formatWallClock } from './DataWall';
import { SettingsProvider } from '../utils/settings';

function renderWall(ui: React.ReactElement) {
  return render(ui, { wrapper: SettingsProvider });
}

describe('formatWallClock', () => {
  it('formats a zh clock with a padded date and Chinese weekday', () => {
    const date = new Date(2026, 9, 10, 14, 3, 7);
    expect(formatWallClock(date, 'zh')).toBe('2026-10-10 14:03:07 周六');
  });

  it('formats an en clock with an English weekday', () => {
    const date = new Date(2026, 9, 10, 14, 3, 7);
    expect(formatWallClock(date, 'en')).toBe('2026-10-10 14:03:07 Sat');
  });
});

describe('DataWall', () => {
  it('renders the title, the subtitle and a live clock', () => {
    renderWall(
      <DataWall title="砚思 · 数据总览" subtitle="总览">
        <span>child-slot</span>
      </DataWall>,
    );
    expect(screen.getByText('砚思 · 数据总览')).toBeInTheDocument();
    expect(screen.getByText('总览')).toBeInTheDocument();
    expect(screen.getByTestId('wall-clock')).toBeInTheDocument();
    expect(screen.getByText('child-slot')).toBeInTheDocument();
  });

  it('omits the subtitle row when none is given', () => {
    renderWall(
      <DataWall title="only-title">
        <span>child-slot</span>
      </DataWall>,
    );
    expect(screen.getByText('only-title')).toBeInTheDocument();
    expect(screen.queryByText('总览')).toBeNull();
  });

  it('renders header actions under the wall clock when provided', () => {
    renderWall(
      <DataWall
        title="with-action"
        actions={<button data-testid="wall-cta">x</button>}
      >
        <span>child-slot</span>
      </DataWall>,
    );
    const wall = screen.getByTestId('data-wall');
    expect(screen.getByTestId('wall-clock')).toBeInTheDocument();
    expect(screen.getByTestId('wall-cta')).toBeInTheDocument();
    expect(wall).toContainElement(screen.getByTestId('wall-cta'));
  });
});

describe('WallPanel', () => {
  it('renders the panel title and its children inside the wall grid', () => {
    render(
      <WallPanel title="番茄钟" span={2}>
        <span>panel-body</span>
      </WallPanel>,
    );
    expect(screen.getByTestId('wall-panel-title')).toHaveTextContent('番茄钟');
    expect(screen.getByText('panel-body')).toBeInTheDocument();
    expect(screen.getByTestId('wall-panel').className).toContain('lg:col-span-2');
  });

  it('emits a statically scannable span class for every span value', () => {
    const { unmount } = renderWall(
      <WallPanel title="span-one" span={1}>
        <span>a</span>
      </WallPanel>,
    );
    expect(screen.getByTestId('wall-panel').className).toContain('lg:col-span-1');
    unmount();

    renderWall(
      <WallPanel title="span-three" span={3}>
        <span>b</span>
      </WallPanel>,
    );
    expect(screen.getByTestId('wall-panel').className).toContain('lg:col-span-3');
  });
});

describe('KpiCell', () => {
  it('renders the label and the numeric value', () => {
    render(<KpiCell label="今日时长" value="2.5 h" hint="较昨日 +0.5" />);
    expect(screen.getByTestId('kpi-value')).toHaveTextContent('2.5 h');
    expect(screen.getByText('今日时长')).toBeInTheDocument();
    expect(screen.getByText('较昨日 +0.5')).toBeInTheDocument();
  });
});
