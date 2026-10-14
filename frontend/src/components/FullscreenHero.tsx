import { BrandMark } from './BrandMark';

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4';

function scrollToLogin() {
  document.getElementById('login-card')?.scrollIntoView({ behavior: 'smooth' });
}

export function FullscreenHero() {
  return (
    <section
      className="relative flex min-h-screen w-full flex-col overflow-hidden"
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

      <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <BrandMark size={40} hero />
          <div className="text-left">
            <div
              className="text-xl leading-none text-white"
              style={{
                fontFamily: "'Noto Serif SC', 'Songti SC', 'Georgia', serif",
                fontWeight: 700,
              }}
            >
              砚思
            </div>
            <div
              className="mt-1 text-[11px] uppercase text-white/60"
              style={{ letterSpacing: '0.28em' }}
            >
              Inkwell Tutor
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={scrollToLogin}
          className="liquid-glass-hero rounded-full px-6 py-2.5 text-sm text-white transition-transform hover:scale-[1.03]"
        >
          Begin Journey
        </button>
      </nav>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <h1
          className="animate-fade-rise max-w-5xl text-5xl font-normal leading-[0.95] tracking-[-2.46px] text-white sm:text-7xl md:text-8xl"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Where <em className="not-italic text-white/55">mistakes</em> become{' '}
          <em className="not-italic text-white/55">memory.</em>
        </h1>
        <p className="animate-fade-rise-delay mt-8 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg">
          Inkwell reads your recent answers, finds the fragile skill, and turns it into a focused
          practice path for your next study session.
        </p>
        <button
          type="button"
          onClick={scrollToLogin}
          className="animate-fade-rise-delay-2 liquid-glass-hero mt-12 cursor-pointer rounded-full px-14 py-5 text-base text-white transition-transform hover:scale-[1.03]"
        >
          Start learning
        </button>
      </div>
    </section>
  );
}
