import { useEffect, useState } from 'react';

type NumberFieldProps = { label: string; unit: string; value: number; onCommit: (v: number) => void; disabled?: boolean };

export function NumberField({ label, unit, value, onCommit, disabled = false }: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const v = Number(text);
    if (text.trim() !== '' && Number.isFinite(v) && Math.round(v) !== value) onCommit(Math.round(v));
    // 거부된 입력은 원래 값으로 되돌린다(성공하면 바뀐 value가 effect로 들어온다)
    setText(String(value));
  };
  return (
    <label className="field">
      {label}
      <span className="field-input">
        <input
          inputMode="numeric"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <span className="unit">{unit}</span>
      </span>
    </label>
  );
}

export function TextField({
  label,
  value,
  onCommit,
  allowEmpty = false,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  allowEmpty?: boolean;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    const v = text.trim();
    if ((v || allowEmpty) && v !== value) onCommit(v);
    setText(value);
  };
  return (
    <label className="field">
      {label}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}

export function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
