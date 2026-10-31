import { useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { desktop } from '../services/library';
import { backup, type RestorePreview } from '../services/backup';

export interface BackupActions {
  beforeBackup: () => Promise<void>;
  onRestored: () => Promise<void>;
  trackTask: (task: Promise<unknown>) => void;
  reportError: (error: unknown) => void;
}

export default function BackupPanel({ beforeBackup, onRestored, trackTask, reportError }: BackupActions) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [includeSettings, setIncludeSettings] = useState(true);
  const [message, setMessage] = useState('');
  const dialog = useRef<HTMLElement>(null);
  const running = useRef(false);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function run(operation: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage('');
    const task = operation();
    trackTask(task);
    try { await task; } catch (error) { reportError(error); }
    finally { running.current = false; if (mounted.current) setBusy(false); }
  }

  async function cancel() {
    if (!preview || busy) return;
    const token = preview.token;
    await run(async () => { await backup.cancel(token); if (mounted.current) setPreview(null); });
  }

  useEffect(() => {
    if (!preview) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!busy) void cancel(); }
      if (event.key !== 'Tab') return;
      const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []);
      if (!elements.length) { event.preventDefault(); return; }
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  });

  return <section className="settings-card backup-card">
    <h2>Backup dos dados de leitura</h2>
    <p className="muted">Guarde progresso, favoritos, páginas marcadas e configurações em um arquivo. <strong>As imagens e os arquivos dos mangás não são incluídos.</strong></p>
    <div className="backup-actions">
      <button className="secondary-button" disabled={!desktop || busy} onClick={() => void run(async () => {
        await beforeBackup();
        const path = await backup.export();
        if (mounted.current && path) setMessage(`Backup de leitura salvo em: ${path}`);
      })}><Download size={16}/>Exportar dados de leitura</button>
      <button className="secondary-button" disabled={!desktop || busy} onClick={() => void run(async () => {
        await beforeBackup();
        const result = await backup.preview();
        if (mounted.current && result) { setIncludeSettings(result.settingsIncluded); setPreview(result); }
      })}><Upload size={16}/>Selecionar backup para restaurar</button>
    </div>
    {!desktop && <p className="muted">Disponível no aplicativo desktop.</p>}
    {busy && <p className="muted" role="status">Aguarde a operação ou conclua a seleção na janela de arquivos.</p>}
    {message && <p className="backup-message" role="status">{message}</p>}
    {preview && <div className="modal-backdrop"><section ref={dialog} className="modal backup-modal" role="dialog" aria-modal="true" aria-labelledby="restore-title" aria-describedby="restore-description">
      <p className="eyebrow">REVISAR ANTES DE RESTAURAR</p>
      <h2 id="restore-title">Restaurar dados de leitura?</h2>
      <p id="restore-description">O progresso, os favoritos e os marcadores dos volumes compatíveis serão substituídos. Uma cópia dos dados atuais será salva antes da restauração. Os arquivos dos mangás permanecem intactos.</p>
      <p className="muted">{preview.organizationIncluded ? 'Este backup também substituirá os títulos, as séries e os capítulos dos volumes compatíveis.' : 'Este backup antigo não altera os títulos, as séries e os capítulos atuais.'}</p>
      <p>Backup de {new Date(preview.createdAt * 1000).toLocaleString('pt-BR')}</p>
      <div className="restore-counts"><strong>{preview.matched} compatíveis</strong><span>{preview.skipped} ignorados</span></div>
      <ul className="restore-list">{preview.rows.map((row, index) => <li key={index}><strong>{row.title}</strong><span className={row.matched ? 'restore-match' : ''}>{row.matched ? 'Restaurar' : 'Ignorar'} · {row.reason}</span></li>)}</ul>
      {!preview.rows.length && <p>Este backup contém apenas configurações.</p>}
      <label className="restore-settings"><input type="checkbox" checked={includeSettings} disabled={busy || !preview.settingsIncluded} onChange={event => setIncludeSettings(event.target.checked)}/>Restaurar também as configurações</label>
      {!preview.settingsIncluded && <p className="muted">Este backup não contém configurações.</p>}
      <div className="modal-actions"><button autoFocus className="secondary-button" disabled={busy} onClick={() => void cancel()}>Cancelar restauração</button><button className="primary-button" disabled={busy || (!preview.matched && !(includeSettings && preview.settingsIncluded))} onClick={() => void run(async () => {
        const result = await backup.apply(preview.token, includeSettings);
        // The commit already succeeded even if refreshing the UI later fails.
        if (mounted.current) {
          setPreview(null);
          setMessage(`${result.restored} volumes restaurados; ${result.skipped} ignorados. ${result.settingsRestored ? 'Configurações restauradas. ' : ''}${result.organizationRestored ? 'Organização restaurada. ' : ''}Cópia anterior salva em: ${result.recoveryPath}`);
        }
        await onRestored();
      })}>{busy ? 'Restaurando…' : 'Confirmar restauração'}</button></div>
    </section></div>}
  </section>;
}
