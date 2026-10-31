import { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, LoaderCircle, Search } from 'lucide-react';
import type { Book } from '../domain';
import { desktop } from '../services/library';
import { AUTH_REQUIRED,chapterSource, suwayomi, type Chapters, type Connection, type Manga, type Results, type DownloadProgress, type OnlineFavorite, type CatalogKind, type CatalogOptions } from '../services/suwayomi';
import { queueLabels, runChapterQueue, type QueueItem } from '../services/chapterQueue';
import { pendingItems, queueStore, type QueueRecord, type QueueSnapshot } from '../services/queueStore';
import ExtensionsPanel from './ExtensionsPanel';
import SiteReader from './SiteReader';
import CatalogMangaCard from './CatalogMangaCard';
import CatalogBrowseBar from './CatalogBrowseBar';
import MangaDetails from './MangaDetails';
import { selectChapters, type ChapterOrder } from '../chapterList';

export default function OnlinePanel({ url, books, onRead, onChanged, trackTask, reportError, onBusyChange, selectedSource, integratedEnabled, savePreferences, catalogOnly = false, favorites, initialFavorite, onFavoriteHandled }: {
  url: string; books: Book[]; onRead: (book: Book) => Promise<void>;
  trackTask: (task: Promise<unknown>) => void; reportError: (error: unknown) => void; onBusyChange: (busy: boolean) => void;
  favorites:OnlineFavorite[];initialFavorite?:OnlineFavorite|null;onFavoriteHandled:()=>void;catalogOnly?:boolean; onChanged: () => Promise<void>; selectedSource:string; integratedEnabled:boolean; savePreferences:(value:{onlineSource?:string;integratedEngine?:boolean;suwayomiUrl?:string})=>void;
}) {
  const [address, setAddress] = useState(url);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [authMode,setAuthMode]=useState<'none'|'basic'>('none');
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [hasSession,setHasSession]=useState(false);
  const [sessionChecking,setSessionChecking]=useState(desktop);
  const authAction=useRef(0);
  const [source, setSource] = useState(selectedSource);
  const autoStarted=useRef(false);
  const autoCatalog=useRef('');
  const openedFavorite=useRef('');
  useEffect(()=>{if(desktop&&!autoStarted.current){if(integratedEnabled){autoStarted.current=true;startIntegrated();}else if(catalogOnly&&selectedSource){autoStarted.current=true;connectCatalog();}}},[]);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [catalogKind,setCatalogKind]=useState<CatalogKind>('popular');
  const [genre,setGenre]=useState('');
  const [catalogOptions,setCatalogOptions]=useState<CatalogOptions|null>(null);
  const [optionsLoading,setOptionsLoading]=useState(false);
  const [optionsError,setOptionsError]=useState('');
  const [optionsRevision,setOptionsRevision]=useState(0);
  useEffect(()=>{
    if(!connection||!source)return;let active=true;setCatalogOptions(null);setOptionsLoading(true);setOptionsError('');
    void suwayomi.catalogOptions(connection.server,source).then(value=>{if(active)setCatalogOptions(value);}).catch(()=>{if(active)setOptionsError('Não foi possível carregar os filtros desta fonte.');}).finally(()=>{if(active)setOptionsLoading(false);});
    return()=>{active=false;};
  },[connection?.server,source,optionsRevision]);
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<Results | null>(null);
  const [chapters, setChapters] = useState<Chapters | null>(null);
  const [chapterQuery,setChapterQuery]=useState('');
  const [chapterOrder,setChapterOrder]=useState<ChapterOrder>(()=>{try{return localStorage.getItem('selene.chapter-order')==='desc'?'desc':'asc';}catch{return 'asc';}});
  useEffect(()=>{try{localStorage.setItem('selene.chapter-order',chapterOrder);}catch{/* Reading still works when preference storage is unavailable. */}},[chapterOrder]);
  const visibleChapters=useMemo(()=>selectChapters(chapters?.chapters??[],chapterOrder,chapterQuery),[chapters,chapterOrder,chapterQuery]);
  const [busy, setBusy] = useState('');
  const [jobId, setJobId] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState('');
  const [siteTitle,setSiteTitle]=useState<string|null>(null);
  useEffect(()=>()=>{void suwayomi.closeSite().catch(()=>{});},[]);
  async function readInPlace(chapterId?:number,title='Leitura da fonte'){if(!connection)return;setSiteTitle(title);try{const chapter=chapters?.chapters.find(item=>item.id===chapterId);await suwayomi.readSite(connection.server,source,chapterId,chapter&&chapters?{title:chapters.manga.title,chapter:chapter.name,mangaId:chapters.manga.id}:undefined);}catch(error){await suwayomi.closeSite().catch(()=>{});setSiteTitle(null);throw error;}}
  const [selected, setSelected] = useState<number[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queueActive, setQueueActive] = useState(false);
  const [queueTitle, setQueueTitle] = useState('');
  const [savedQueue, setSavedQueue] = useState<QueueRecord | null>(null);
  const queueRecord = useRef<QueueRecord | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const queueRunning = useRef(false);
  const stopQueue = useRef(false);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { onBusyChange(!!busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(()=>{if(!desktop)return;let active=true;const action=authAction.current;setSessionChecking(true);void suwayomi.session(address).then(value=>{if(active&&action===authAction.current){setHasSession(value);if(value)setAuthMode('basic');}}).catch(()=>{if(active&&action===authAction.current)setHasSession(false);}).finally(()=>{if(active)setSessionChecking(false);});return()=>{active=false;};},[address]);
  useEffect(() => { if (!desktop) { setQueueLoading(false); return; } let active=true; void queueStore.load().then(record=>{if(active){queueRecord.current=record;setSavedQueue(record);}}).catch(reportError).finally(()=>{if(active)setQueueLoading(false);});return()=>{active=false;}; }, [reportError]);
  async function reloadQueue() { setQueueLoading(true);try{const record=await queueStore.load();queueRecord.current=record;if(mounted.current){setSavedQueue(record);setQueueItems([]);}}finally{if(mounted.current)setQueueLoading(false);} }
  async function checkpoint(queue:QueueSnapshot | null) {
    if(!queueRecord.current)throw new Error('Recarregue a fila antes de iniciar.');
    const record=await queueStore.save(queueRecord.current.revision,queue);queueRecord.current=record;if(mounted.current)setSavedQueue(record);
  }
  function run(label: string, operation: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(label);
    const task = operation().catch(error=>{if(String(error)===AUTH_REQUIRED&&mounted.current){setHasSession(false);setConnection(null);setResults(null);setChapters(null);}reportError(error);}).finally(() => { running.current = false; if (mounted.current) setBusy(''); });
    trackTask(task);
  }
  function connectCatalog(){run('Abrindo catálogo da fonte salva…',async()=>{
    const value=await suwayomi.connect(address);
    setConnection(value);setAddress(value.server);setHasSession(!!value.authenticated);
    const chosen=value.sources.some(item=>item.id===selectedSource)?selectedSource:(value.sources[0]?.id??'');
    setSource(chosen);savePreferences({suwayomiUrl:value.server,onlineSource:chosen,integratedEngine:integratedEnabled});
  });}
  function connect() {
    authAction.current++;
    run('Conectando ao servidor…', async () => {
      setCatalogKind('popular');setGenre('');const secret=password;setPassword('');setConnection(null);setResults(null);setChapters(null);
      let value:Connection;
      if(authMode==='basic'&&(!hasSession||secret)){setHasSession(false);value=await suwayomi.login(address,username,secret);}
      else {if(authMode==='none'){await suwayomi.logout(address);setHasSession(false);}value=await suwayomi.connect(address);}
      if (!mounted.current) return;
      setConnection(value); setAddress(value.server); savePreferences({suwayomiUrl:value.server,integratedEngine:false});
      setHasSession(!!value.authenticated);
      setSource(value.sources.some(item=>item.id===selectedSource)?selectedSource:(value.sources[0]?.id ?? ''));  setResults(null); setChapters(null); setPage(1);
      setSelected([]); setQueueItems([]); setNotice('');
    });
  }
  function logout(){authAction.current++;run('Encerrando sessão…',async()=>{await suwayomi.logout();setHasSession(false);setPassword('');setUsername('');setAuthMode('none');setConnection(null);setResults(null);setChapters(null);setSelected([]);setQueueItems([]);setNotice('Sessões do Suwayomi encerradas. Os capítulos locais e a fila foram preservados.');});}
  function startIntegrated(){autoCatalog.current='';authAction.current++;run('Iniciando fontes integradas… A primeira abertura pode levar até 90 segundos.',async()=>{
    setCatalogKind('popular');setGenre('');setConnection(null);setResults(null);setChapters(null);setPassword('');setUsername('');
    const value=await suwayomi.startIntegrated();
    const chosen=value.sources.some(item=>item.id===selectedSource)?selectedSource:(value.sources[0]?.id??'');setAddress(value.server);savePreferences({suwayomiUrl:value.server,integratedEngine:true,onlineSource:chosen});setConnection(value);setHasSession(true);setAuthMode('basic');setSource(chosen);setNotice('Motor integrado ativo. Gerencie as extensões abaixo e selecione uma fonte para pesquisar.');
  });}
  function search(nextPage: number, text: string,kind:CatalogKind=catalogKind,selectedGenre=genre) {
    if (!connection || !source) return;
    run('Buscando mangás…', async () => {
      const value = await suwayomi.search(connection.server, source, text, nextPage,kind,selectedGenre);
      if (mounted.current) { setResults(value); setChapters(null); setPage(nextPage); setAppliedQuery(text); setSelected([]); setQueueItems([]); setNotice(''); }
    });
  }
  useEffect(()=>{
    if(!catalogOnly||!connection||!source||busy||initialFavorite)return;
    const key=`${connection.server}#${source}`;
    if(autoCatalog.current===key)return;
    autoCatalog.current=key;
    search(1,query);
  },[catalogOnly,connection?.server,source,busy,initialFavorite?.id]);
  useEffect(()=>{
    if(!initialFavorite||!connection||busy||openedFavorite.current===initialFavorite.id)return;
    openedFavorite.current=initialFavorite.id;autoCatalog.current=`${connection.server}#${source}`;
    run('Abrindo mangá favorito…',async()=>{
      try{
        if(!connection.sources.some(item=>item.id===initialFavorite.sourceId))throw new Error('A fonte deste favorito não está instalada. Confira as extensões em Fontes online.');
        const value=await suwayomi.chapters(connection.server,initialFavorite.mangaId);
        if(mounted.current){setChapters(value);setChapterQuery('');setSelected([]);setQueueItems([]);setNotice('');}
      }finally{onFavoriteHandled();}
    });
  },[initialFavorite?.id,connection?.server,busy]);
  function isFavorite(manga:Manga){return !!connection&&favorites.some(item=>item.server===connection.server&&item.sourceId===source&&item.mangaId===manga.id);}
  function favoriteManga(manga:Manga){
    if(!connection)return;const provider=connection.sources.find(item=>item.id===source);if(!provider)return;
    run('Salvando favorito…',async()=>{await suwayomi.favoriteOnline({server:connection.server,sourceId:source,sourceName:provider.name,lang:provider.lang,mangaId:manga.id,title:manga.title},!isFavorite(manga));await onChanged();});
  }
  function chooseKind(value:CatalogKind){
    const supportsGenre=value==='popular'||(value==='latest'?catalogOptions?.filterLatest:catalogOptions?.filterNewest);
    const selectedGenre=supportsGenre?genre:'';
    setCatalogKind(value);setGenre(selectedGenre);setQuery('');setResults(null);setChapters(null);setPage(1);search(1,'',value,selectedGenre);
  }
  function chooseGenre(value:string){setGenre(value);setResults(null);setChapters(null);setPage(1);search(1,query,catalogKind,value);}
  function chooseSource(value:string){if(value===source)return;setSource(value);setCatalogKind('popular');setGenre('');savePreferences({onlineSource:value});setResults(null);setChapters(null);setPage(1);setSelected([]);setQueueItems([]);setNotice('');}
  function select(manga: Manga) {
    if (!connection) return;
    run('Carregando capítulos…', async () => { const value = await suwayomi.chapters(connection.server, manga.id); if (mounted.current) { setChapters(value);setChapterQuery(''); setSelected([]); setQueueItems([]); setNotice(''); } });
  }
  async function downloadOne(server: string, mangaId: number, chapterId: number) {
    if (queueRunning.current && stopQueue.current) throw 'Download cancelado';
    setDownloadProgress(null);
    const id = await suwayomi.prepare(); setJobId(id);
    let active = true; let polling = false;
    const poll = async () => { if (polling || !active) return; polling = true; try { const value = await suwayomi.progress(id); if (active && mounted.current) setDownloadProgress(value); } catch { /* The job may have just finished. */ } finally { polling = false; } };
    const interval = window.setInterval(() => void poll(), 300); void poll();
    try {
      if (queueRunning.current && stopQueue.current) await suwayomi.cancel(id);
      return await suwayomi.download(server, mangaId, chapterId, id);
    } catch(error){if(String(error)===AUTH_REQUIRED&&mounted.current){authAction.current++;setHasSession(false);setPassword('');if(server!==address)setUsername('');setAddress(server);setConnection(null);setResults(null);setChapters(null);}throw error;
    } finally { active = false; window.clearInterval(interval); if (mounted.current) { setJobId(''); setDownloadProgress(null); if (!queueRunning.current) setCancelling(false); } }
  }
  function read(chapterId: number) {
    if (!connection || !chapters) return;
    run('Baixando capítulo… Aguarde a conclusão antes de fechar.', async () => {
      setNotice(''); setCancelling(false); setDownloadProgress(null);
      let book: Book;
      try { book = await downloadOne(connection.server, chapters.manga.id, chapterId); }
      catch (error) { if (String(error) === 'Download cancelado') { if (mounted.current) setNotice('Download cancelado. Nenhum capítulo incompleto foi adicionado.'); return; } throw error; }
      if (mounted.current) await onRead(book);
    });
  }
  function startQueue(ids = selected) {
    if (!connection || !chapters || running.current) return;
    const entries = selectChapters(chapters.chapters,chapterOrder,'').filter(chapter => ids.includes(chapter.id) && !books.some(book => book.format !== 'stream' && book.source === chapterSource(connection.server, chapters.manga.id, chapter.id)));
    if (!entries.length) return;
    if(!queueRecord.current || queueRecord.current.queue){reportError('Retome ou descarte a fila salva antes de iniciar outra.');return;}
    executeQueue({server:connection.server,mangaId:chapters.manga.id,title:chapters.manga.title,items:[]},entries);
  }
  function resumeQueue() {
    const snapshot=queueRecord.current?.queue;if(!snapshot||running.current)return;
    const entries=pendingItems(snapshot,books);
    if(!entries.length){run('Conferindo fila…',async()=>{await checkpoint(null);setNotice('Todos os capítulos da fila já estão salvos.');});return;}
    executeQueue(snapshot,entries);
  }
  function retryQueue() {
    if(queueRecord.current?.queue)resumeQueue();
    else startQueue(queueItems.filter(item=>item.status!=='saved').map(item=>item.id));
  }
  function executeQueue(context:QueueSnapshot,entries:{id:number;name:string}[]) {
    run('Baixando fila… Aguarde a conclusão ou cancele a fila antes de fechar.', async () => {
      queueRunning.current = true; stopQueue.current = false; setQueueTitle(context.title); setQueueActive(true); setCancelling(false); setNotice(''); setSelected([]);
      try {
        const result = await runChapterQueue(entries, {
          download: id => downloadOne(context.server, context.mangaId, id), stopped: () => stopQueue.current,
          changed: async items => { if (mounted.current) setQueueItems(items); await checkpoint({...context,items:items.map(item=>({id:item.id,name:item.name,status:item.status,error:item.error?.slice(0,1000)}))}); },
        });
        if(result.every(item=>item.status==='saved'))await checkpoint(null);
        if (mounted.current) setNotice(`Fila encerrada · Salvos: ${result.filter(item => item.status === 'saved').length} · Falhas: ${result.filter(item => item.status === 'failed').length} · Pendentes: ${result.filter(item => item.status === 'cancelled' || item.status === 'notStarted').length}`);
      } catch(error) {
        if(mounted.current)setQueueItems(previous=>previous.map(item=>item.status==='queued'||item.status==='downloading'?{...item,status:'notStarted'}:item));
        throw error;
      } finally {
        queueRunning.current = false; if (mounted.current) { setQueueActive(false); setCancelling(false); }
        await onChanged();
      }
    });
  }
  async function cancel() {
    if ((!jobId && !queueRunning.current) || cancelling) return;
    if (queueRunning.current) stopQueue.current = true;
    setCancelling(true);
    try { const accepted = jobId ? await suwayomi.cancel(jobId) : true; if (!accepted && !queueRunning.current && mounted.current) setCancelling(false); }
    catch (error) { if (mounted.current) { setCancelling(false); reportError(error); } }
  }
  return <div className={`library-content online-content ${catalogOnly?'catalog-content':''}`}>{siteTitle!==null&&<SiteReader title={siteTitle} opening={!!busy} close={()=>{setSiteTitle(null);void onChanged().catch(reportError);}} reportError={reportError}/>}<div className="section-heading"><div>{!catalogOnly&&<p className="eyebrow">EXPLORE SUAS FONTES</p>}<h1>{catalogOnly ? 'Explorar mangás' : 'Fontes online'}<span className="title-dot">.</span></h1>{!catalogOnly&&<p className="muted">Ative as fontes integradas, instale extensões e encontre seus mangás.</p>}</div></div>
    {!catalogOnly && <><section className="settings-card"><h2>Fontes integradas ao Selene</h2><p className="muted">O motor de extensões e o Java já acompanham a edição completa. Você não precisa instalar nem abrir o Suwayomi separadamente.</p><button className="primary-button" disabled={!desktop || !!busy} onClick={startIntegrated}>Ativar fontes integradas</button><p className="muted">O motor funciona somente neste computador e fecha com o Selene. A leitura online carrega as páginas conforme você avança. As fontes e extensões instaladas são preservadas.</p></section><section className="settings-card"><h2>Retomada da fila</h2>{queueLoading ? <p>Carregando fila salva…</p> : savedQueue?.queue ? <><strong>{savedQueue.queue.title}</strong><p className="muted">{pendingItems(savedQueue.queue, books).length} pendentes · {savedQueue.queue.server}</p><p className="muted">A retomada começa somente quando você clicar. Mantenha o mesmo servidor Suwayomi aberto. Se ele exige login, conecte com usuário e senha abaixo antes de retomar.</p><div className="queue-actions"><button className="primary-button" disabled={!!busy} onClick={resumeQueue}>Retomar fila salva</button><button className="secondary-button" disabled={!!busy} onClick={() => run('Descartando fila…', async () => { await checkpoint(null); setQueueItems([]); setNotice('Fila descartada. Os capítulos já salvos foram preservados.'); })}>Descartar fila</button></div></> : <p className="muted">Nenhuma fila pendente salva.</p>}<button className="text-button" disabled={!desktop || !!busy || queueLoading} onClick={() => run('Recarregando fila…', reloadQueue)}>Recarregar fila</button></section><section className="settings-card"><h2>Conexão avançada</h2><p className="muted">Esta seção é opcional: permite conectar a um servidor Suwayomi separado. Para o motor incluído no Selene, use Ativar fontes integradas acima; não informe senha manualmente.</p><form autoComplete="off" className="online-connect" onSubmit={event => { event.preventDefault(); connect(); }}><label>Endereço do servidor<input aria-label="Endereço do servidor" type="url" required value={address} disabled={!!busy} onChange={event => { setAddress(event.target.value); setHasSession(false); setPassword(''); setUsername(''); setConnection(null); setResults(null); setChapters(null); setSelected([]); setQueueItems([]); setNotice(''); }}/></label><label>Autenticação<select aria-label="Autenticação" value={authMode} disabled={!!busy} onChange={event => { authAction.current++; setAuthMode(event.target.value as 'none' | 'basic'); setPassword(''); setConnection(null); }}><option value="none">Sem login</option><option value="basic">Usuário e senha · Basic</option></select></label>{authMode === 'basic' && <><label>Usuário<input aria-label="Usuário Suwayomi" autoComplete="off" maxLength={1024} required={!hasSession || !!password} disabled={!!busy} value={username} onChange={event => setUsername(event.target.value)}/></label><label>Senha<input aria-label="Senha Suwayomi" type="password" autoComplete="off" maxLength={4096} required={!hasSession} disabled={!!busy} value={password} onChange={event => setPassword(event.target.value)}/></label></>}<button className="primary-button" disabled={!desktop || !!busy || sessionChecking}>Conectar</button></form><button className="text-button" disabled={!desktop || !!busy} onClick={logout}>Sair do Suwayomi</button><p className="muted">Exemplo local: http://127.0.0.1:4567 · Basic exige HTTPS fora deste computador. Cookies e JWT ainda não são suportados.</p>{hasSession && <p className="muted">Sessão Basic em memória. A senha não é salva nas configurações ou backups. Ao fechar o aplicativo, entre novamente. Para trocar de conta, informe usuário e senha.</p>}{connection && <p role="status">Conectado a {connection.name} {connection.version} · {connection.sources.length} fontes</p>}</section>
    </>}{catalogOnly && !connection && <section className="settings-card"><h2>Explore os catálogos das suas fontes</h2><p>As fontes das extensões instaladas aparecem aqui. Configure novas extensões em Fontes online.</p><button className="primary-button" disabled={!desktop || !!busy} onClick={startIntegrated}>Abrir catálogos</button></section>}
    {connection && <>{!catalogOnly && <ExtensionsPanel key={connection.server} server={connection.server} busy={!!busy} run={run} reconnect={async()=>{const value=await suwayomi.connect(connection.server);setConnection(value);setSource(value.sources[0]?.id??'');setResults(null);setChapters(null);}}/>}<form className="online-search" onSubmit={event => { event.preventDefault(); search(1, query); }}><label>Fonte<select aria-label="Fonte" value={source} disabled={!!busy} onChange={event => { chooseSource(event.target.value); }}>{connection.sources.map(value => <option key={value.id} value={value.id}>{value.name} · {value.lang}</option>)}</select></label><label>Nome do mangá<input aria-label="Nome do mangá" maxLength={512} placeholder="Em branco para ver populares" value={query} disabled={!!busy} onChange={event => setQuery(event.target.value)}/></label><button className="primary-button" disabled={!!busy || !source}><Search size={17}/>Buscar</button></form><div className="catalog-control-row">{!chapters&&<CatalogBrowseBar kind={catalogKind} genre={genre} options={catalogOptions} loading={optionsLoading} error={optionsError} busy={!!busy} query={appliedQuery} changeKind={chooseKind} changeGenre={chooseGenre} retry={()=>setOptionsRevision(value=>value+1)}/>}<details className="source-actions"><summary>Ações da fonte</summary><div><button className="secondary-button" disabled={!!busy || !source} onClick={()=>run('Abrindo navegador do Selene…',async()=>{await readInPlace();setNotice('Leitura integrada aberta. Use Voltar ao catálogo para escolher outro capítulo. O progresso é o do próprio site.');})}>Abrir site no Selene</button><button className="secondary-button" disabled={!!busy || !source} onClick={()=>run('Preparando navegador de verificação…',async()=>{await suwayomi.verifySource(connection.server,source);setNotice('Conclua a verificação na janela aberta, feche-a e tente novamente. Na primeira ativação, o navegador adicional pode baixar cerca de 270 MB; aguarde a preparação.');})}>Verificar acesso à fonte</button><p className="muted">Abre uma janela para você verificar o acesso ao site. A primeira ativação baixa um componente de navegador de cerca de 270 MB. A sessão é compartilhada com a extensão; não há resolução automática de desafios.</p></div></details></div>
    {connection.sources.length === 0 && <p>Nenhuma fonte disponível. Instale uma extensão na seção Extensões acima.</p>}
    {chapters ? <section className="settings-card"><button className="text-button" disabled={!!busy} onClick={() => setChapters(null)}>← Voltar aos resultados</button><div className="chapter-heading"><h2>{chapters.manga.title}</h2><button className="secondary-button" aria-pressed={isFavorite(chapters.manga)} aria-label={(isFavorite(chapters.manga)?"Remover dos favoritos":"Favoritar")+" "+chapters.manga.title} disabled={!!busy} onClick={()=>favoriteManga(chapters.manga)}><Heart size={16} fill={isFavorite(chapters.manga)?"currentColor":"none"}/>{isFavorite(chapters.manga)?"Favoritado":"Favoritar"}</button></div><MangaDetails key={`${connection.server}:${chapters.manga.id}`} server={connection.server} manga={chapters.manga}/><p className="muted">{/toonlivre|manga\s*livre/i.test(connection.sources.find(item=>item.id===source)?.name??'') ? 'Na ToonLivre, Ler online abre o capítulo aqui no Selene. A verificação é manual e o progresso é o do próprio site. Baixar e ler continua dependendo da extensão.' : 'Ler online abre sem baixar o capítulo inteiro. Baixar e ler salva todas as páginas para uso offline. Progresso e marcadores ficam no Selene.'}</p><div className="chapter-list-tools"><label>Número do capítulo<input type="search" inputMode="decimal" aria-label="Número do capítulo" placeholder="Ex.: 65 ou 65,5" value={chapterQuery} onChange={event=>{setChapterQuery(event.target.value);setSelected([]);}}/></label><label>Ordem<select aria-label="Ordem dos capítulos" value={chapterOrder} onChange={event=>setChapterOrder(event.target.value as ChapterOrder)}><option value="asc">Do menor para o maior</option><option value="desc">Do maior para o menor</option></select></label><span aria-live="polite">{visibleChapters.length} de {chapters.chapters.length} capítulos</span></div><div className="queue-actions"><button className="secondary-button" disabled={!!busy} onClick={() => setSelected(visibleChapters.filter(chapter => !books.some(book => book.format !== 'stream' && book.source === chapterSource(connection.server, chapters.manga.id, chapter.id))).slice(0,50).map(chapter => chapter.id))}>Selecionar até 50</button><button className="text-button" disabled={!!busy || !selected.length} onClick={() => setSelected([])}>Limpar seleção</button><button className="primary-button" disabled={!!busy || !selected.length || queueLoading || !savedQueue || !!savedQueue.queue} onClick={() => startQueue()}>Baixar selecionados ({selected.length})</button></div><p className="muted">Até 50 capítulos por fila, um de cada vez. Os concluídos são preservados se outro falhar ou se você cancelar.</p><div className="chapter-list">{visibleChapters.map(chapter => { const saved = books.some(book => book.format !== 'stream' && book.source === chapterSource(connection.server, chapters.manga.id, chapter.id)); return <div className="chapter-row" key={chapter.id}><label className="chapter-label"><input type="checkbox" aria-label={`Selecionar ${chapter.name}`} checked={selected.includes(chapter.id)} disabled={!!busy || saved || (!selected.includes(chapter.id) && selected.length >= 50)} onChange={event => setSelected(previous => event.target.checked ? [...previous, chapter.id] : previous.filter(id => id !== chapter.id))}/><span>{chapter.name}</span></label><button className="primary-button" disabled={!!busy} onClick={()=>{if(!connection||!chapters)return;run('Abrindo leitura online…',async()=>{if(/toonlivre|manga\s*livre/i.test(connection.sources.find(item=>item.id===source)?.name??'')){await readInPlace(chapter.id,`${chapters.manga.title} · ${chapter.name}`);}else{const book=await suwayomi.openOnline(connection.server,chapters.manga.id,chapter.id);await onRead(book);}});}}>Ler online</button><button className="secondary-button" disabled={!!busy} aria-label={`Verificar acesso a ${chapter.name}`} onClick={()=>run('Abrindo a página do capítulo para verificação…',async()=>{await suwayomi.verifySource(connection.server,source,chapter.id);setNotice('A verificação abriu na página deste capítulo. Conclua-a manualmente, feche a janela e tente Ler online novamente.');})}>Verificar capítulo</button><button className="secondary-button" disabled={!!busy} onClick={()=>run('Abrindo capítulo no navegador do Selene…',async()=>{await readInPlace(chapter.id,`${chapters.manga.title} · ${chapter.name}`);setNotice('Capítulo aberto na área de leitura integrada. O progresso e as páginas não são salvos no leitor local do Selene.');})}>Ler no site</button><button className="secondary-button" disabled={!!busy} onClick={() => read(chapter.id)}>{saved ? 'Ler salvo' : 'Baixar e ler'}</button></div>; })}</div>{chapters.chapters.length === 0 && <p>Nenhum capítulo encontrado nesta fonte.</p>}{chapters.chapters.length>0&&visibleChapters.length===0&&<p role="status">Nenhum capítulo encontrado para essa busca.</p>}</section> : results && <><p className="muted">Página {page} · {results.mangas.length} resultados</p><div className="online-grid">{results.mangas.map(manga => <CatalogMangaCard key={manga.id} server={connection.server} manga={manga} busy={!!busy} favorite={isFavorite(manga)} open={()=>select(manga)} toggleFavorite={()=>favoriteManga(manga)}/>)}</div>{!results.mangas.length && <p>Nenhum mangá encontrado. Experimente outro título ou outra fonte.</p>}<div className="online-pagination"><button className="secondary-button" disabled={!!busy || page <= 1} onClick={() => search(page - 1, appliedQuery)}>Anterior</button><span>Página {page}</span><button className="secondary-button" disabled={!!busy || !results.hasNextPage || page >= 500} onClick={() => search(page + 1, appliedQuery)}>Próxima</button></div></>}
    </>}{queueItems.length > 0 && <section className="settings-card queue-report" aria-label="Fila de capítulos"><h2>Fila de capítulos · {queueTitle}</h2><p className="muted">{queueItems.filter(item => item.status === 'saved').length} de {queueItems.length} salvos</p><ol>{queueItems.map(item => <li key={item.id}><strong>{item.name}</strong><span>{queueLabels[item.status]}</span>{item.error && <p>{item.error}</p>}</li>)}</ol>{!busy && queueItems.some(item => ['failed','cancelled','notStarted'].includes(item.status)) && <button className="secondary-button" onClick={retryQueue}>Tentar pendentes novamente</button>}</section>}{notice && <p role="status">{notice}</p>}{busy && <div className="online-status"><LoaderCircle className="spin" size={18}/><div role="status">{cancelling ? 'Cancelando… A resposta em andamento pode levar até 35 segundos.' : busy}{queueActive && <span>Capítulo {Math.max(1, queueItems.findIndex(item => item.status === 'downloading') + 1)} de {queueItems.length} · {queueItems.find(item => item.status === 'downloading')?.name}</span>}{jobId && downloadProgress && downloadProgress.total > 0 && <><progress aria-label="Progresso do download" value={Math.min(99, Math.floor(downloadProgress.completed / downloadProgress.total * 100))} max={100}/><span>{Math.min(99, Math.floor(downloadProgress.completed / downloadProgress.total * 100))}% · {downloadProgress.completed} de {downloadProgress.total} páginas · {(downloadProgress.bytes / 1048576).toFixed(1)} MiB{downloadProgress.completed === downloadProgress.total ? ' · Salvando…' : ''}</span></>}</div>{(jobId || queueActive) && <button className="secondary-button" disabled={cancelling} onClick={() => void cancel()}>{cancelling ? 'Cancelando…' : queueActive ? 'Cancelar fila' : 'Cancelar download'}</button>}</div>}
  </div>;
}











