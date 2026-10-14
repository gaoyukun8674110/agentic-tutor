import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Brain, Clock, Flame, Target, Timer, TrendingUp, Zap } from 'lucide-react';

import { useAuth } from '../auth/AuthContext';
import { DataWall, KpiCell, WallPanel } from '../components/DataWall';
import { PomodoroTimer } from '../components/PomodoroTimer';
import { SkyBackground } from '../components/SkyBackground';
import { StudyStats } from '../components/StudyStats';
import { TodayPlan } from '../components/TodayPlan';
import { TodayPlanSkills } from '../components/TodayPlanSkills';
import { TopNavbar } from '../components/TopNavbar';
import { fetchDashboardSummary } from '../utils/dashboardApi';
import { cardSurfaceStyle, primaryActionStyle } from '../utils/glassStyles';
import { useSettings } from '../utils/settings';
import { fetchMastery } from '../utils/studentApi';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, tokens, textStyle, t } = useSettings();
  const queryClient = useQueryClient();
  const { data: dashboardSummary } = useQuery({
    queryKey: ['dashboard-summary', user?.username],
    queryFn: ({ signal }) => fetchDashboardSummary({ signal }),
    enabled: Boolean(user),
    retry: false,
  });
  const { data: masteryData } = useQuery({
    queryKey: ['student', 'mastery', user?.username],
    queryFn: ({ signal }) => fetchMastery(user?.username ?? '', { signal }),
    enabled: Boolean(user),
    retry: false,
  });
  const masteries = masteryData?.masteries ?? [];
  const masteredCount = masteries.filter((item) => item.mastery_score >= 0.7).length;

  const refreshDashboard = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard-summary', user?.username] });
  }, [queryClient, user?.username]);

  const todayStats = dashboardSummary?.today;
  const focusMinutes = todayStats?.focus_minutes ?? 0;
  const completedPomodoros = todayStats?.completed_pomodoros ?? 0;
  const completedTasks = todayStats?.completed_tasks ?? 0;
  const totalTasks = todayStats?.total_tasks ?? 0;
  const streakDays = dashboardSummary?.streak_days ?? 0;
  const studyHours = focusMinutes / 60;
  const weekHours = (dashboardSummary?.weekly_data ?? []).reduce((sum, day) => sum + day.hours, 0);

  const cardStyle = cardSurfaceStyle(tokens);
  const ctaStyle = {
    ...primaryActionStyle(tokens),
    background: 'linear-gradient(135deg, #fff5a6 0%, #f3d966 100%)',
    border: '1px solid rgba(255, 242, 157, 0.72)',
    color: '#09263d',
    boxShadow: '0 8px 24px rgba(245, 216, 95, 0.24)',
  };
  const serif = "'Noto Serif SC', 'Songti SC', 'Georgia', serif";

  const dashboardShellClass = 'mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 xl:px-0';

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 6) return t('夜深了', 'Late night');
    if (hour < 11) return t('卯时开卷', 'Morning study');
    if (hour < 14) return t('午间温故', 'Midday review');
    if (hour < 19) return t('午后进学', 'Afternoon study');
    return t('灯下夜读', 'Evening study');
  })();

  const dashboardAction = (
    <button
      data-testid="dashboard-cta"
      onClick={() => navigate('/tutor')}
      className="flex h-11 items-center justify-center gap-2 rounded-xl px-6 font-medium transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 active:scale-[0.98]"
      style={ctaStyle}
    >
      <Zap className="h-5 w-5" />
      {t('进入今日学习', "Enter today's study")}
    </button>
  );

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ ...textStyle, color: tokens.textPrimary }}
    >
      <div className="fixed inset-0" style={{ background: tokens.pageGradient }} />
      <div className="fixed inset-0" style={{ background: tokens.overlayGradient }} />
      <SkyBackground variant="animated" />
      <TopNavbar />

      <div className="relative">
        <div className={dashboardShellClass}>
          <DataWall
            title={t('砚思 · 数据总览', 'Inkwell · Data Overview')}
            subtitle={`${t('今日', 'Today')} · ${greeting}`}
            actions={dashboardAction}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-6">
              <KpiCell
                label={t('今日时长', "Today's time")}
                value={
                  studyHours > 0
                    ? language === 'zh'
                      ? `${studyHours.toFixed(1)} 小时`
                      : `${studyHours.toFixed(1)} h`
                    : t('0 小时', '0 h')
                }
                icon={Clock}
              />
              <KpiCell
                label={t('今日任务', "Today's tasks")}
                value={`${completedTasks} / ${totalTasks}`}
                icon={Target}
              />
              <KpiCell
                label={t('番茄轮次', 'Pomodoros')}
                value={`${completedPomodoros}`}
                icon={Timer}
              />
              <KpiCell
                label={t('连续天数', 'Streak')}
                value={streakDays > 0 ? `${streakDays} 天` : t('0 天', '0 days')}
                icon={Flame}
              />
              <KpiCell
                label={t('掌握技能', 'Skills mastered')}
                value={`${masteredCount} / ${masteries.length}`}
                icon={Brain}
              />
              <KpiCell
                label={t('本周时长', 'This week')}
                value={language === 'zh' ? `${weekHours.toFixed(1)} 小时` : `${weekHours.toFixed(1)} h`}
                icon={TrendingUp}
              />
            </div>

            <WallPanel title={t('今日计划 · 技能', 'Today · Skills')} icon={Target} span={2}>
              <div className="mt-4 space-y-6">
                <TodayPlanSkills username={user?.username ?? ''} />
                <TodayPlan tasks={dashboardSummary?.tasks ?? []} onDataChange={refreshDashboard} />
              </div>
            </WallPanel>

            <div className="flex min-h-0 flex-col gap-4 lg:col-span-1 lg:h-full">
              <WallPanel title={t('番茄钟', 'Pomodoro')} icon={Timer}>
                <div className="mt-4">
                  <PomodoroTimer
                    userId={user?.username ?? ''}
                    persistedCompletedPomodoros={completedPomodoros}
                    persistedFocusMinutes={focusMinutes}
                    onPomodoroLogged={refreshDashboard}
                    variant="embedded"
                  />
                </div>
              </WallPanel>

              <aside className="relative flex min-h-0 flex-1 flex-col p-6" style={cardStyle}>
                <span
                  className="absolute grid place-items-center text-center"
                  style={{
                    top: -14,
                    right: 20,
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    border: '2px solid var(--ai-seal)',
                    color: 'var(--ai-seal)',
                    background: tokens.surface,
                    transform: 'rotate(-8deg)',
                    fontFamily: serif,
                    fontWeight: 700,
                    fontSize: 14,
                    lineHeight: 1.1,
                  }}
                  aria-hidden
                >
                  {t('诊断\n已落', 'seen')
                    .split('\n')
                    .map((line, index) => (
                      <span key={index} style={{ display: 'block' }}>
                        {line}
                      </span>
                    ))}
                </span>
                <p
                  className="mb-2 text-xs uppercase"
                  style={{ color: tokens.textMuted, letterSpacing: '0.16em' }}
                >
                  {t('诊断 · Diagnostician', 'Diagnostician')}
                </p>
                <p className="text-sm" style={{ color: tokens.textPrimary, lineHeight: 1.6 }}>
                  {t('本周共专注 ', 'This week you focused for ')}
                  <b style={{ color: 'var(--ai-seal)', fontWeight: 600 }}>
                    {studyHours > 0
                      ? language === 'zh'
                        ? `${studyHours.toFixed(1)} 小时`
                        : `${studyHours.toFixed(1)}h`
                      : t('尚未开始', 'not yet started')}
                  </b>
                  {streakDays > 0
                    ? t(
                        `，已连续 ${streakDays} 天。保持这个节奏。`,
                        `, ${streakDays} days in a row. Keep this rhythm.`,
                      )
                    : t('。今日迈出第一步。', '. Take the first step today.')}
                </p>
              </aside>
            </div>

            <WallPanel title={t('学习统计', 'Study stats')} icon={TrendingUp} span={3}>
              <div className="mt-4">
                <StudyStats
                  focusMinutes={focusMinutes}
                  completedPomodoros={completedPomodoros}
                  completedTasks={completedTasks}
                  totalTasks={totalTasks}
                  weeklyData={dashboardSummary?.weekly_data ?? []}
                />
              </div>
            </WallPanel>
          </DataWall>
        </div>
      </div>
    </div>
  );
}
