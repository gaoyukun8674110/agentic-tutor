import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchMastery, fetchTodayPlan } from './studentApi';

describe('studentApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchTodayPlan uses the expected path and returns data', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          user_id: 'alice',
          generated_at: '2026-10-06T09:00:00',
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
          ],
          empty_reason: null,
        }),
        { status: 200 },
      ),
    );

    const result = await fetchTodayPlan('alice');

    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/student/alice/today-plan?limit=3');
    expect(result.items[0].skill_id).toBe('decayed');
  });

  it('fetchMastery uses the expected path', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ user_id: 'alice', masteries: [] }), { status: 200 }),
    );

    const result = await fetchMastery('alice');

    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/student/alice/mastery');
    expect(result.masteries).toEqual([]);
  });
});
