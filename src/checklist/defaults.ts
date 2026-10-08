export type Phase = 'common' | 'demolition' | 'window' | 'carpentry' | 'tile' | 'wallpaper' | 'floor' | 'kitchen';

export type ChecklistItem = { id: string; phase: Phase; text: string; auto: boolean };

// 시공 중 검수 순서(스펙 §15.2). 주방은 빌트인 자동 항목만 들어간다
export const PHASES: { id: Phase; label: string }[] = [
  { id: 'common', label: '공통' },
  { id: 'demolition', label: '철거' },
  { id: 'window', label: '샷시·창호' },
  { id: 'carpentry', label: '목공·전기' },
  { id: 'tile', label: '타일' },
  { id: 'wallpaper', label: '도배' },
  { id: 'floor', label: '장판' },
  { id: 'kitchen', label: '주방' },
];

const item = (id: string, phase: Phase, text: string): ChecklistItem => ({ id, phase, text, auto: false });

// id는 i- 접두어: 예전 기본 항목(demo-1 등)의 체크 상태가 다른 문구에 붙지 않게 한다
export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  item('i-common-1', 'common', '자재가 들어오면 주문한 브랜드·모델·규격과 같은지 대조한다'),
  item('i-common-2', 'common', '벽 안 전기 배선과 수도관을 옮긴 구간은 덮기 전에 사진·영상으로 남긴다'),
  item('i-common-3', 'common', '방수·단열처럼 마감 후 안 보이는 공정은 시공 사진을 받아 둔다'),

  item('i-demo-1', 'demolition', '바닥·현관문·창호 등 철거하지 않는 곳에 합판·골판지 보양이 됐는지 본다'),
  item('i-demo-2', 'demolition', '현관에서 집으로 올라서는 턱 모서리는 파손이 잦으니 보양을 따로 부탁한다'),
  item('i-demo-3', 'demolition', '작업 전에 수도 밸브를 잠갔는지, 보일러를 건드리지 않는지 확인한다'),
  item('i-demo-4', 'demolition', '전기선은 모두 걷지 말고 남겨 두도록 미리 말한다'),
  item('i-demo-5', 'demolition', '다시 쓸 자재가 있으면 철거 전에 알려 둔다'),
  item('i-demo-6', 'demolition', '내력벽·기둥이 상하지 않았는지 본다'),
  item('i-demo-7', 'demolition', '천장을 뜯은 뒤 낡은 전선 끝을 절연 처리했는지 본다'),
  item('i-demo-8', 'demolition', '욕실 방수층을 깰 때 슬래브가 드러날 만큼 과하게 깨지 않았는지 본다'),
  item('i-demo-9', 'demolition', '발코니 우수관·배수구가 막히지 않게 덮어 뒀는지 본다'),
  item('i-demo-10', 'demolition', '바닥에 남은 못·철근·이물질을 치웠는지 본다'),
  item('i-demo-11', 'demolition', '폐기물이 복도 등 공용 공간에 쌓여 있지 않은지 본다'),
  item('i-demo-12', 'demolition', '철거하기로 한 곳이 빠짐없이 뜯겼는지 마지막에 확인한다'),

  item('i-window-1', 'window', '창틀과 벽 사이가 폼으로 빈틈없이 채워졌는지 마감으로 덮기 전에 본다'),
  item('i-window-2', 'window', '창틀 주변 결로·누수 처리를 어떻게 했는지 확인한다'),
  item('i-window-3', 'window', '기존 실리콘을 걷어 내고 새로 쐈는지 확인한다'),
  item('i-window-4', 'window', '외부 실리콘 시공이 끝난 뒤 마감 상태 사진을 받는다'),
  item('i-window-5', 'window', 'PVC 창호 안 철재 보강재: 계약 전에는 제조사 사양서로, 설치 뒤에는 자석을 대어 확인한다'),

  item('i-carp-1', 'carpentry', '콘센트·스위치 위치를 목공 전에 확정한다. 늦으면 목공을 다시 불러 인건비가 두 번 든다'),
  item('i-carp-2', 'carpentry', '외벽·창가 단열재가 틈 없이 붙고 이음부가 우레탄폼으로 메워졌는지 본다'),
  item('i-carp-3', 'carpentry', '단열재 두께가 5~10cm 이상인지 현장에서 보거나 사진으로 확인한다'),
  item('i-carp-4', 'carpentry', '싱크대 쪽 창문 주변 단열을 꼼꼼히 했는지 본다'),
  item('i-carp-5', 'carpentry', '붙박이장·벽걸이 TV·주방 상부장 자리에 보강용 합판이 들어갔는지 본다'),
  item('i-carp-6', 'carpentry', '빌트인 가구·가전 치수에 맞게 틀이 짜였는지 본다'),
  item('i-carp-7', 'carpentry', '문선(9mm)과 걸레받이 두께가 요청한 대로인지 본다'),
  item('i-carp-8', 'carpentry', '커튼박스 안에 간접조명용 전선이 미리 빠져 있는지 본다'),
  item('i-carp-9', 'carpentry', '스위치·콘센트 박스 자리가 정확히 뚫렸는지 본다'),

  item('i-tile-1', 'tile', '바닥·벽 평탄도를 본 뒤 접착제를 바르는지 확인한다'),
  item('i-tile-2', 'tile', '욕실 바닥이 배수구 쪽으로 기울어 물이 고이지 않는지 본다'),
  item('i-tile-3', 'tile', '욕실 콘센트 높이가 정한 대로인지 타일을 붙이기 전에 확인한다'),
  item('i-tile-4', 'tile', '콘센트·스위치·수전 자리 타공이 정확한지, 덮개가 맞는지 작업이 끝나기 전에 끼워 본다'),
  item('i-tile-5', 'tile', '줄눈 간격이 가로·세로로 고르고 곧은지 본다'),
  item('i-tile-6', 'tile', '줄눈 색이 바닥 톤과 맞는지 본다'),
  item('i-tile-7', 'tile', '잘린 단면이 깨지거나 날카롭지 않은지 본다'),
  item('i-tile-8', 'tile', '줄눈을 다음 날로 미루자고 하면 당일 시공을 요청할 수 있다'),

  item('i-wall-1', 'wallpaper', '기존 벽지·곰팡이·이물질을 다 걷어 냈는지 본다'),
  item('i-wall-2', 'wallpaper', '콘센트·스위치 커버를 떼고 도배했는지 본다'),
  item('i-wall-3', 'wallpaper', '마르는 동안 창문을 닫고 자연 건조하는지 확인한다'),
  item('i-wall-4', 'wallpaper', '바닥의 풀 자국과 자투리를 치웠는지 본다'),
  item('i-wall-5', 'wallpaper', '보수용 남은 벽지를 받아 둔다. 없으면 한 곳만 찢어져도 그 벽 전체를 다시 해야 한다'),

  item('i-floor-1', 'floor', '시공 전에 모래·시멘트 가루를 청소기로 치웠는지 본다'),
  item('i-floor-2', 'floor', '깨지거나 꺼진 바닥을 먼저 평탄하게 메웠는지 본다'),
  item('i-floor-3', 'floor', '장판 이음새가 벌어지지 않게 맞췄는지 본다'),
  item('i-floor-4', 'floor', '벽에 닿는 가장자리가 울거나 뜨지 않고 붙었는지 본다'),
  item('i-floor-5', 'floor', '손실분을 감안해 넉넉히 주문했는지 확인한다'),
  item('i-floor-6', 'floor', '도배지와 만나는 부분, 걸레받이 마감을 도배·장판 두 공정을 함께 놓고 확인한다'),
];
