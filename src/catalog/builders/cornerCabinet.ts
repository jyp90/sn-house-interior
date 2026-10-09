import type * as THREE from 'three';
import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const COUNTER = 0.04;
const PANEL = 0.018;
const GAP = 0.003;

// 코너 싱크대·상부장. W×D 정사각 자리에 ㄱ자 몸통(두 팔 깊이 arm), 안쪽 코너는 비운다.
// 하부장(part: 'base')은 상판(L자, counter 그룹 1개)과 문짝 2개, 상부장(part: 'upper')은 상판 없이 문짝 2개.
export function buildCornerCabinet(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const part = (p.builderParams?.part as 'base' | 'upper' | undefined) ?? 'base';
  const armRaw = (p.builderParams?.arm !== undefined ? Number(p.builderParams.arm) : 60) / 100;
  // 팔 깊이는 자리보다 작아야 ㄱ자가 되고 문짝(PANEL)이 자리 안에 남는다(손으로 고친 JSON 보호)
  const arm = Math.min(Math.max(armRaw, 0.01), Math.min(W, D) - PANEL - GAP);
  const counter = part === 'base';
  const bodyH = counter ? H - COUNTER : H;
  const bodyColor = color(v.colors, 'body', '#d9d3ca');
  const doorColor = color(v.colors, 'door', '#efe9df');

  // 뒤쪽 가로 팔(전체 너비, 깊이 arm)
  const pieceA = box(W, bodyH, arm, bodyColor, 0, bodyH / 2, -D / 2 + arm / 2);
  pieceA.name = 'body';
  // 왼쪽 세로 팔(너비 arm, 남은 깊이)
  const pieceB = box(arm, bodyH, D - arm, bodyColor, -W / 2 + arm / 2, bodyH / 2, arm / 2);
  pieceB.name = 'body';

  // A팔 앞면 문짝(x: -W/2+arm ~ W/2)
  const doorA = box(W - arm - GAP, bodyH - GAP, PANEL, doorColor, arm / 2, bodyH / 2, -D / 2 + arm + PANEL / 2);
  doorA.name = 'door';
  // B팔 오른쪽 면 문짝(z: -D/2+arm ~ D/2)
  const doorB = box(PANEL, bodyH - GAP, D - arm - GAP, doorColor, -W / 2 + arm + PANEL / 2, bodyH / 2, arm / 2);
  doorB.name = 'door';

  const parts: THREE.Object3D[] = [pieceA, pieceB, doorA, doorB];

  if (counter) {
    const counterColor = color(v.colors, 'counter', '#bdb6ad');
    const counterA = box(W, COUNTER, arm, counterColor, 0, H - COUNTER / 2, -D / 2 + arm / 2);
    const counterB = box(arm, COUNTER, D - arm, counterColor, -W / 2 + arm / 2, H - COUNTER / 2, arm / 2);
    const counterGroup = group(counterA, counterB);
    counterGroup.name = 'counter';
    parts.push(counterGroup);
  }

  return group(...parts);
}
