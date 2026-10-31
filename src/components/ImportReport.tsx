import { useRef, useState } from 'react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { filterImportItems, importStatusLabels, importSummary, type ImportReport as Report, type ImportStatus } from '../importModel';

export default function ImportReport({ report, close }: { report: Report; close: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  const [filter, setFilter] = useState<ImportStatus | 'all'>('all');
  const summary = importSummary(report);
  const items = filterImportItems(report,filter);
  useDialogFocus(dialog,close,false);

  return <div className="modal-backdrop"><section ref={dialog} className="modal import-report" role="dialog" aria-modal="true" aria-labelledby="import-report-title" aria-describedby="import-report-help">
    <p className="eyebrow">IMPORTAÇÃO EM LOTE</p><h2 id="import-report-title">Resultado da importação</h2>
    <p id="import-report-help">Cada arquivo foi tratado separadamente. Os volumes adicionados permanecem na biblioteca mesmo quando outro arquivo falha. Os arquivos originais permanecem intactos.</p>
    <div className="import-counts" aria-label="Resumo do lote"><span><strong>{summary.added}</strong> {summary.added === 1 ? 'adicionado' : 'adicionados'}</span><span><strong>{summary.existing}</strong> {summary.existing === 1 ? 'já existente' : 'já existentes'}</span><span><strong>{summary.failed}</strong> {summary.failed === 1 ? 'falha' : 'falhas'}</span></div>
    <label className="import-result-filter">Mostrar<select aria-label="Filtrar resultado da importação" value={filter} onChange={event => setFilter(event.target.value as ImportStatus | 'all')}><option value="all">Todos ({summary.total})</option><option value="added">Adicionados ({summary.added})</option><option value="existing">Já existentes ({summary.existing})</option><option value="failed">Falhas ({summary.failed})</option></select></label>
    <ul className="import-results">{items.map((item,index) => <li key={`${item.name}-${index}`}><div><strong>{item.name}</strong><span className={`import-status ${item.status}`}>{importStatusLabels[item.status]}</span></div>{item.title && item.title !== item.name && <span className="import-book-title">Na biblioteca: {item.title}</span>}<p>{item.message}</p></li>)}</ul>
    {!items.length && <p className="muted">Nenhum arquivo nesta categoria.</p>}
    <p className="muted">As falhas podem ser tentadas novamente pelo menu de importação. A organização por série e capítulo é feita pelo lápis em cada volume.</p>
    <div className="modal-actions"><button className="primary-button" onClick={close}>Fechar resultado</button></div>
  </section></div>;
}
