import { useEffect, useState } from 'react';
import homePreset from 'virtual:home-preset';
import { usePlanStore } from '../model/StoreContext';
import { planToJson } from '../persistence/file';
import { getFile, GITHUB_ERRORS, putFile } from '../persistence/github';
import { getDefaultImageStore } from '../persistence/images';
import { prepareHomePreset } from '../persistence/homePreset';
import { formatSyncStatus, readSyncConfig, shortSha, syncCommitMessage, SYNC_TOKEN_HELP, writeSyncConfig, type SyncConfig } from '../persistence/sync';
import { useUi } from './uiStore';

// GitHub 저장소의 home/plan.json을 기기 간 공유 저장소로 쓴다(스펙 §45.2)
export function SyncPanel() {
  const store = usePlanStore();
  const open = useUi((s) => s.syncOpen);
  const [cfg, setCfg] = useState<SyncConfig>(() => readSyncConfig());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setCfg(readSyncConfig());
  }, [open]);

  if (!open) return null;
  const ui = useUi.getState();

  const update = (patch: Partial<SyncConfig>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    writeSyncConfig(next);
  };

  const ref = () => ({ repo: cfg.repo.trim(), branch: cfg.branch.trim(), path: cfg.path.trim(), token: cfg.token.trim() || undefined });

  const pull = async () => {
    setBusy(true);
    try {
      const r = await getFile(ref());
      if (!r.ok) {
        ui.showBanner({ kind: 'error', text: `GitHub에서 불러오지 못했습니다: ${r.error}` });
        return;
      }
      let raw: unknown;
      try {
        raw = JSON.parse(r.text);
      } catch {
        ui.showBanner({ kind: 'error', text: 'GitHub의 파일이 JSON 형식이 아닙니다' });
        return;
      }
      // 프리셋과 같은 이미지 ref를 쓰므로 번들의 평면도 이미지를 확보한다. 기기에 올린 다른 배경 이미지는 동기화되지 않는다
      const prepared = await prepareHomePreset({ plan: raw, imageUrl: homePreset?.imageUrl ?? null }, getDefaultImageStore());
      if (!prepared.ok) {
        ui.showBanner({ kind: 'error', text: `GitHub의 평면을 읽을 수 없습니다: ${prepared.error}` });
        return;
      }
      store.getState().replacePlan(prepared.plan);
      ui.resetView();
      update({ lastSha: r.sha, lastAt: Date.now() });
      ui.showBanner({ kind: 'info', text: `GitHub에서 평면을 불러왔습니다(${shortSha(r.sha)}). 실행 취소로 되돌릴 수 있습니다.` });
    } finally {
      setBusy(false);
    }
  };

  const push = async () => {
    const token = cfg.token.trim();
    if (!token) return;
    setBusy(true);
    try {
      const current = await getFile(ref());
      let sha: string | undefined;
      if (current.ok) {
        sha = current.sha;
        if (cfg.lastSha && cfg.lastSha !== current.sha) {
          if (!window.confirm('GitHub의 평면이 마지막 동기화 이후 바뀌었습니다. 지금 평면으로 덮어쓸까요?')) return;
        }
      } else if (current.error !== GITHUB_ERRORS.notFound) {
        ui.showBanner({ kind: 'error', text: `GitHub에 저장하지 못했습니다: ${current.error}` });
        return;
      }
      const now = new Date();
      const r = await putFile({ ...ref(), token, text: `${planToJson(store.getState().plan)}\n`, sha, message: syncCommitMessage(now) });
      if (!r.ok) {
        ui.showBanner({ kind: 'error', text: `GitHub에 저장하지 못했습니다: ${r.error}` });
        return;
      }
      update({ lastSha: r.sha, lastAt: now.getTime() });
      ui.showBanner({ kind: 'info', text: `GitHub에 저장했습니다(${shortSha(r.sha)}). 1–2분 뒤 배포에 반영됩니다.` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sync" role="dialog" aria-label="GitHub 동기화" data-testid="sync-panel">
      <div className="sync-head">
        <h3>GitHub 동기화</h3>
        <button type="button" aria-label="닫기" onClick={() => ui.setSyncOpen(false)}>×</button>
      </div>
      <label className="field">
        저장소
        <input aria-label="저장소" placeholder="owner/name" value={cfg.repo} onChange={(e) => update({ repo: e.target.value })} />
      </label>
      <label className="field">
        브랜치
        <input aria-label="브랜치" value={cfg.branch} onChange={(e) => update({ branch: e.target.value })} />
      </label>
      <label className="field">
        파일
        <input aria-label="파일" value={cfg.path} onChange={(e) => update({ path: e.target.value })} />
      </label>
      <label className="field">
        토큰
        <input aria-label="토큰" type="password" autoComplete="off" value={cfg.token} onChange={(e) => update({ token: e.target.value })} />
        <span className="help">{SYNC_TOKEN_HELP}</span>
      </label>
      <p className="sync-status" role="status" data-testid="sync-status">{formatSyncStatus(cfg)}</p>
      <div className="row">
        <button type="button" disabled={busy} onClick={() => void pull()}>불러오기</button>
        <button type="button" disabled={busy || cfg.token.trim() === ''} onClick={() => void push()}>GitHub에 저장</button>
        <button type="button" onClick={() => ui.setSyncOpen(false)}>닫기</button>
      </div>
    </div>
  );
}
