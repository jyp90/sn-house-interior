import { usePlan } from '../model/StoreContext';
import { useBackgroundUrl } from './useBackgroundUrl';

export function BackgroundImage({ px }: { px: number }) {
  const bg = usePlan((s) => s.plan.background);
  const { url, missing } = useBackgroundUrl(bg?.imageRef);
  if (!bg) return null;
  if (missing) {
    return (
      <text x={bg.offsetX} y={bg.offsetY} fontSize={12 * px} className="muted-svg">
        배경 이미지를 이 브라우저에서 찾을 수 없습니다. 구조 모드에서 다시 불러오세요.
      </text>
    );
  }
  if (!url) return null;
  return (
    <image
      href={url}
      x={bg.offsetX}
      y={bg.offsetY}
      width={bg.widthPx * bg.cmPerPx}
      height={bg.heightPx * bg.cmPerPx}
      opacity={bg.opacity}
      preserveAspectRatio="none"
      pointerEvents="none"
      data-testid="background-image"
    />
  );
}
