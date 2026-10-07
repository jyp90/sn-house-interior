import type { Category, Plan, Product } from '../model/schema';

export const CATEGORY_ORDER: Category[] = ['kitchen', 'laundry', 'tv', 'climate', 'living', 'furniture', 'custom'];

export const CATEGORY_LABEL: Record<Category, string> = {
  kitchen: '주방가전',
  laundry: '세탁·건조',
  tv: 'TV',
  climate: '냉난방',
  living: '생활가전',
  furniture: '가구',
  custom: '사용자 정의',
};

// 삼성 제품 치수는 샘플 값이다. 계획 4에서 사용자가 준 모델 목록과 공식 사양으로 교체한다.
export const CATALOG: Product[] = [
  {
    id: 'samsung-bespoke-4door-sample',
    brand: 'samsung',
    model: 'BESPOKE 4도어 (샘플 치수)',
    name: '비스포크 냉장고 4도어',
    category: 'kitchen',
    dims: { w: 91, d: 93, h: 185 },
    variants: [
      { id: 'satin-white', label: '새틴 화이트', colors: { panel: '#e9e6df', body: '#c9c9c9' } },
      { id: 'glam-navy', label: '글램 네이비', colors: { panel: '#2b3446', body: '#c9c9c9' } },
    ],
    builder: 'fridge',
    builderParams: { split: '4door', topRatio: 0.58 },
    clearances: [
      { kind: 'swing', hinge: 'left', radius: 45 },
      { kind: 'swing', hinge: 'right', radius: 45 },
    ],
    power: { watts: 300, dedicatedCircuit: false },
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'samsung-grande-washer-sample',
    brand: 'samsung',
    model: '그랑데 세탁기 (샘플 치수)',
    name: '그랑데 드럼세탁기',
    category: 'laundry',
    dims: { w: 70, d: 85, h: 110 },
    variants: [{ id: 'white', label: '화이트', colors: { body: '#eeeeee', door: '#3a404a' } }],
    builder: 'front-loader',
    clearances: [{ kind: 'front', depth: 60 }],
    power: { watts: 2000, dedicatedCircuit: true },
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'samsung-tv-75-sample',
    brand: 'samsung',
    model: '75인치 TV (샘플 치수)',
    name: '75인치 벽걸이 TV',
    category: 'tv',
    dims: { w: 167, d: 3, h: 96 },
    variants: [{ id: 'black', label: '블랙', colors: { frame: '#1d1d1f', screen: '#0b0c10' } }],
    builder: 'tv',
    builderParams: { mountHeight: 90 },
    clearances: [],
    power: { watts: 250, dedicatedCircuit: false },
    builtIn: false,
    mount: 'wall',
  },
  {
    id: 'sofa-3seat',
    brand: 'generic',
    model: '',
    name: '3인 소파',
    category: 'furniture',
    dims: { w: 210, d: 90, h: 80 },
    variants: [{ id: 'gray', label: '그레이', colors: { fabric: '#8a8f98' } }],
    builder: 'sofa',
    clearances: [],
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'bed-queen',
    brand: 'generic',
    model: '',
    name: '퀸 침대',
    category: 'furniture',
    dims: { w: 165, d: 215, h: 100 },
    variants: [{ id: 'oak', label: '오크', colors: { frame: '#b08a62', mattress: '#f4f1ea' } }],
    builder: 'bed',
    clearances: [],
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'table-dining-4',
    brand: 'generic',
    model: '',
    name: '4인 식탁',
    category: 'furniture',
    dims: { w: 140, d: 80, h: 74 },
    variants: [{ id: 'oak', label: '오크', colors: { wood: '#b08a62' } }],
    builder: 'table',
    clearances: [],
    builtIn: false,
    mount: 'floor',
  },
];

export function findProduct(plan: Plan, productId: string): Product | undefined {
  return plan.customProducts.find((p) => p.id === productId) ?? CATALOG.find((p) => p.id === productId);
}
