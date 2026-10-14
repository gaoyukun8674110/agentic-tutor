interface SkyBackgroundProps {
  variant?: 'animated' | 'static';
}

export function SkyBackground({ variant = 'animated' }: SkyBackgroundProps): JSX.Element {
  const className = variant === 'static' ? 'sky-bg sky-bg--static' : 'sky-bg';
  return (
    <div className={className} aria-hidden>
      <div className="sky-bg__stars" />
      <div className="sky-bg__clouds" />
    </div>
  );
}
