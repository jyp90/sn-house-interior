import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { getLabels, projectToScreen, publishLabels, subscribeLabels } from './labelBridge';

function topCamera() {
  // 원점 위 10 m에서 아래를 보는 직교 카메라, 화면 = x -5..5, z -5..5
  const cam = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  cam.position.set(0, 10, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}

describe('projectToScreen', () => {
  const size = { width: 200, height: 100 };
  it('화면 중앙과 모서리를 px로 옮긴다', () => {
    const cam = topCamera();
    const c = projectToScreen([0, 0, 0], cam, size)!;
    expect(c.x).toBeCloseTo(100);
    expect(c.y).toBeCloseTo(50);
    const p = projectToScreen([5, 0, 5], cam, size)!;
    expect(p.x).toBeCloseTo(200);
    expect(p.y).toBeCloseTo(100);
  });
  it('카메라 뒤는 null', () => {
    const cam = new THREE.PerspectiveCamera(50, 2, 0.1, 100);
    cam.position.set(0, 0, 0);
    cam.lookAt(0, 0, -1);
    cam.updateMatrixWorld();
    expect(projectToScreen([0, 0, -5], cam, size)).not.toBeNull();
    expect(projectToScreen([0, 0, 5], cam, size)).toBeNull();
  });
});

describe('publishLabels', () => {
  it('종류별로 모으고 같은 값이면 알리지 않는다', () => {
    let n = 0;
    const off = subscribeLabels(() => n++);
    publishLabels('room', [{ key: 'r1', kind: 'room', text: '거실', x: 1, y: 2 }]);
    publishLabels('dist', [{ key: 'L', kind: 'dist', text: '10cm', x: 3, y: 4 }]);
    publishLabels('room', [{ key: 'r1', kind: 'room', text: '거실', x: 1, y: 2 }]);
    expect(n).toBe(2);
    expect(getLabels().map((l) => l.text)).toEqual(['거실', '10cm']);
    publishLabels('dist', []);
    publishLabels('room', []);
    expect(getLabels()).toEqual([]);
    off();
  });
});
