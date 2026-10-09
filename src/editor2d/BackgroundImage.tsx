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
  const w = bg.widthPx * bg.cmPerPx;
  const h = bg.heightPx * bg.cmPerPx;
  return (
    <g className="background2d">
      {/* 도면 이미지 자리의 흰 종이(스펙 §37.1): 이미지를 숨겨도(opacity 0) 평면도 영역은 흰 바탕 */}
      <rect x={bg.offsetX} y={bg.offsetY} width={w} height={h} className="background-paper" pointerEvents="none" data-testid="background-paper" />
      {url && (
        <image
          href={url}
          x={bg.offsetX}
          y={bg.offsetY}
          width={w}
          height={h}
          opacity={bg.opacity}
          preserveAspectRatio="none"
          pointerEvents="none"
          style={{ filter: 'grayscale(1)' }}
          data-testid="background-image"
        />
      )}
    </g>
  );
}
