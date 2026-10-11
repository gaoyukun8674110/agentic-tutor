import { useEffect, useState, type ElementType, type ReactNode } from 'react';

import { useSettings } from '../utils/settings';

const pad = (n: number) => String(n).padStart(2, '0');

const ZH_WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SPAN_CLASS: Record<1 | 2 | 3, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
};

export function formatWallClock(date: Date, language: 'zh' | 'en'): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours();
  const min = date.getMinutes();
  const s = date.getSeconds();
  const weekdays = language === 'zh' ? ZH_WEEKDAYS : EN_WEEKDAYS;
  const weekday = weekdays[date.getDay()];
  return `${y}-${pad(m)}-${pad(d)} ${pad(h)}:${pad(min)}:${pad(s)} ${weekday}`;
}

interface DataWallProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function DataWall({ title, subtitle, actions, children }: DataWallProps): JSX.Element {
  const { language } = useSettings();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section data-testid="data-wall">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-3xl"
            style={{
              fontFamily: "'Noto Serif SC', 'Songti SC', 'Georgia', serif",
              color: 'var(--ai-wall-title)',
            }}
          >
            {title}
          </h2>
          {subtitle && <p style={{ color: 'var(--ai-wall-tick)' }}>{subtitle}</p>}
        </div>
        <div className="flex flex-col items-end gap-3">
          <p data-testid="wall-clock" className="tabular-nums">
            {formatWallClock(now, language === 'zh' ? 'zh' : 'en')}
          </p>
          {actions}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{children}</div>
    </section>
  );
}

interface WallPanelProps {
  title: string;
  icon?: ElementType;
  span?: 1 | 2 | 3;
  children: ReactNode;
}

export function WallPanel({ title, icon, span, children }: WallPanelProps): JSX.Element {
  const Icon = icon;

  return (
    <section
      data-testid="wall-panel"
      className={SPAN_CLASS[span ?? 1]}
      style={{
        background: 'var(--ai-wall-panel)',
        border: '1px solid var(--ai-wall-border)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 16,
        boxShadow: '0 1px 2px var(--ai-wall-glow)',
        padding: 20,
      }}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" style={{ color: 'var(--ai-wall-tick)' }} />}
        <p
          data-testid="wall-panel-title"
          className="uppercase"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--ai-wall-tick)',
            letterSpacing: '0.14em',
          }}
        >
          {title}
        </p>
      </div>
      {children}
    </section>
  );
}

interface KpiCellProps {
  label: string;
  value: string;
  icon?: ElementType;
  hint?: string;
}

export function KpiCell({ label, value, icon, hint }: KpiCellProps): JSX.Element {
  const Icon = icon;

  return (
    <div
      data-testid="kpi-cell"
      style={{
        background: 'var(--ai-wall-panel)',
        border: '1px solid var(--ai-wall-border)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 14,
        boxShadow: '0 1px 2px var(--ai-wall-glow)',
        padding: 16,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className="uppercase"
            style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--ai-wall-tick)' }}
          >
            {label}
          </p>
          <p
            data-testid="kpi-value"
            className="tabular-nums"
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: 'var(--ai-wall-title)',
              textShadow: '0 0 18px var(--ai-wall-glow)',
            }}
          >
            {value}
          </p>
          {hint && <p style={{ fontSize: 11, color: 'var(--ai-wall-tick)' }}>{hint}</p>}
        </div>
        {Icon && <Icon className="h-5 w-5" style={{ color: 'var(--ai-wall-glow)' }} />}
      </div>
    </div>
  );
}
