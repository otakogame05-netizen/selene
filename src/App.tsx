import seleneIcon from './assets/selene-moon.svg?no-inline';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Library, Heart, Settings2, Search, Plus, FolderOpen, Archive, ArrowUpRight, Clock3, ShieldCheck, LayoutGrid, X, LoaderCircle, Compass } from 'lucide-react';
import { defaults, type Book, type BookMetadata, type BookPages, type Settings } from './domain';
import { desktop, library } from './services/library';
import SettingsPanel from './components/SettingsPanel';
import Reader from './components/Reader';
import OnlinePanel from './components/OnlinePanel';
import { suwayomi, type SiteReading, type OnlineFavorite } from './services/suwayomi';
import SiteReader from './components/SiteReader';
import RecentSiteReadings from './components/RecentSiteReadings';
import CatalogMangaCard from './components/CatalogMangaCard';
import { WriteQueue } from './services/writeQueue';
import { useDesktopClose } from './hooks/useDesktopClose';
import { PendingTasks } from './services/pendingTasks';
import BookCard from './components/BookCard';
import BookEditor from './components/BookEditor';
import { selectBooks, seriesKey, seriesOptions, type LibraryView } from './libraryModel';
import ImportReport from './components/ImportReport';
import WelcomeScreen from './components/WelcomeScreen';
import type { ImportReport as BatchReport } from './importModel';
type View = LibraryView;
export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [siteReadings,setSiteReadings]=useState<SiteReading[]>([]);
  const [resumedSite,setResumedSite]=useState<SiteReading|null>(null);
  const [settings, setSettings] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [welcomeDone,setWelcomeDone]=useState(false);
  useEffect(()=>{const timer=window.setTimeout(()=>setWelcomeDone(true),window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:6500);return()=>window.clearTimeout(timer);},[]);
  const [view, setView] = useState<View>('library');
  const [libraryCatalog,setLibraryCatalog]=useState(true);
  const [onlineFavorites,setOnlineFavorites]=useState<OnlineFavorite[]>([]);
  const [catalogTarget,setCatalogTarget]=useState<OnlineFavorite|null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [filter, setFilter] = useState('all');
  const [seriesFilter, setSeriesFilter] = useState('all');
  const [editing, setEditing] = useState<Book | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMenu, setImportMenu] = useState(false);
  const [lastImport, setLastImport] = useState<BatchReport | null>(null);
  const [showImportReport, setShowImportReport] = useState(false);
  const importRunning = useRef(false);
  const [opened, setOpened] = useState<BookPages | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [remove, setRemove] = useState<Book | null>(null);
  const settingsQueue = useRef(new WriteQueue<Settings>(library.saveSettings));
  const readerFlush = useRef<(() => Promise<void>) | null>(null);
  const pendingTasks = useRef(new PendingTasks());
  const reportError = useCallback((e: unknown) => setError(String(e instanceof Error ? e.message : e)), []);
  const refresh = useCallback(async () => { setBooks(await library.list());if(desktop){const [history,favorites]=await Promise.all([suwayomi.siteHistory(),suwayomi.onlineFavorites()]);setSiteReadings(history);setOnlineFavorites(favorites);} }, []);
  useEffect(() => { void Promise.all([refresh(), library.settings().then(setSettings)]).catch(reportError).finally(() => setReady(true)); }, [refresh, reportError]);
  useEffect(() => { document.documentElement.dataset.theme = settings.theme; }, [settings.theme]);
  useEffect(() => {
    const options = seriesOptions(books);
    setSeriesFilter(previous => previous === 'all' || previous === 'none' || options.some(value => `series:${value.key}` === previous) ? previous : 'all');
  }, [books]);
  const registerReaderFlush = useCallback((flush: (() => Promise<void>) | null) => { readerFlush.current = flush; }, []);
  useDesktopClose(async () => {
    await pendingTasks.current.wait();
    await Promise.all([readerFlush.current?.(), settingsQueue.current.flush().catch(() => settingsQueue.current.retry())]);
  }, reportError);
  const trackTask = useCallback((task: Promise<unknown>) => { pendingTasks.current.track(task); }, []);
  const beforeBackup = useCallback(() => settingsQueue.current.flush().catch(() => settingsQueue.current.retry()), []);
  const onRestored = useCallback(async () => {
    const [restoredSettings] = await Promise.all([library.settings(), refresh()]);
    setSettings(restoredSettings);
  }, [refresh]);
  function update(s: Settings) { setSettings(s); void settingsQueue.current.push(s).catch(reportError); }
  async function importBook(kind: 'folder' | 'cbz' | 'pdf') {
    if (importRunning.current) return;
    importRunning.current = true; setImportMenu(false); setImporting(true);
    try { await pendingTasks.current.track(library.import(kind).then(refresh)); }
    catch (e) { reportError(e); }
    finally { importRunning.current = false; setImporting(false); }
  }
  async function importBatch() {
    if (importRunning.current) return;
    importRunning.current = true; setImportMenu(false); setImporting(true);
    try {
      await pendingTasks.current.track((async () => {
        const report = await library.importBatch();
        if (!report) return;
        setLastImport(report); setShowImportReport(true);
        await refresh();
        setView('library'); setLibraryCatalog(false); setQuery(''); setFilter('all'); setSeriesFilter('all'); setSort('added');
      })());
    } catch (e) { reportError(e); }
    finally { importRunning.current = false; setImporting(false); }
  }
  function openOnlineFavorite(item:OnlineFavorite){setCatalogTarget(item);setLibraryCatalog(true);setView('library');}
  async function removeOnlineFavorite(item:OnlineFavorite){setBusy(true);try{await suwayomi.favoriteOnline(item,false);await refresh();}catch(error){reportError(error);}finally{setBusy(false);}}
  async function removeSiteHistory(item:SiteReading){setBusy(true);try{await pendingTasks.current.track(suwayomi.removeSiteReading(item.id));await refresh();}catch(error){reportError(error);}finally{setBusy(false);}}
  async function resumeSite(item:SiteReading){setBusy(true);setResumedSite(item);try{await suwayomi.resumeSite(item.id);await refresh();}catch(error){await suwayomi.closeSite().catch(()=>{});setResumedSite(null);reportError(error);}finally{setBusy(false);}}
  async function read(book: Book) { setBusy(true); try { if(book.format === 'stream' && settings.integratedEngine) await suwayomi.startIntegrated(); setOpened(await library.open(book.id)); } catch (e) { reportError(e); } finally { setBusy(false); } }
  async function favorite(book: Book) { try { await pendingTasks.current.track(library.favorite(book.id, !book.favorite).then(refresh)); } catch (e) { reportError(e); } }
  async function deleteBook() { if (!remove) return; setBusy(true); try { await pendingTasks.current.track(library.remove(remove.id).then(refresh)); setRemove(null); } catch (e) { reportError(e); } finally { setBusy(false); } }
  async function saveMetadata(metadata: BookMetadata) {
    if (!editing) return;
    await pendingTasks.current.track(library.updateMetadata(editing.id,metadata).then(refresh));
    setEditing(null);
  }
  function showSeries(book: Book) { setView('library'); setLibraryCatalog(false); setQuery(''); setFilter('all'); setSeriesFilter(`series:${seriesKey(book.series)}`); setSort('chapter'); }
  const series = seriesOptions(books);
  const visible = selectBooks(books,{ view,query,status:filter,sort,series:seriesFilter });
  const resume = [...books].filter(b => b.lastRead !== null && !b.completed).sort((a,b) => b.lastRead! - a.lastRead!)[0];
  const errorToast = error && <div className="toast" role="alert"><span>{error}</span><button aria-label="Fechar aviso" className="icon-button" onClick={() => setError('')}><X size={18}/></button></div>;
  if (!ready || !welcomeDone) return <WelcomeScreen ready={ready} enter={()=>setWelcomeDone(true)}/>;
  if (opened) return <><Reader data={opened} settings={settings} update={update} close={() => { setOpened(null); void refresh().catch(reportError); }} reportError={reportError} registerFlush={registerReaderFlush}/>{errorToast}</>;
  const nav = [{ id: 'library', label: 'Biblioteca', icon: Library }, { id: 'recent', label: 'Lidos recentemente', icon: Clock3 }, { id: 'favorites', label: 'Favoritos', icon: Heart }, { id: 'online', label: 'Fontes online', icon: Compass }] as const;
  return <div className="app-shell"><aside className="sidebar"><a className="brand" href="#" onClick={e => { e.preventDefault(); if (!onlineBusy) {setCatalogTarget(null);setLibraryCatalog(true);setView('library');} }}><span className="brand-mark"><img src={seleneIcon} alt=""/></span><span>Selene<span className="brand-dot">.</span></span></a><p className="nav-label">SEU ESPAÇO</p><nav>{nav.map(({ id, label, icon: Icon }) => <button disabled={!ready || importing || onlineBusy} key={id} aria-label={label} title={label} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => {setCatalogTarget(null);if(id==='library')setLibraryCatalog(true);setView(id);}}><Icon size={19}/><span>{label}</span>{id === 'library' && <small>{books.length}</small>}</button>)}</nav><div className="sidebar-note"><ShieldCheck size={21}/><strong>Leia no seu ritmo</strong><p>Suas histórias, seu progresso.<br/>Tudo salvo neste computador.</p><span className="local-indicator"><i/> Biblioteca local</span></div><button disabled={!ready || importing || onlineBusy} className={`nav-item settings-nav ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}><Settings2 size={19}/>Configurações</button><span className="version">SELENE · MVP 0.20.0</span></aside>
    {resumedSite&&<SiteReader title={`${resumedSite.title} · ${resumedSite.chapter}`} opening={busy} backLabel="← Voltar às leituras recentes" close={()=>{setResumedSite(null);void refresh().catch(reportError);}} reportError={reportError}/>}<main className="main"><header className="topbar"><div className="breadcrumb">Meu espaço <span>/</span> <strong>{view === 'online' ? 'Fontes online' : view === 'settings' ? 'Configurações' : view === 'favorites' ? 'Favoritos' : view === 'recent' ? 'Recentes' : 'Biblioteca'}</strong></div><span className="offline-badge"><i/>{desktop ? (view === 'online' ? 'Conexão via Suwayomi' : 'Biblioteca local') : 'Prévia no navegador'}</span></header>
      {!desktop && <div className="preview-banner">Prévia da interface. Abra o aplicativo desktop para importar e ler arquivos. Os temas podem ser experimentados aqui.</div>}
      {view === 'library' && <div className="library-catalog-tabs" role="group" aria-label="Conteúdo da biblioteca"><button className="secondary-button" aria-pressed={libraryCatalog} disabled={onlineBusy || importing} onClick={()=>{setCatalogTarget(null);setLibraryCatalog(true);}}>Catálogos das fontes</button><button className="secondary-button" aria-pressed={!libraryCatalog} disabled={onlineBusy || importing} onClick={()=>{setCatalogTarget(null);setLibraryCatalog(false);}}>Meus mangás</button></div>}
      {view === 'settings' ? <SettingsPanel settings={settings} update={update} beforeBackup={beforeBackup} onRestored={onRestored} trackTask={trackTask} reportError={reportError}/> : (view === 'online' || (view === 'library' && libraryCatalog)) ? <OnlinePanel favorites={onlineFavorites} initialFavorite={catalogTarget} onFavoriteHandled={()=>setCatalogTarget(null)} catalogOnly={view === 'library'} selectedSource={catalogTarget?.sourceId??settings.onlineSource} integratedEnabled={catalogTarget?.integrated??settings.integratedEngine} savePreferences={value=>update({...settings,...value})} onChanged={refresh} onBusyChange={setOnlineBusy} url={catalogTarget?.server??settings.suwayomiUrl} books={books} onRead={async book => { await refresh(); setLibraryCatalog(false); setView('library'); await read(book); }} trackTask={trackTask} reportError={reportError}/> : <div className="library-content"><div className="section-heading"><div><p className="eyebrow">SUA PRÓXIMA HISTÓRIA ESTÁ AQUI</p><h1>{view === 'favorites' ? 'Seus favoritos' : view === 'recent' ? 'Leituras recentes' : 'Sua biblioteca'}<span className="title-dot">.</span></h1><p className="muted">Um lugar para todas as histórias que você quer viver.</p></div><div className="import-wrap"><button disabled={!desktop || importing || !ready || busy} className="primary-button" onClick={() => setImportMenu(!importMenu)}>{importing ? <LoaderCircle className="spin" size={18}/> : <Plus size={18}/>} {importing ? 'Importando…' : 'Importar mangá'}</button>{importMenu && <div className="dropdown"><button onClick={() => void importBook('folder')}><FolderOpen size={18}/>Pasta de imagens</button><button onClick={() => void importBook('cbz')}><Archive size={18}/>Arquivo CBZ</button><button onClick={() => void importBook('pdf')}><BookOpen size={18}/>Arquivo PDF</button><button onClick={() => void importBatch()}><Archive size={18}/>Vários arquivos CBZ</button><small>Até 50 CBZ por lote. Imagens: JPG, PNG, WebP, GIF e BMP.</small><button onClick={() => setImportMenu(false)}>Cancelar</button></div>}</div></div>
      {view === 'library' && <section className="hero"><div className="hero-copy"><span className="hero-label"><span/> {resume ? 'CONTINUE DE ONDE PAROU' : 'UM CAPÍTULO SÓ SEU'}</span><h2>{resume ? resume.title : <>Grandes histórias.<br/>No seu próprio ritmo.</>}</h2><p>{resume ? `Página ${resume.page + 1} de ${resume.pageCount} · Seu marcador está esperando.` : 'Importe seus mangás, encontre seu jeito de ler e deixe o mundo lá fora por um instante.'}</p>{resume ? <button className="hero-button" disabled={busy} onClick={() => void read(resume)}><BookOpen size={18}/>Continuar leitura<ArrowUpRight size={17}/></button> : <span className="hero-footnote"><FolderOpen size={17}/> Pastas de imagens e arquivos CBZ</span>}</div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="book-shape book-back"/><div className="book-shape book-front"><BookOpen size={55} strokeWidth={1}/><span>MAIS UM<br/>CAPÍTULO.</span><small>SEU UNIVERSO DE HISTÓRIAS</small></div><span className="spark s1">✦</span><span className="spark s2">✧</span></div></section>}
      {view==='favorites'&&onlineFavorites.length>0&&<section className="online-favorites-section" aria-label="Mangás favoritos das fontes"><h2>Mangás das fontes <small>{onlineFavorites.length}</small></h2><div className="online-grid">{onlineFavorites.filter(item=>(item.title+" "+item.sourceName).toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(item=><CatalogMangaCard key={item.id} server={item.server} manga={{id:item.mangaId,title:item.title}} cachedCover={item.cover} sourceLabel={item.sourceName+" · "+item.lang} busy={busy||onlineBusy} favorite={true} open={()=>openOnlineFavorite(item)} toggleFavorite={()=>void removeOnlineFavorite(item)}/>)}</div></section>}{view==='recent'&&<RecentSiteReadings items={siteReadings.filter(item=>`${item.title} ${item.chapter}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))} busy={busy||onlineBusy} open={item=>void resumeSite(item)} remove={item=>void removeSiteHistory(item)}/>}<div className="collection-heading"><h2> {view === 'favorites' ? 'Histórias favoritas' : view === 'recent' ? 'Últimas leituras' : 'Todas as histórias'} <span>{visible.length+(view==='recent'?siteReadings.length:0)+(view==='favorites'?onlineFavorites.length:0)}</span></h2><span className="muted collection-tip">Sua coleção, sempre por perto</span></div>
      <div className="toolbar"><div className="tabs">{[['all','Todos'],['reading','Lendo'],['new','Não lidos'],['done','Concluídos']].map(([key,label]) => <button key={key} className={filter === key ? 'selected' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div><div className="search-sort"><label className="search"><Search size={17}/><input placeholder="Buscar na biblioteca…" aria-label="Buscar na biblioteca" value={query} onChange={e => setQuery(e.target.value)}/></label><select aria-label="Ordenação" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Recentes</option><option value="title">Título A–Z</option><option value="added">Adicionados</option><option value="chapter">Série e capítulo</option></select><LayoutGrid size={19} className="grid-icon"/></div></div>
      <div className="series-bar"><label>Série<select aria-label="Filtrar por série" value={seriesFilter} onChange={event => setSeriesFilter(event.target.value)}><option value="all">Todas as séries</option><option value="none">Volumes avulsos</option>{series.map(value => <option key={value.key} value={`series:${value.key}`}>{value.name} ({value.count})</option>)}</select></label><span>{series.length} séries · {books.filter(book => !seriesKey(book.series || '')).length} volumes avulsos</span>{(query || filter !== 'all' || seriesFilter !== 'all') && <button className="text-button" onClick={() => { setQuery(''); setFilter('all'); setSeriesFilter('all'); }}>Limpar filtros</button>}</div>
      {!ready ? <div className="empty"><LoaderCircle className="spin"/><h3>Abrindo sua biblioteca…</h3></div> : visible.length === 0 && !(view==='recent'&&siteReadings.length>0) && !(view==='favorites'&&onlineFavorites.length>0) ? <div className="empty"><div className="empty-icon"><BookOpen size={33} strokeWidth={1.4}/></div><h3>{books.length === 0 ? 'Sua primeira história começa aqui' : 'Nenhuma história por aqui'}</h3><p>{books.length === 0 ? 'Adicione uma pasta de imagens ou um arquivo CBZ à sua biblioteca.' : 'Experimente outra busca ou outro filtro.'}</p>{books.length === 0 && <button className="text-button" disabled={!desktop || importing} onClick={() => setImportMenu(true)}>Importar minha primeira história <ArrowUpRight size={16}/></button>}<div className="format-tags"><span>PASTAS</span><span>CBZ</span><span>100% LOCAL</span></div></div> : <div className="book-grid">{visible.map(book => <BookCard key={book.id} book={book} busy={busy || importing} read={() => void read(book)} favorite={() => void favorite(book)} edit={() => setEditing(book)} remove={() => setRemove(book)} selectSeries={() => showSeries(book)}/>)}</div>}
      {lastImport && <button className="text-button last-import-button" disabled={!ready || importing || onlineBusy} onClick={() => setShowImportReport(true)}>Ver resultado do último lote ({lastImport.items.length} arquivos)</button>}
      <footer className="library-footer"><BookOpen size={15}/><span>Uma página de cada vez.</span><span>Feito para ler, feito para você.</span></footer></div>}
    </main>{errorToast}{lastImport && showImportReport && <ImportReport report={lastImport} close={() => setShowImportReport(false)}/>}{editing && <BookEditor key={editing.id} book={editing} seriesNames={series.map(value => value.name)} save={saveMetadata} cancel={() => setEditing(null)}/>}{remove && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="remove-title"><h2 id="remove-title">Remover da biblioteca?</h2><p>“{remove.title}” e seu progresso serão removidos. Os arquivos originais permanecem intactos.</p><div className="modal-actions"><button autoFocus className="secondary-button" disabled={busy} onClick={() => setRemove(null)}>Cancelar</button><button className="danger-button" disabled={busy} onClick={() => void deleteBook()}>Remover</button></div></section></div>}</div>;
}











