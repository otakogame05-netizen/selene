import {useReaderFullscreen} from '../hooks/useReaderFullscreen';
import ReaderImage from './ReaderImage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bookmark, ChevronLeft, ChevronRight, Expand, List, Minimize, Settings2, X } from 'lucide-react';
import { clampPage, modeLabels, pageGroup, type BookPages, type ReadMode, type Settings } from '../domain';
import { library } from '../services/library';
import { WriteQueue } from '../services/writeQueue';
export default function Reader({ data, settings, update, close, reportError, registerFlush }: { data: BookPages; settings: Settings; update: (s: Settings) => void; close: () => void; reportError: (error: unknown) => void; registerFlush: (flush: (() => Promise<void>) | null) => void }) {
  const [page, setPage] = useState(data.book.page);
  const [tools, setTools] = useState(true);
  const [pause, setPause] = useState(false);
  const {full,toggle:toggleFullscreen}=useReaderFullscreen(reportError);
  const [zoom, setZoom] = useState(100);
  const [bookmarks, setBookmarks] = useState(data.bookmarks ?? []);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [panel, setPanel] = useState<'bookmarks' | 'options' | null>(null);
  const [pageDraft, setPageDraft] = useState(String(data.book.page + 1));
  const [saveState, setSaveState] = useState<'pending' | 'saving' | 'saved' | 'error'>('pending');
  const [closing, setClosing] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const restoringScroll = useRef(false);
  const initialScroll = useRef(data.book.page);
  const current = useRef(page);
  const saveQueue = useMemo(() => new WriteQueue<{ page: number; completed: boolean }>(value => library.saveProgress(data.book.id, value.page, value.completed)), [data.book.id]);
  const saveVersion = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const leaving = useRef(false);
  const flushing = useRef(0);
  const bookmarkTask = useRef<Promise<void>>(Promise.resolve());
  const changingBookmark = useRef(false);
  const isScroll = settings.mode === 'vertical' || settings.mode === 'webtoon';
  const changePage = useCallback((n: number) => { if (leaving.current || flushing.current > 0) return; const value = clampPage(n, data.pages.length); if (value === current.current) return; current.current = value; setPage(value); setSaveState('pending'); }, [data.pages.length]);
  const move = useCallback((delta: number) => {
    const next = clampPage(current.current + delta * (settings.mode === 'double' ? 2 : 1), data.pages.length);
    changePage(next);
    if (isScroll) scroll.current?.querySelector(`[data-page="${next}"]`)?.scrollIntoView({ block: 'start' });
  }, [changePage, settings.mode, data.pages.length, isScroll]);
  useEffect(() => { setPageDraft(String(page + 1)); }, [page]);
  const persist = useCallback(async (p: number) => {
    const version = ++saveVersion.current;
    setSaveState('saving');
    try {
      await saveQueue.push({ page: p, completed: p >= data.pages.length - (settings.mode === 'double' ? 2 : 1) });
      if (version === saveVersion.current && current.current === p) setSaveState('saved');
    } catch (error) { if (version === saveVersion.current) setSaveState('error'); throw error; }
  }, [data.pages.length, saveQueue, settings.mode]);
  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current); flushing.current += 1; setClosing(true);
    try { await Promise.all([persist(current.current), bookmarkTask.current]); }
    finally { flushing.current -= 1; if (flushing.current === 0) setClosing(false); }
  }, [persist]);
  useEffect(() => { registerFlush(flush); return () => registerFlush(null); }, [flush, registerFlush]);
  useEffect(() => { saveTimer.current = setTimeout(() => { void persist(page).catch(reportError); }, 350); return () => clearTimeout(saveTimer.current); }, [page, persist, reportError]);
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') void flush().catch(reportError); };
    document.addEventListener('visibilitychange', hidden); return () => document.removeEventListener('visibilitychange', hidden);
  }, [flush, reportError]);
  useEffect(() => { if (!settings.guardian) return; const timer = setInterval(() => setPause(true), settings.breakMinutes * 60_000); return () => clearInterval(timer); }, [settings.guardian, settings.breakMinutes]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (pause || leaving.current || flushing.current > 0 || (e.target as HTMLElement).closest('input, select, button, textarea')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); move(settings.direction === 'rtl' ? -1 : 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(settings.direction === 'rtl' ? 1 : -1); }
      if (e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); if (isScroll) scroll.current?.scrollBy({ top: window.innerHeight * .8, behavior: 'smooth' }); else move(1); }
      if (e.key === 'PageUp') { e.preventDefault(); if (isScroll) scroll.current?.scrollBy({ top: -window.innerHeight * .8, behavior: 'smooth' }); else move(-1); }
      if (e.key.toLowerCase() === 'h') setTools(v => !v);
      if (e.key === 'Escape') {setPanel(null);setTools(true);}
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [move, settings.direction, isScroll, pause]);
  useEffect(() => {
    if (!isScroll) { initialScroll.current = current.current; return; }
    let cancelled = false;
    restoringScroll.current = true;
    const target = initialScroll.current;
    const images = Array.from(scroll.current?.querySelectorAll<HTMLImageElement>('img') ?? []).slice(0, target + 1);
    void Promise.all(images.map(img => img.decode().catch(() => undefined))).then(() => {
      if (cancelled) return;
      scroll.current?.querySelector(`[data-page="${target}"]`)?.scrollIntoView({ block: 'start' });
      requestAnimationFrame(() => { if (!cancelled) restoringScroll.current = false; });
    });
    return () => { cancelled = true; restoringScroll.current = false; initialScroll.current = current.current; };
  }, [isScroll]);
  async function finish() {
    if (leaving.current) return;
    leaving.current = true; setClosing(true);
    try { await flush(); close(); }
    catch (error) { reportError(`O leitor continua aberto porque não foi possível salvar. Tente novamente. ${String(error)}`); }
    finally { leaving.current = false; setClosing(false); }
  }
  function toggleBookmark() {
    if (changingBookmark.current || leaving.current || flushing.current > 0) return;
    changingBookmark.current = true; setBookmarkBusy(true);
    const target = current.current; const marked = !bookmarks.includes(target);
    bookmarkTask.current = library.bookmark(data.book.id, target, marked).then(() => {
      setBookmarks(previous => marked ? [...new Set([...previous, target])].sort((a,b) => a-b) : previous.filter(value => value !== target));
    }).catch(reportError).finally(() => { changingBookmark.current = false; setBookmarkBusy(false); });
  }
  function jump(n: number) { if (leaving.current || flushing.current > 0) return; const value = clampPage(n, data.pages.length); changePage(value); if (isScroll) scroll.current?.querySelector(`[data-page="${value}"]`)?.scrollIntoView({ block: 'start' }); }
  function onScroll() {
    const root = scroll.current; if (!root || !isScroll || restoringScroll.current) return;
    const y = root.getBoundingClientRect().top + Math.min(root.clientHeight * .25, 150);
    const elements = Array.from(root.querySelectorAll<HTMLElement>('[data-page]'));
    const active = elements.find(el => el.getBoundingClientRect().bottom > y);
    if (active) changePage(Number(active.dataset.page));
  }
  return <div className={`reader ${tools ? '' : 'hide-tools'}`}>
    <header className="reader-header"><button className="icon-button" disabled={closing} onClick={() => void finish()} aria-label="Voltar à biblioteca"><ArrowLeft size={20}/></button><div className="reader-title"><strong>{data.book.title}</strong><span>{modeLabels[settings.mode]} · {settings.direction === 'rtl' ? 'Direita para esquerda' : 'Esquerda para direita'}</span></div><select disabled={closing} aria-label="Modo de leitura" value={settings.mode} onChange={e => update({ ...settings, mode: e.target.value as ReadMode })}>{Object.entries(modeLabels).map(([key, name]) => <option value={key} key={key}>{name}</option>)}</select><button className="icon-button" aria-label="Alternar tela cheia" onClick={() => toggleFullscreen()}>{full ? <Minimize size={20}/> : <Expand size={20}/>}</button><button className="icon-button" aria-label="Ocultar controles (H)" onClick={() => setTools(false)}><X size={20}/></button></header>
    {!tools && <button className="show-tools icon-button" aria-label="Mostrar controles (H)" onClick={() => setTools(true)}><Settings2 size={20}/></button>}
    <div className="reader-toolbar">
      <button className={`icon-button ${bookmarks.includes(page) ? 'marked' : ''}`} disabled={bookmarkBusy} aria-pressed={bookmarks.includes(page)} aria-label={bookmarks.includes(page) ? 'Remover marcador desta página' : 'Marcar esta página'} onClick={toggleBookmark}><Bookmark size={18} fill={bookmarks.includes(page) ? 'currentColor' : 'none'}/></button>
      <button className="reader-tool-button" aria-expanded={panel === 'bookmarks'} onClick={() => setPanel(panel === 'bookmarks' ? null : 'bookmarks')}><List size={17}/>Páginas marcadas <span>{bookmarks.length}</span></button>
      <button className="reader-tool-button" aria-expanded={panel === 'options'} onClick={() => setPanel(panel === 'options' ? null : 'options')}><Settings2 size={16}/>Opções de leitura</button>
      <form className="page-jump" onSubmit={event => { event.preventDefault(); jump((Number(pageDraft) || 1) - 1); setPageDraft(String(current.current + 1)); }}><label htmlFor="page-jump">Ir à página</label><input id="page-jump" aria-label="Ir para a página" type="number" min="1" max={data.pages.length} value={pageDraft} onChange={event => setPageDraft(event.target.value)}/><button type="submit">Ir</button></form>
      <div className={`save-state ${saveState}`} role="status">{saveState === 'saved' ? 'Salvo' : saveState === 'saving' ? 'Salvando…' : saveState === 'error' ? 'Falha ao salvar' : 'Não salvo'}{saveState === 'error' && <button onClick={() => void flush().catch(reportError)}>Tentar novamente</button>}</div>
    </div>
    {tools && panel && <section className="reader-panel" aria-label={panel === 'bookmarks' ? 'Páginas marcadas' : 'Opções de leitura'}>
      <div className="reader-panel-heading"><h2>{panel === 'bookmarks' ? 'Páginas marcadas' : 'Opções de leitura'}</h2><button className="icon-button" aria-label="Fechar painel" onClick={() => setPanel(null)}><X size={17}/></button></div>
      {panel === 'bookmarks' ? <><p className="muted">Seus marcadores são guardados neste volume.</p>{bookmarks.length ? <div className="bookmark-list">{bookmarks.map(value => <button className={value === page ? 'selected' : ''} key={value} onClick={() => { jump(value); setPanel(null); }}>Página {value + 1}</button>)}</div> : <p className="muted">Nenhuma página marcada. Use o ícone de marcador para guardar uma página.</p>}</> : <>
        <label>Direção<select disabled={closing} aria-label="Direção no leitor" value={settings.direction} onChange={event => update({ ...settings, direction: event.target.value as Settings['direction'] })}><option value="rtl">Direita para esquerda</option><option value="ltr">Esquerda para direita</option></select></label>
        <label>Ajuste<select disabled={closing} aria-label="Ajuste no leitor" value={settings.fit} onChange={event => update({ ...settings, fit: event.target.value as Settings['fit'] })}><option value="contain">Página inteira</option><option value="width">Largura disponível</option></select></label><p className="muted">← → Navegar · Espaço Avançar · H Controles</p>
      </>}
    </section>}
    <div ref={scroll} onScroll={onScroll} className={`reader-canvas ${isScroll ? 'scroll-mode' : 'paged-mode'} ${settings.mode} fit-${settings.fit}`}>
      {isScroll ? <div className="page-stack" style={{ width: `${zoom}%` }}>{data.pages.map((path, index) => <div key={path} data-page={index}><ReaderImage path={path} id={data.book.id} index={index} active={index === page}/></div>)}</div> : <div className={`page-spread ${settings.direction}`} style={{ width: `${zoom}%`, height: settings.fit === 'contain' ? `${zoom}%` : 'auto', flex: 'none' }}>{pageGroup(page, data.pages.length, settings.mode).map(index => <ReaderImage key={index} path={data.pages[index]} id={data.book.id} index={index} active={true}/>)}</div>}
    </div>
    <footer className="reader-footer"><button className="icon-button" disabled={page === 0} aria-label="Página anterior" onClick={() => jump(clampPage(page - (settings.mode === 'double' ? 2 : 1), data.pages.length))}><ChevronLeft size={20}/></button><span className="page-counter">{page + 1} / {data.pages.length}</span><input aria-label="Página" type="range" min="0" max={data.pages.length - 1} value={page} onChange={e => jump(Number(e.target.value))}/><button className="icon-button" disabled={pageGroup(page, data.pages.length, settings.mode).at(-1) === data.pages.length - 1} aria-label="Próxima página" onClick={() => jump(clampPage(page + (settings.mode === 'double' ? 2 : 1), data.pages.length))}><ChevronRight size={20}/></button><select aria-label="Zoom" value={zoom} onChange={e => setZoom(Number(e.target.value))}>{[75,100,125,150,200].map(z => <option key={z} value={z}>{z}%</option>)}</select><span className="shortcut">H: controles</span></footer>
    {pause && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="pause-title"><p className="eyebrow">GUARDIÃO</p><h2 id="pause-title">Uma pausa também faz parte.</h2><p>Descanse os olhos, alongue o corpo e beba um pouco de água. Seu progresso é salvo automaticamente; confira o estado na barra de leitura.</p><button autoFocus className="primary-button" onClick={() => setPause(false)}>Continuar leitura</button><button className="text-button" disabled={closing} onClick={() => void finish()}>Voltar à biblioteca</button></section></div>}
  </div>;
}
