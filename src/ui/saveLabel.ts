import type { SaveStatus } from './uiStore';

const two = (n: number) => String(n).padStart(2, '0');

export function saveLabel(s: SaveStatus): string {
  switch (s.state) {
    case 'clean':
      return '변경 없음';
    case 'pending':
      return '저장 중…';
    case 'error':
      return '저장 실패';
    case 'saved': {
      const d = new Date(s.at ?? Date.now());
      return `저장됨 ${two(d.getHours())}:${two(d.getMinutes())}`;
    }
  }
}
