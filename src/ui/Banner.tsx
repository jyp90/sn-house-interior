import { useUi } from './uiStore';

export function Banner() {
  const banner = useUi((s) => s.banner);
  const clear = useUi((s) => s.clearBanner);
  if (!banner) return null;
  return (
    <div className={`banner banner-${banner.kind}`} data-testid="banner" role={banner.kind === 'error' ? 'alert' : 'status'}>
      <span style={{ whiteSpace: 'pre-line' }}>{banner.text}</span>
      <button type="button" onClick={clear} aria-label="닫기">×</button>
    </div>
  );
}
