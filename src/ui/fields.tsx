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
          autoComplete="off"
          spellCheck={false}
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
  disabled = false,
  list,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  allowEmpty?: boolean;
  disabled?: boolean;
  list?: string; // 제안 목록 <datalist> id
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
        autoComplete="off"
        value={text}
        disabled={disabled}
        list={list}
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

export function OptionalNumberField({
  label,
  unit,
  value,
  integer = false,
  onCommit,
}: {
  label: string;
  unit: string;
  value: number | undefined;
  integer?: boolean;
  onCommit: (v: number | undefined) => void;
}) {
  const shown = value === undefined ? '' : String(value);
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const commit = () => {
    const t = text.trim();
    if (t === '') {
      if (value !== undefined) onCommit(undefined);
    } else {
      const v = Number(t);
      if (Number.isFinite(v) && v >= 0 && (!integer || Number.isInteger(v)) && v !== value) onCommit(v);
    }
    // 거부된 입력은 원래 값으로 되돌린다(성공하면 바뀐 value가 effect로 들어온다)
    setText(shown);
  };
  return (
    <label className="field">
      {label}
      <span className="field-input">
        <input
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={text}
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

export function TextAreaField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    const v = text.trim();
    if (v !== value) onCommit(v);
    setText(value);
  };
  return (
    <label className="field">
      {label}
      <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} />
    </label>
  );
}
