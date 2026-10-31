import { useRef, useState } from 'react';
import type { Book, BookMetadata } from '../domain';
import { normalizeMetadata } from '../libraryModel';
import { useDialogFocus } from '../hooks/useDialogFocus';

export default function BookEditor({ book, seriesNames, save, cancel }: { book: Book; seriesNames: string[]; save: (metadata: BookMetadata) => Promise<void>; cancel: () => void }) {
  const [value, setValue] = useState<BookMetadata>({ title: book.title, series: book.series || '', chapter: book.chapter || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const dialog = useRef<HTMLElement>(null);
  useDialogFocus(dialog, cancel, saving);

  async function submit() {
    if (running.current) return;
    setError('');
    try {
      const metadata = normalizeMetadata(value);
      running.current = true; setSaving(true);
      await save(metadata);
    } catch (error) { setError(String(error instanceof Error ? error.message : error)); }
    finally { running.current = false; setSaving(false); }
  }

  return <div className="modal-backdrop"><section ref={dialog} className="modal metadata-modal" role="dialog" aria-modal="true" aria-labelledby="edit-book-title" aria-describedby="edit-book-help">
    <p className="eyebrow">ORGANIZE SUA COLEÇÃO</p><h2 id="edit-book-title">Editar dados do volume</h2>
    <p id="edit-book-help">Título, série e capítulo são salvos na biblioteca. Seus arquivos e seu progresso permanecem intactos.</p>
    <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label>Título do volume<input aria-label="Título do volume" required maxLength={512} disabled={saving} value={value.title} onChange={event => setValue({ ...value, title: event.target.value })}/></label>
      <label>Série<input aria-label="Série do volume" list="known-series" maxLength={256} disabled={saving} placeholder="Ex.: Aurora" value={value.series} onChange={event => setValue({ ...value, series: event.target.value })}/></label>
      <datalist id="known-series">{seriesNames.map(name => <option key={name} value={name}/>)}</datalist>
      <label>Capítulo ou volume<input aria-label="Capítulo ou volume" maxLength={80} disabled={saving} placeholder="Ex.: 2, 2.5, Especial ou Vol. 1" value={value.chapter} onChange={event => setValue({ ...value, chapter: event.target.value })}/></label>
      <p className="muted">Deixe série e capítulo em branco para manter o volume avulso. Use o mesmo nome de série para reunir capítulos.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="secondary-button" type="button" disabled={saving} onClick={cancel}>Cancelar edição</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar dados'}</button></div>
    </form>
  </section></div>;
}
