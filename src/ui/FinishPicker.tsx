import { useEffect, useRef, useState } from 'react';
import type { FloorFinish, WallFinish } from '../model/schema';

type AnyFinish = FloorFinish | WallFinish;
type Props<F extends AnyFinish> = {
  label: string;
  value: F;
  presets: readonly { id: string; label: string; finish: F }[];
  materials: readonly [F['material'], string][];
  onChange: (f: F) => void;
};

export function FinishPicker<F extends AnyFinish>({ label, value, presets, materials, onChange }: Props<F>) {
  // 색 선택기는 끄는 동안 input 이벤트를 연달아 보낸다. 미리보기는 로컬 상태로만 하고,
  // 선택을 마칠 때 오는 네이티브 change 이벤트에서 한 번만 저장한다(되돌리기 1단계, 텍스처 1개)
  const [color, setColor] = useState(value.color);
  useEffect(() => setColor(value.color), [value.color]);
  const colorRef = useRef<HTMLInputElement>(null);
  const latest = useRef({ value, onChange });
  useEffect(() => {
    latest.current = { value, onChange };
  });
  useEffect(() => {
    const el = colorRef.current;
    if (!el) return;
    const commit = () => {
      const { value: cur, onChange: save } = latest.current;
      if (el.value.toLowerCase() !== cur.color.toLowerCase()) save({ ...cur, color: el.value });
    };
    el.addEventListener('change', commit);
    return () => el.removeEventListener('change', commit);
  }, []);
  return (
    <fieldset className="finish">
      <legend>{label}</legend>
      <div className="finish-presets">
        {presets.map((p) => {
          const active = p.finish.material === value.material && p.finish.color === value.color;
          return (
            <button key={p.id} type="button" className="finish-chip" aria-pressed={active} onClick={() => onChange(p.finish)}>
              <span className="swatch" style={{ background: p.finish.color }} aria-hidden="true" />
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="row">
        <select aria-label={`${label} 재질`} value={value.material} onChange={(e) => onChange({ ...value, material: e.target.value as F['material'] })}>
          {materials.map(([m, text]) => (
            <option key={m} value={m}>{text}</option>
          ))}
        </select>
        <input ref={colorRef} type="color" aria-label={`${label} 색`} value={color} onChange={(e) => setColor(e.target.value)} />
      </div>
    </fieldset>
  );
}

export const FLOOR_MATERIALS: readonly [FloorFinish['material'], string][] = [['wood', '마루'], ['tile', '타일'], ['plain', '단색']];
export const WALL_MATERIALS: readonly [WallFinish['material'], string][] = [['paint', '페인트'], ['wallpaper', '벽지']];
