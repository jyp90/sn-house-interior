import { useState, type FormEvent } from 'react';
import { planCenter } from '../geometry/bounds';
import { usePlanStore } from '../model/StoreContext';

const FIELDS = [
  ['w', '폭 W'],
  ['d', '깊이 D'],
  ['h', '높이 H'],
] as const;

export function CustomBoxForm() {
  const store = usePlanStore();
  const [name, setName] = useState('');
  const [dims, setDims] = useState({ w: '60', d: '60', h: '90' });
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const n = { w: Number(dims.w), d: Number(dims.d), h: Number(dims.h) };
    const valid = Object.values(n).every((v) => Number.isInteger(v) && v >= 1 && v <= 1000);
    if (!name.trim() || !valid) {
      setError('이름과 1~1000 사이 정수 치수(cm)를 입력하세요.');
      return;
    }
    setError(null);
    const s = store.getState();
    const productId = s.addCustomProduct({ name: name.trim(), ...n });
    s.addItem(productId, 'default', planCenter(s.plan));
    setName('');
  };

  return (
    <form className="custom-box" onSubmit={onSubmit}>
      <h3>사용자 정의 박스</h3>
      <label>이름<input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김치냉장고 자리" /></label>
      <div className="row">
        {FIELDS.map(([k, label]) => (
          <label key={k}>
            {label}
            <input inputMode="numeric" value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button type="submit">추가</button>
    </form>
  );
}
