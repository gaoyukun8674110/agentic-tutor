import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataWall, KpiCell, WallPanel } from './DataWall';

describe('DataWall', () => {
  it('renders the title and the subtitle without a live clock', () => {
    render(
      <DataWall title="Data overview" subtitle="Today">
        <span>child-slot</span>
      </DataWall>,
    );

    expect(screen.getByText('Data overview')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.queryByTestId('wall-clock')).toBeNull();
    expect(screen.getByText('child-slot')).toBeInTheDocument();
  });

  it('omits the subtitle row when none is given', () => {
    render(
      <DataWall title="only-title">
        <span>child-slot</span>
      </DataWall>,
    );

    expect(screen.getByText('only-title')).toBeInTheDocument();
    expect(screen.queryByText('Today')).toBeNull();
  });

  it('renders header actions when provided', () => {
    render(
      <DataWall title="with-action" actions={<button data-testid="wall-cta">x</button>}>
        <span>child-slot</span>
      </DataWall>,
    );

    const wall = screen.getByTestId('data-wall');
    expect(screen.getByTestId('wall-cta')).toBeInTheDocument();
    expect(wall).toContainElement(screen.getByTestId('wall-cta'));
  });
});

describe('WallPanel', () => {
  it('renders the panel title and its children inside the wall grid', () => {
    render(
      <WallPanel title="Pomodoro" span={2}>
        <span>panel-body</span>
      </WallPanel>,
    );

    expect(screen.getByTestId('wall-panel-title')).toHaveTextContent('Pomodoro');
    expect(screen.getByText('panel-body')).toBeInTheDocument();
    expect(screen.getByTestId('wall-panel').className).toContain('lg:col-span-2');
  });

  it('emits a statically scannable span class for every span value', () => {
    const { unmount } = render(
      <WallPanel title="span-one" span={1}>
        <span>a</span>
      </WallPanel>,
    );
    expect(screen.getByTestId('wall-panel').className).toContain('lg:col-span-1');
    unmount();

    render(
      <WallPanel title="span-three" span={3}>
        <span>b</span>
      </WallPanel>,
    );
    expect(screen.getByTestId('wall-panel').className).toContain('lg:col-span-3');
  });
});

describe('KpiCell', () => {
  it('renders the label and the numeric value', () => {
    render(<KpiCell label="Today" value="2.5 h" hint="+0.5" />);

    expect(screen.getByTestId('kpi-value')).toHaveTextContent('2.5 h');
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('+0.5')).toBeInTheDocument();
  });
});
