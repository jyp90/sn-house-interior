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
        <input type="color" aria-label={`${label} 색`} value={value.color} onChange={(e) => onChange({ ...value, color: e.target.value })} />
      </div>
    </fieldset>
  );
}

export const FLOOR_MATERIALS: readonly [FloorFinish['material'], string][] = [['wood', '마루'], ['tile', '타일'], ['plain', '단색']];
export const WALL_MATERIALS: readonly [WallFinish['material'], string][] = [['paint', '페인트'], ['wallpaper', '벽지']];
