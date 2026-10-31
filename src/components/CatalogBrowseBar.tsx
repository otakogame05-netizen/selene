import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { CatalogKind,CatalogOptions } from '../services/suwayomi';

export default function CatalogBrowseBar({kind,genre,options,loading,error,busy,query,changeKind,changeGenre,retry}:{kind:CatalogKind;genre:string;options:CatalogOptions|null;loading:boolean;error:string;busy:boolean;query:string;changeKind:(value:CatalogKind)=>void;changeGenre:(value:string)=>void;retry:()=>void}){
  const [filters,setFilters]=useState(false);
  const canFilter=kind==='popular'||(kind==='latest'?options?.filterLatest:options?.filterNewest);
  const genres=options?.genres??[];
  const activeGenre=genres.find(item=>item.id===genre);
  return <section className="catalog-browse" aria-label="Navegação do catálogo">
    <div className="catalog-browse-buttons"><div role="group" aria-label="Categorias do catálogo">
      <button className="secondary-button" aria-pressed={kind==='popular'} disabled={busy} title="Ranking de popularidade fornecido pela fonte; pode considerar visualizações totais." onClick={()=>changeKind('popular')}>Populares</button>
      <button className="secondary-button" aria-pressed={kind!=='popular'} disabled={busy||loading||!(options?.supportsLatest||options?.supportsNewest)} title={options?.supportsLatest?'Capítulos atualizados e lançamentos fornecidos pela fonte':'Esta fonte não oferece uma lista de atualizações disponível'} onClick={()=>changeKind(options?.supportsLatest?'latest':'newest')}>Atualizados</button>
    </div>
    {kind!=='popular'&&<select aria-label="Conteúdo de Atualizados" value={kind} disabled={busy} onChange={event=>changeKind(event.target.value as CatalogKind)}><option value="latest" disabled={!options?.supportsLatest}>Atualizações de capítulos</option><option value="newest" disabled={!options?.supportsNewest}>Novas obras</option></select>}
    <button className="secondary-button catalog-filter-toggle" aria-expanded={filters} aria-controls="catalog-genre-panel" disabled={busy} onClick={()=>setFilters(value=>!value)}><SlidersHorizontal size={15}/>Filtro{genre?' · 1':''}</button></div>
    <p className="catalog-context">{query?'Resultados da pesquisa na fonte':kind==='popular'?'Populares · ranking da fonte':kind==='latest'?'Mangás com capítulos atualizados recentemente':'Novas obras · lançamentos da fonte'}{activeGenre&&<> · {activeGenre.name}</>}</p>
    {filters&&<div id="catalog-genre-panel" className="catalog-genre-panel" role="group" aria-label="Filtro por gênero">
      {loading?<span>Carregando gêneros da fonte…</span>:error?<><span>{error}</span><button className="text-button" disabled={busy} onClick={retry}>Tentar carregar filtros</button></>:genres.length===0?<span>Esta fonte não oferece filtro de gênero pela extensão.</span>:<><label>Gênero<select aria-label="Gênero" value={genre} disabled={busy||!canFilter} onChange={event=>changeGenre(event.target.value)}><option value="">Todos os gêneros</option>{genres.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{genre&&<button className="text-button" disabled={busy} onClick={()=>changeGenre('')}>Limpar gênero</button>}{!canFilter&&<span>A fonte não combina gêneros com essa ordenação. Use Populares para filtrar.</span>}{kind==='popular'&&!options?.filterPopular&&<span>Com gênero, esta fonte usa sua ordenação padrão de pesquisa.</span>}</>}
    </div>}
  </section>;
}
