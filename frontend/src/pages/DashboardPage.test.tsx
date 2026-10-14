import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DashboardPage } from './DashboardPage';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'alice', email: null, created_at: 'now' } }),
}));

vi.mock('../utils/settings', () => ({
  useSettings: () => ({
    language: 'zh',
    theme: 'light',
    tokens: {
      textPrimary: '#111111',
      textSecondary: '#666666',
      textMuted: '#999999',
      accentPrimary: '#4f46e5',
      surface: '#ffffff',
      borderStrong: '#dddddd',
      shadowSoft: 'none',
      pageGradient: '#ffffff',
      overlayGradient: '#ffffff',
    },
    textStyle: {},
    t: (zh: string, en: string) => zh ?? en,
  }),
}));

vi.mock('../utils/glassStyles', () => ({
  cardSurfaceStyle: () => ({}),
  primaryActionStyle: () => ({}),
}));

vi.mock('../utils/dashboardApi', () => ({
  fetchDashboardSummary: vi.fn().mockResolvedValue({
    user_id: 'alice',
    today: {
      date: '2026-10-10',
      focus_minutes: 150,
      completed_pomodoros: 5,
      completed_tasks: 2,
      total_tasks: 4,
    },
    streak_days: 3,
    tasks: [],
    weekly_data: [
      { date: '2026-10-05', day: 'mon', hours: 1.5, tasks: 1 },
      { date: '2026-10-06', day: 'tue', hours: 2.5, tasks: 2 },
    ],
    calendar_events: [],
  }),
}));

vi.mock('../utils/studentApi', () => ({
  fetchMastery: vi.fn().mockResolvedValue({
    user_id: 'alice',
    masteries: [
      { skill_id: 'a', skill_name: 'A', mastery_score: 0.9 },
      { skill_id: 'b', skill_name: 'B', mastery_score: 0.4 },
    ],
  }),
}));

vi.mock('../components/PomodoroTimer', () => ({
  PomodoroTimer: () => <div>pomodoro-timer</div>,
}));
vi.mock('../components/StudyStats', () => ({
  StudyStats: () => <div>study-stats</div>,
}));
vi.mock('../components/TodayPlan', () => ({ TodayPlan: () => <div>today-plan</div> }));
vi.mock('../components/TodayPlanSkills', () => ({
  TodayPlanSkills: () => <div>today-plan-skills</div>,
}));
vi.mock('../components/TopNavbar', () => ({ TopNavbar: () => <div>top-navbar</div> }));
vi.mock('../components/SkyBackground', () => ({ SkyBackground: () => <div>sky-bg</div> }));

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage data wall', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the data wall shell with the title and subtitle', async () => {
    renderDashboard();

    expect(await screen.findByTestId('data-wall')).toBeInTheDocument();
    expect(screen.getByText('砚思 · 数据总览')).toBeInTheDocument();
    expect(screen.queryByTestId('wall-clock')).toBeNull();
  });

  it('renders all six KPI cells with values derived from the summary', async () => {
    renderDashboard();

    const cells = await screen.findAllByTestId('kpi-cell');
    expect(cells).toHaveLength(6);

    await waitFor(() => {
      const values = screen.getAllByTestId('kpi-value').map((node) => node.textContent);
      expect(values).toEqual(['2.5 小时', '2 / 4', '5', '3 天', '1 / 2', '4.0 小时']);
    });
  });

  it('keeps every existing learning tool mounted inside wall panels', async () => {
    renderDashboard();

    expect(await screen.findByText('pomodoro-timer')).toBeInTheDocument();
    expect(screen.getByText('today-plan-skills')).toBeInTheDocument();
    expect(screen.getByText('today-plan')).toBeInTheDocument();
    expect(screen.getByText('study-stats')).toBeInTheDocument();
    expect(screen.getByText('top-navbar')).toBeInTheDocument();
    expect(screen.getByText('sky-bg')).toBeInTheDocument();

    expect(screen.getAllByTestId('wall-panel')).toHaveLength(3);
    expect(screen.queryByText('study-calendar')).toBeNull();
  });

  it('renders the dashboard CTA inside the data wall header', async () => {
    renderDashboard();

    const wall = await screen.findByTestId('data-wall');
    const cta = screen.getByTestId('dashboard-cta');
    expect(cta).toBeEnabled();
    expect(cta).toHaveTextContent('进入今日学习');
    expect(wall).toContainElement(cta);
  });

  it('keeps the cinnabar seal badge intact', async () => {
    renderDashboard();

    await screen.findByTestId('data-wall');
    const seal = screen.getByText('诊断');
    expect(seal).toBeInTheDocument();
    expect(screen.getByText('已落')).toBeInTheDocument();
  });
});
