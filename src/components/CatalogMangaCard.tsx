import { useEffect, useState } from 'react';
import { BookOpen, Heart } from 'lucide-react';
import { asset } from '../services/library';
import { suwayomi, type Manga } from '../services/suwayomi';

function Cover({server,manga,cachedCover}:{server:string;manga:Manga;cachedCover?:string}){
  const [path,setPath]=useState(cachedCover??'');
  useEffect(()=>{if(cachedCover!==undefined){setPath(cachedCover);return;}let active=true;void suwayomi.cover(server,manga.id).then(value=>{if(active)setPath(value);}).catch(()=>{});return()=>{active=false;};},[server,manga.id,cachedCover]);
  return path?<img className="online-cover" src={asset(path)} alt="" loading="lazy" onError={()=>setPath('')}/>:<div className="online-cover cover-placeholder"><BookOpen size={30}/></div>;
}
export default function CatalogMangaCard({server,manga,busy,favorite,open,toggleFavorite,cachedCover,sourceLabel}:{server:string;manga:Manga;busy:boolean;favorite:boolean;open:()=>void;toggleFavorite:()=>void;cachedCover?:string;sourceLabel?:string}){
  return <article className="catalog-manga-card">
    <button className="online-manga" aria-label={`Ver capítulos de ${manga.title}`} disabled={busy} onClick={open}><Cover server={server} manga={manga} cachedCover={cachedCover}/><strong>{manga.title}</strong>{sourceLabel&&<small>{sourceLabel}</small>}<span>Ver capítulos</span></button>
    <button className={`catalog-favorite ${favorite?'is-favorite':''}`} aria-label={`${favorite?'Remover dos favoritos':'Favoritar'} ${manga.title}`} aria-pressed={favorite} disabled={busy} onClick={toggleFavorite}><Heart size={18} fill={favorite?'currentColor':'none'}/></button>
  </article>;
}
