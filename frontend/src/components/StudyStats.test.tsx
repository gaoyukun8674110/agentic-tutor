import { render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { StudyStats } from './StudyStats';
import { SettingsProvider } from '../utils/settings';

const originalResizeObserver = global.ResizeObserver;

beforeAll(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

afterAll(() => {
  global.ResizeObserver = originalResizeObserver;
});

function renderStats(ui: React.ReactElement) {
  return render(ui, { wrapper: SettingsProvider });
}

describe('StudyStats', () => {
  it('renders the four summary labels and values', () => {
    renderStats(
      <StudyStats
        completedPomodoros={3}
        completedTasks={2}
        totalTasks={5}
        weeklyData={[
          { date: '2026-10-05', day: 'mon', hours: 1.5, tasks: 1 },
          { date: '2026-10-06', day: 'tue', hours: 2.5, tasks: 1 },
        ]}
      />,
    );

    expect(screen.getByText('本周总时长')).toBeInTheDocument();
    expect(screen.getByText('日均学习')).toBeInTheDocument();
    expect(screen.getByText('完成任务')).toBeInTheDocument();
    expect(screen.getByText('番茄轮次')).toBeInTheDocument();
    expect(screen.getByText('4.0h')).toBeInTheDocument();
    expect(screen.getByText('2.0h')).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders both chart titles', () => {
    renderStats(<StudyStats />);

    expect(screen.getByText('本周学习时长趋势')).toBeInTheDocument();
    expect(screen.getByText('每日任务完成数')).toBeInTheDocument();
  });

  it('shows an empty-state line when the whole week is zero', () => {
    renderStats(
      <StudyStats
        weeklyData={[
          { date: '2026-10-05', day: 'mon', hours: 0, tasks: 0 },
          { date: '2026-10-06', day: 'tue', hours: 0, tasks: 0 },
        ]}
      />,
    );

    expect(screen.getByText('本周还没有学习记录，开始一个番茄钟即可生成趋势。')).toBeInTheDocument();
  });
});
