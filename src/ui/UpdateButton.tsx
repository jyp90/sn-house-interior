import { useState } from 'react';
import { requestUpdate, updateBannerText, waitForRestart } from './selfUpdateClient';
import { useUi } from './uiStore';

// dev 서버에서만 보인다(스펙 §18). 원격 코드를 받고 서버가 다시 켜지면 새로고침한다. 편집 중인 평면은 pagehide 때 저장된다.
export function UpdateButton() {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    const ui = useUi.getState();
    setBusy(true);
    const r = await requestUpdate();
    ui.showBanner(updateBannerText(r));
    if (r.status !== 'updated') {
      setBusy(false);
      return;
    }
    if (await waitForRestart(r.boot)) {
      window.location.reload();
      return;
    }
    ui.showBanner({ kind: 'error', text: '서버가 다시 켜지지 않았습니다. 터미널에서 npm run dev를 확인하세요.' });
    setBusy(false);
  };

  return (
    <button type="button" disabled={busy} onClick={() => void onClick()} title="원격 저장소의 새 코드를 받아 앱을 다시 시작합니다">
      {busy ? '업데이트 중…' : '업데이트'}
    </button>
  );
}
