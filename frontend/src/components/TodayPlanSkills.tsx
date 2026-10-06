import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { cardSurfaceStyle } from '../utils/glassStyles';
import { useSettings } from '../utils/settings';
import { fetchTodayPlan, type TodayPlanItem } from '../utils/studentApi';

interface TodayPlanSkillsProps {
  username: string;
}

type ReasonKey = 'due_review' | 'zpd' | 'unlocked';

function reasonKey(reason: string): ReasonKey {
  const base = reason.split('_blocked_by:')[0];
  if (base === 'zpd') return 'zpd';
  if (base === 'unlocked') return 'unlocked';
  return 'due_review';
}

function isBlocked(reason: string): boolean {
  return reason.includes('_blocked_by:');
}

export function TodayPlanSkills({ username }: TodayPlanSkillsProps) {
  const navigate = useNavigate();
  const { tokens, t } = useSettings();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['student', 'today-plan', username],
    queryFn: ({ signal }) => fetchTodayPlan(username, 3, { signal }),
    enabled: Boolean(username),
    retry: false,
  });

  const cardStyle = cardSurfaceStyle(tokens);
  const items: TodayPlanItem[] = data?.items ?? [];

  const reasonLabel = (reason: string) => {
    const labels: Record<ReasonKey, string> = {
      due_review: t('Due for review', 'Due for review'),
      zpd: t('Ready to stretch', 'Ready to stretch'),
      unlocked: t('Unlocked', 'Unlocked'),
    };
    const base = labels[reasonKey(reason)];
    return isBlocked(reason)
      ? `${base} / ${t('Prerequisite pending', 'Prerequisite pending')}`
      : base;
  };

  const masteryColor = (value: number) => {
    if (value < 0.3) return tokens.danger;
    if (value < 0.7) return tokens.warning;
    return tokens.success;
  };

  const emptyMessage =
    data?.empty_reason === 'all_mastered'
      ? t(
          'Everything is mastered. Start a new topic with the Tutor.',
          'Everything is mastered. Start a new topic with the Tutor.',
        )
      : t(
          'Your skill map is empty. Work through a problem with the Tutor to start tracking mastery.',
          'Your skill map is empty. Work through a problem with the Tutor to start tracking mastery.',
        );

  return (
    <section className="p-6" style={cardStyle} data-testid="today-plan-skills">
      <p
        className="mb-4 text-xs font-semibold uppercase"
        style={{ color: tokens.textMuted, letterSpacing: '0.14em' }}
      >
        {t('Practice today', 'Practice today')}
      </p>

      {isLoading && (
        <p style={{ color: tokens.textSecondary }}>{t('Planning...', 'Planning...')}</p>
      )}
      {isError && (
        <p style={{ color: tokens.danger }}>
          {t("Unable to load today's plan", "Unable to load today's plan")}
        </p>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: tokens.textSecondary }}>
            {emptyMessage}
          </p>
          <button
            type="button"
            onClick={() => navigate('/tutor')}
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: tokens.accentPrimary, color: tokens.textInverted }}
          >
            {t('Open Tutor', 'Open Tutor')}
          </button>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.skill_id}
            data-testid="today-plan-item"
            className="rounded-2xl px-4 py-3"
            style={{ background: tokens.surfaceMuted, border: tokens.borderSoft }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold" style={{ color: tokens.textPrimary }}>
                  {item.skill_name}
                </p>
                <p className="text-xs" style={{ color: tokens.textSecondary }}>
                  {reasonLabel(item.reason)} / {t('Mastery', 'Mastery')}{' '}
                  {item.effective_mastery.toFixed(2)} / {item.suggested_minutes} {t('min', 'min')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/tutor')}
                className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: tokens.accentPrimary, color: tokens.textInverted }}
              >
                {item.action.type === 'feynman'
                  ? t('Explain it back', 'Explain it back')
                  : t('Start practice', 'Start practice')}
              </button>
            </div>
            <div
              className="mt-2 h-1 w-full overflow-hidden rounded-full"
              style={{ background: tokens.surface }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(Math.min(1, Math.max(0, item.effective_mastery)) * 100)}%`,
                  background: masteryColor(item.effective_mastery),
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
