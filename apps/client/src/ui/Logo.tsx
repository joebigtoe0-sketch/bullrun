/** Served from `apps/client/public/logo.png` at `/logo.png`. */
const LOGO_SRC = '/logo.png';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt="Bull Race"
      className={`app-logo ${className}`.trim()}
      width={72}
      height={72}
      decoding="async"
    />
  );
}
