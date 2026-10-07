import { useState } from 'react';
import { exportPdf } from '../export/exportPdf';
import { PdfFontError } from '../export/pdfFont';
import { activeLayout } from '../model/layout';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { downloadBlob } from '../persistence/file';
import { OptionalNumberField, TextAreaField, TextField } from './fields';

type Status =
  | { state: 'idle' }
  | { state: 'working'; done: number; total: number }
  | { state: 'done'; pages: number }
  | { state: 'error'; message: string };

const PAGE_LIST = '표지, 치수 평면도, 가구·가전 배치도, 전기 계획도, 빌트인 상세, 제품 목록, 3D 보기, 공사 체크리스트';

function statusText(s: Status): string {
  switch (s.state) {
    case 'idle':
      return '';
    case 'working':
      return s.total === 0 ? 'PDF 준비 중… 글꼴을 불러오고 있습니다.' : `PDF 만드는 중… ${s.done}/${s.total}쪽`;
    case 'done':
      return `PDF를 저장했습니다 (${s.pages}쪽)`;
    case 'error':
      return s.message;
  }
}

export function ExportView() {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const s = store.getState();
  const info = plan.info;
  const layout = activeLayout(plan);

  const run = async () => {
    setStatus({ state: 'working', done: 0, total: 0 });
    try {
      const r = await exportPdf(store.getState().plan, (done, total) => setStatus({ state: 'working', done, total }));
      downloadBlob(r.blob, r.fileName);
      setStatus({ state: 'done', pages: r.pageCount });
    } catch (e) {
      setStatus({
        state: 'error',
        message:
          e instanceof PdfFontError
            ? '글꼴을 불러오지 못했습니다. 네트워크 연결을 확인하고 다시 시도하세요.'
            : 'PDF를 만들지 못했습니다. 다시 시도하세요.',
      });
    }
  };

  return (
    <div className="export-view" data-testid="export-view">
      <h2>업체 전달 자료 (PDF)</h2>
      <section>
        <h3>기본 정보</h3>
        <div className="info-grid">
          <TextField label="제목" value={info.title} onCommit={(v) => s.updateInfo({ title: v })} />
          <TextField label="주소" value={info.address ?? ''} allowEmpty onCommit={(v) => s.updateInfo({ address: v })} />
          <OptionalNumberField label="공급면적" unit="m²" value={info.supplyArea} onCommit={(v) => s.updateInfo({ supplyArea: v })} />
          <OptionalNumberField label="전용면적" unit="m²" value={info.exclusiveArea} onCommit={(v) => s.updateInfo({ exclusiveArea: v })} />
          <OptionalNumberField label="준공연도" unit="년" integer value={info.builtYear} onCommit={(v) => s.updateInfo({ builtYear: v })} />
          <TextField label="입주 예정일" value={info.moveInDate ?? ''} allowEmpty onCommit={(v) => s.updateInfo({ moveInDate: v })} />
          <TextField label="공사 범위" value={info.scope ?? ''} allowEmpty onCommit={(v) => s.updateInfo({ scope: v })} />
        </div>
        <TextAreaField label="메모" value={info.notes ?? ''} onCommit={(v) => s.updateInfo({ notes: v })} />
        <p className="muted">주소 등 기본 정보는 이 브라우저 저장소, JSON 파일, 내려받은 PDF에만 들어갑니다.</p>
      </section>
      <section>
        <h3>PDF</h3>
        <label className="field">
          기준 배치안
          <select value={layout.id} onChange={(e) => s.switchLayout(e.target.value)}>
            {plan.layouts.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <p className="muted">포함 쪽: {PAGE_LIST}. 배치도·제품 목록·자동 체크리스트는 기준 배치안으로 만듭니다.</p>
        <div className="row">
          <button type="button" disabled={status.state === 'working'} onClick={run}>PDF 내려받기</button>
          {status.state === 'error' && <button type="button" onClick={run}>다시 시도</button>}
        </div>
        <p className={status.state === 'error' ? 'pdf-status error' : 'pdf-status'} data-testid="pdf-status" role="status">
          {statusText(status)}
        </p>
      </section>
    </div>
  );
}
