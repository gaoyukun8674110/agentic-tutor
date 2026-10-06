import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TodayPlanSkills } from './TodayPlanSkills';
import { fetchTodayPlan } from '../utils/studentApi';

vi.mock('../utils/studentApi', () => ({ fetchTodayPlan: vi.fn() }));
vi.mock('../utils/glassStyles', () => ({ cardSurfaceStyle: () => ({}) }));
vi.mock('../utils/settings', () => ({
  useSettings: () => ({
    tokens: {
      textPrimary: '#111',
      textSecondary: '#666',
      textMuted: '#999',
      textInverted: '#fff',
      accentPrimary: '#4f46e5',
      surface: '#fff',
      surfaceMuted: '#f3f4f6',
      borderSoft: '1px solid #e5e7eb',
      success: '#16a34a',
      warning: '#d97706',
      danger: '#dc2626',
    },
    t: (_zh: string, en: string) => en,
  }),
}));

function renderWithProviders() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TodayPlanSkills username="alice" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TodayPlanSkills', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders three practice cards', async () => {
    vi.mocked(fetchTodayPlan).mockResolvedValue({
      user_id: 'alice',
      generated_at: 'x',
      empty_reason: null,
      items: [
        {
          skill_id: 'decayed',
          skill_name: 'Decayed',
          reason: 'due_review',
          effective_mastery: 0,
          days_since_practice: 30,
          prerequisites_ready: true,
          suggested_minutes: 15,
          action: { type: 'training', target_skills: ['decayed'] },
        },
        {
          skill_id: 'mid',
          skill_name: 'Mid',
          reason: 'zpd_blocked_by:low',
          effective_mastery: 0.6,
          days_since_practice: 0,
          prerequisites_ready: false,
          suggested_minutes: 20,
          action: { type: 'training', target_skills: ['mid'] },
        },
        {
          skill_id: 'advanced',
          skill_name: 'Advanced',
          reason: 'unlocked',
          effective_mastery: 0,
          days_since_practice: null,
          prerequisites_ready: true,
          suggested_minutes: 15,
          action: { type: 'feynman', skill_id: 'advanced' },
        },
      ],
    });

    renderWithProviders();

    const cards = await screen.findAllByTestId('today-plan-item');
    expect(cards).toHaveLength(3);
    expect(cards[0].textContent).toContain('Due for review');
    expect(cards[0].textContent).toContain('Start practice');
    expect(cards[1].textContent).toContain('Ready to stretch / Prerequisite pending');
    expect(cards[2].textContent).toContain('Unlocked');
    expect(cards[2].textContent).toContain('Explain it back');
  });

  it('renders an empty state', async () => {
    vi.mocked(fetchTodayPlan).mockResolvedValue({
      user_id: 'alice',
      generated_at: null,
      items: [],
      empty_reason: 'no_skills',
    });

    renderWithProviders();

    expect(await screen.findByText(/Your skill map is empty/)).toBeInTheDocument();
    expect(screen.queryAllByTestId('today-plan-item')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Open Tutor' })).toBeInTheDocument();
  });
});
