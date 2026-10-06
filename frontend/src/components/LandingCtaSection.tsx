import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

import { cn } from './ui/utils';

const GRASS_SRC =
  'https://res.cloudinary.com/dy5er7kv5/image/upload/q_auto/f_auto/v1780586778/cta-bg_mlwy5s.png';
const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4';

interface FadeUpProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}

export function FadeUp({ children, className, delay = 0, y }: FadeUpProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: y ?? 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface MIconProps {
  name: string;
  size?: number;
  fill?: number;
  weight?: number;
  grade?: number;
  opticalSize?: number;
  className?: string;
}

export function MIcon({
  name,
  size = 20,
  fill = 0,
  weight = 400,
  grade = 0,
  opticalSize = size,
  className,
}: MIconProps) {
  return (
    <span
      aria-hidden
      className={cn('material-symbols-outlined inline-flex select-none items-center justify-center', className)}
      style={{
        fontSize: size,
        lineHeight: 1,
        fontVariationSettings: `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${opticalSize}`,
      }}
    >
      {name}
    </span>
  );
}

function AnimatedText({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block overflow-hidden leading-none">
      <span className="block transition-transform duration-250 ease-out group-hover:-translate-y-full">
        {children}
      </span>
      <span className="absolute left-0 top-full block transition-transform duration-250 ease-out group-hover:-translate-y-full">
        {children}
      </span>
    </span>
  );
}

type PrimaryButtonProps<T extends ElementType = 'a'> = {
  as?: T;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'children' | 'size' | 'className'>;

export function PrimaryButton<T extends ElementType = 'a'>({
  as,
  children,
  size = 'lg',
  className,
  ...props
}: PrimaryButtonProps<T>) {
  const Comp = (as ?? 'a') as ElementType;
  const sizes = {
    sm: 'h-9 px-5 text-xs font-medium',
    md: 'h-10 px-7 text-sm font-medium',
    lg: 'h-12 px-9 text-sm font-medium',
  };

  return (
    <Comp
      className={cn(
        'group inline-flex items-center justify-center rounded-full bg-white/80 text-black leading-none transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        sizes[size],
        className,
      )}
      {...props}
    >
      <AnimatedText>{children}</AnimatedText>
    </Comp>
  );
}

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
}

const seedMessages: ChatMessage[] = [
  {
    role: 'assistant',
    content:
      "Welcome to AI Tutor. I'll help you turn weak spots into a focused practice plan. What topic should we diagnose first?",
  },
  {
    role: 'user',
    content: 'I keep missing algebra word problems and I do not know which step breaks down.',
  },
  {
    role: 'assistant',
    content:
      "Good. We'll inspect the mistake, update your mastery map, and build today's practice around the exact skill that needs review.",
  },
];

interface ChatPanelProps {
  initialScroll?: 'top' | 'bottom';
  animateMessagesIn?: boolean;
}

export function ChatPanel({ initialScroll = 'bottom', animateMessagesIn = false }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = initialScroll === 'bottom' ? list.scrollHeight : 0;
  }, [initialScroll]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draft]);

  const send = () => {
    const clean = draft.trim();
    if (!clean) return;
    setMessages((current) => [
      ...current,
      { role: 'user', content: clean },
      {
        role: 'assistant',
        content:
          'I saved that as a learning signal. Next, we will diagnose the error pattern and queue a short review set.',
      },
    ]);
    setDraft('');
  };

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10"
      style={{
        background: 'rgba(8,8,10,0.6)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <div className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-white">
          <MIcon name="auto_awesome" size={14} />
        </div>
        <div>
          <p className="text-sm font-medium text-white">AI Tutor practice loop</p>
          <p className="text-[11px] text-white/40">Diagnose, plan, practice, remember</p>
        </div>
      </div>

      <div ref={listRef} className="scrollbar-hide min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.map((message, index) => {
          const bubble = (
            <div className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  message.role === 'user'
                    ? 'bg-white/15 text-white/90'
                    : 'border border-white/5 bg-white/5 text-white/70',
                )}
              >
                {message.content}
              </div>
            </div>
          );

          return animateMessagesIn ? (
            <FadeUp key={`${message.role}-${index}`} delay={index * 0.12} y={16}>
              {bubble}
            </FadeUp>
          ) : (
            <div key={`${message.role}-${index}`}>{bubble}</div>
          );
        })}
      </div>

      <div className="p-3">
        <div className="liquid-glass flex items-end gap-2 rounded-2xl p-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Ask about today's practice..."
            className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white/80 outline-none placeholder:text-white/35"
          />
          <button
            type="button"
            onClick={send}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-black transition-colors hover:bg-white/85"
            aria-label="Send learning question"
          >
            <MIcon name="arrow_upward" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function VelorahHeroPreview() {
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-2xl"
      style={{ backgroundColor: 'hsl(201 100% 13%)' }}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 z-0 h-full w-full object-cover"
      >
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-[1] bg-black/25" />

      <div className="relative z-10 flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
        <div
          className="text-sm tracking-tight text-white sm:text-base md:text-lg"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          AI Tutor<sup className="text-[0.5em]">®</sup>
        </div>
        <nav className="hidden items-center gap-4 text-[9px] text-white/60 md:flex lg:text-[10px]">
          <span className="text-white">Today</span>
          <span className="transition-colors hover:text-white">Diagnose</span>
          <span className="transition-colors hover:text-white">Review</span>
          <span className="transition-colors hover:text-white">Plan</span>
          <span className="transition-colors hover:text-white">Tutor</span>
        </nav>
        <button className="liquid-glass rounded-full px-2.5 py-1 text-[9px] text-white sm:px-3 sm:text-[10px]">
          Start review
        </button>
      </div>

      <div className="relative z-10 flex flex-col items-center px-3 pb-6 pt-3 text-center sm:px-4 sm:pt-5 md:pt-7">
        <h1
          className="animate-fade-rise max-w-[90%] text-lg font-normal leading-[0.95] tracking-[-0.03em] text-white sm:text-2xl md:text-3xl lg:text-4xl"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Where <em className="not-italic text-white/55">mistakes</em> become{' '}
          <em className="not-italic text-white/55">memory.</em>
        </h1>
        <p className="animate-fade-rise-delay mt-2 max-w-[80%] text-[9px] leading-relaxed text-white/60 sm:mt-3 sm:max-w-sm sm:text-[11px] md:mt-4 md:max-w-md md:text-xs">
          AI Tutor reads your recent answers, finds the fragile skill, and turns it into a
          focused practice path for the next study session.
        </p>
        <button className="animate-fade-rise-delay-2 liquid-glass mt-3 rounded-full px-4 py-1.5 text-[9px] text-white sm:mt-4 sm:px-5 sm:py-2 sm:text-[10px] md:mt-5 md:px-6 md:py-2.5">
          Open today's plan
        </button>
      </div>
    </div>
  );
}

export function CtaDashboardMock() {
  return (
    <div className="liquid-glass mx-auto aspect-[3/4] w-full max-w-[1100px] overflow-hidden rounded-2xl p-2 sm:aspect-[16/10] sm:p-3 lg:aspect-[16/9]">
      <div className="grid h-full grid-cols-1 gap-2 sm:grid-cols-[minmax(220px,320px)_1fr] sm:gap-3">
        <div className="hidden min-h-0 sm:block">
          <ChatPanel initialScroll="top" animateMessagesIn />
        </div>
        <div className="min-h-0">
          <VelorahHeroPreview />
        </div>
      </div>
    </div>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isMobile;
}

export function LandingCtaSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobile();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const dashboardY = useTransform(scrollYProgress, [0, 1], ['120px', '-120px']);
  const grassY = useTransform(
    scrollYProgress,
    [0, 1],
    isMobile ? ['80px', '-40px'] : ['200px', '-200px'],
  );

  return (
    <section
      ref={sectionRef}
      id="study-cta"
      className="relative w-full overflow-hidden bg-black text-white"
      style={{ background: 'linear-gradient(to bottom, transparent 0%, #14191E 100%)' }}
    >
      <div className="relative mx-auto max-w-[1080px] px-4 pb-[440px] pt-24 sm:px-6 sm:pb-[520px] sm:pt-32 md:pb-[440px] md:pt-40">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:gap-8">
          <div className="relative z-20 max-w-[410px]">
            <FadeUp delay={1}>
              <h2 className="text-3xl font-normal leading-[1.05] tracking-[-0.02em] text-white sm:text-4xl">
                Turn every weak spot into a clear study plan with AI.
              </h2>
            </FadeUp>
            <FadeUp delay={0.1}>
              <p className="mt-6 max-w-[380px] text-base leading-[1.5] text-landing-text sm:text-lg">
                AI Tutor diagnoses mistakes, updates your mastery map, and builds today's practice
                around the skills that actually need attention.
              </p>
            </FadeUp>
            <FadeUp delay={0.2} className="mt-10">
              <PrimaryButton as="button">Start learning</PrimaryButton>
            </FadeUp>
          </div>
        </div>
      </div>

      <motion.div
        style={{ y: dashboardY } as { y: ReturnType<typeof useTransform> } & CSSProperties}
        className="absolute left-4 right-4 top-[440px] z-10 sm:left-auto sm:right-[-8%] sm:top-[460px] sm:w-[85%] md:right-[-10%] md:top-[500px] md:w-[80%] lg:right-[-12%] lg:top-20 lg:w-[68%]"
      >
        <CtaDashboardMock />
      </motion.div>

      <motion.img
        src={GRASS_SRC}
        alt=""
        aria-hidden
        style={{ y: grassY } as { y: ReturnType<typeof useTransform> } & CSSProperties}
        className="pointer-events-none absolute bottom-[-40px] left-0 right-0 z-30 w-full select-none object-cover sm:bottom-[-80px] lg:bottom-[-140px]"
      />
    </section>
  );
}
