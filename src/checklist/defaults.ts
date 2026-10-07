export type Phase = 'demolition' | 'carpentry' | 'tile' | 'wallpaper' | 'floor' | 'kitchen';

export type ChecklistItem = { id: string; phase: Phase; text: string; auto: boolean };

export const PHASES: { id: Phase; label: string }[] = [
  { id: 'demolition', label: '철거' },
  { id: 'carpentry', label: '목공·전기' },
  { id: 'tile', label: '타일' },
  { id: 'wallpaper', label: '도배' },
  { id: 'floor', label: '바닥' },
  { id: 'kitchen', label: '주방' },
];

const item = (id: string, phase: Phase, text: string): ChecklistItem => ({ id, phase, text, auto: false });

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  item('demo-1', 'demolition', '철거 범위(벽·바닥재·천장·붙박이장)를 도면에 표시해 업체와 같은 기준으로 확인한다'),
  item('demo-2', 'demolition', '관리사무소 공사 신고와 이웃 동의서 제출 일정을 확인한다'),
  item('demo-3', 'demolition', '엘리베이터 보양과 폐기물 반출 방법, 비용 부담 주체를 정한다'),
  item('demo-4', 'demolition', '철거 후 드러난 배관·누수·결로 흔적을 사진으로 남긴다'),
  item('carp-1', 'carpentry', '문틀·문짝 교체 여부와 문 열림 방향을 도면 기준으로 확정한다'),
  item('carp-2', 'carpentry', '콘센트·스위치 위치와 높이를 전기 계획도대로 표시해 전달한다'),
  item('carp-3', 'carpentry', '고전력 가전의 전용회로 개수와 분전반의 여유 회로를 확인한다'),
  item('carp-4', 'carpentry', '조명 위치와 매입등 여부, 스위치마다 켜질 조명 묶음을 정한다'),
  item('carp-5', 'carpentry', '커튼박스·몰딩·걸레받이를 둘지와 치수를 정한다'),
  item('tile-1', 'tile', '욕실·현관·주방 벽 타일 규격과 줄눈 색을 정한다'),
  item('tile-2', 'tile', '욕실 바닥의 배수 방향 기울기와 방수 범위를 확인한다'),
  item('tile-3', 'tile', '수전·샤워기·욕실장 높이를 타일 시공 전에 정한다'),
  item('tile-4', 'tile', '보수용 여분 타일을 남겨 달라고 요청한다'),
  item('wall-1', 'wallpaper', '벽지 종류(합지·실크)와 색상, 천장 포함 여부를 정한다'),
  item('wall-2', 'wallpaper', '도배 전 벽면 퍼티·평탄화 범위를 확인한다'),
  item('wall-3', 'wallpaper', '콘센트·스위치 커버를 도배 후 다시 다는 순서를 확인한다'),
  item('wall-4', 'wallpaper', '곰팡이·결로가 있던 벽은 단열·방습 처리를 할지 정한다'),
  item('floor-1', 'floor', '바닥재 종류(강마루·강화마루·장판·타일)와 색상을 정한다'),
  item('floor-2', 'floor', '바닥재 시공 범위(발코니·현관 포함 여부)와 문턱 제거 여부를 정한다'),
  item('floor-3', 'floor', '바닥 수평 상태와 난방 배관 위치를 시공 전에 확인한다'),
  item('floor-4', 'floor', '가구·가전 반입 일정을 바닥 시공과 양생이 끝난 뒤로 잡는다'),
  item('kit-1', 'kitchen', '싱크대 상판 재질과 하부장·상부장 치수를 도면 기준으로 확정한다'),
  item('kit-2', 'kitchen', '빌트인 가전(식기세척기·인덕션 등) 모델과 매립 치수를 미리 전달한다'),
  item('kit-3', 'kitchen', '냉장고 자리의 폭·깊이·높이와 문 열림 여유를 실측으로 확인한다'),
  item('kit-4', 'kitchen', '수전·배수 위치와 정수기·음식물처리기 설치 여부를 정한다'),
  item('kit-5', 'kitchen', '후드 위치와 배기 덕트 경로를 확인한다'),
];
