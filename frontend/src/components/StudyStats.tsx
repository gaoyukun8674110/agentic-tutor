import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BookOpen, Clock, Target, TimerReset } from 'lucide-react';

import type { DashboardWeekDay } from '../utils/dashboardApi';
import { parseLocalDateKey } from '../utils/dateKey';
import { useSettings } from '../utils/settings';

interface StudyStatsProps {
  focusMinutes?: number;
  completedPomodoros?: number;
  completedTasks?: number;
  totalTasks?: number;
  weeklyData?: DashboardWeekDay[];
}

const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = (typeof dayKeys)[number];

const dayNames: Record<'zh' | 'en', Record<DayKey, string>> = {
  zh: { mon: '周一', tue: '周二', wed: '周三', thu: '周四', fri: '周五', sat: '周六', sun: '周日' },
  en: { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' },
};

const jsDayToKey: Record<number, DayKey> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

export function StudyStats({
  focusMinutes = 0,
  completedPomodoros = 0,
  completedTasks = 0,
  totalTasks = 0,
  weeklyData: persistedWeeklyData = [],
}: StudyStatsProps) {
  const { language, tokens, t } = useSettings();
  const todayKey = jsDayToKey[new Date().getDay()];
  const todayHours = Number((focusMinutes / 60).toFixed(2));

  const weeklyData = useMemo(
    () =>
      persistedWeeklyData.length > 0
        ? persistedWeeklyData.map((item) => {
            const parsedDate = parseLocalDateKey(item.date);
            const dayKey = jsDayToKey[parsedDate.getDay()] || todayKey;
            return {
              key: item.date,
              day: dayNames[language][dayKey],
              hours: item.hours,
              tasks: item.tasks,
            };
          })
        : dayKeys.map((key) => ({
            key,
            day: dayNames[language][key],
            hours: key === todayKey ? todayHours : 0,
            tasks: key === todayKey ? completedTasks : 0,
          })),
    [completedTasks, language, persistedWeeklyData, todayHours, todayKey],
  );

  const totalHours = weeklyData.reduce((sum, day) => sum + day.hours, 0);
  const avgHours = totalHours > 0 ? totalHours / weeklyData.length : 0;
  const hasWeeklyActivity = weeklyData.some((day) => day.hours > 0 || day.tasks > 0);

  const summaryItems = [
    { icon: Clock, label: t('本周总时长', 'Total hours'), value: `${totalHours.toFixed(1)}h` },
    { icon: BookOpen, label: t('日均学习', 'Daily avg'), value: `${avgHours.toFixed(1)}h` },
    { icon: Target, label: t('完成任务', 'Tasks done'), value: `${completedTasks}/${totalTasks}` },
    { icon: TimerReset, label: t('番茄轮次', 'Pomodoros'), value: `${completedPomodoros}` },
  ];

  const tooltipStyle = {
    backgroundColor: tokens.chartTooltipBg,
    backdropFilter: 'blur(10px)',
    border: tokens.borderSoft,
    borderRadius: '10px',
    fontSize: '12px',
  };

  return (
    <div className="space-y-6">
      <div
        className="grid grid-cols-2 gap-px overflow-hidden md:grid-cols-4"
        style={{ background: 'var(--ai-wall-border)' }}
      >
        {summaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="p-4" style={{ background: tokens.surface }}>
              <div className="mb-2 flex items-center gap-2">
                <Icon className="h-4 w-4" style={{ color: 'var(--ai-wall-tick)' }} />
                <span
                  className="uppercase"
                  style={{
                    color: 'var(--ai-wall-tick)',
                    fontSize: 11,
                    letterSpacing: '0.14em',
                  }}
                >
                  {item.label}
                </span>
              </div>
              <p
                className="tabular-nums"
                style={{ color: 'var(--ai-wall-title)', fontSize: 26, fontWeight: 700 }}
              >
                {item.value}
              </p>
            </div>
          );
        })}
      </div>

      {!hasWeeklyActivity && (
        <p className="text-sm" style={{ color: tokens.textMuted }}>
          {t(
            '本周还没有学习记录，开始一个番茄钟即可生成趋势。',
            'No study records this week. Start one pomodoro to generate a trend.',
          )}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3
              className="flex items-center gap-2 text-sm font-medium"
              style={{ color: tokens.textPrimary }}
            >
              <Clock className="h-4 w-4" style={{ color: tokens.accentPrimary }} />
              {t('本周学习时长趋势', 'Weekly time')}
            </h3>
            <span className="text-xs" style={{ color: tokens.textMuted }}>
              {t('小时', 'hours')}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="study-hours-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tokens.accentPrimary} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={tokens.accentPrimary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={tokens.chartGrid} opacity={0.28} />
              <XAxis
                dataKey="day"
                tick={{ fill: tokens.textSecondary, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={28}
                tick={{ fill: tokens.textSecondary, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: tokens.accentPrimarySoft }}
                formatter={(value) => [
                  `${Number(value).toFixed(1)} ${t('小时', 'h')}`,
                  t('时长', 'Time'),
                ]}
              />
              <Area
                type="monotone"
                dataKey="hours"
                stroke={tokens.accentPrimary}
                strokeWidth={2}
                fill="url(#study-hours-fill)"
                dot={false}
                activeDot={{ r: 5, fill: tokens.accentPrimary }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3
              className="flex items-center gap-2 text-sm font-medium"
              style={{ color: tokens.textPrimary }}
            >
              <Target className="h-4 w-4" style={{ color: tokens.accentSecondary }} />
              {t('每日任务完成数', 'Tasks per day')}
            </h3>
            <span className="text-xs" style={{ color: tokens.textMuted }}>
              {t('个', 'tasks')}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData}>
              <CartesianGrid vertical={false} stroke={tokens.chartGrid} opacity={0.28} />
              <XAxis
                dataKey="day"
                tick={{ fill: tokens.textSecondary, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={28}
                allowDecimals={false}
                tick={{ fill: tokens.textSecondary, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: tokens.accentPrimarySoft }}
                formatter={(value) => [`${Number(value)} ${t('个', 'tasks')}`, t('任务', 'Tasks')]}
              />
              <Bar
                dataKey="tasks"
                fill={tokens.accentSecondary}
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>
    </div>
  );
}
