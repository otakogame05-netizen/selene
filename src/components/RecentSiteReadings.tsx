import { useState } from 'react';
import { BookOpen, Trash2 } from 'lucide-react';
import { asset } from '../services/library';
import type { SiteReading } from '../services/suwayomi';

function HistoryCover({path,title}:{path:string;title:string}){
  const [failed,setFailed]=useState('');
  return path&&failed!==path?<img src={asset(path)} alt={`Capa de ${title}`} loading="lazy" onError={()=>setFailed(path)}/>:<div className="site-history-placeholder"><BookOpen size={32}/></div>;
}
export default function RecentSiteReadings({items,busy,open,remove}:{items:SiteReading[];busy:boolean;open:(item:SiteReading)=>void;remove:(item:SiteReading)=>void}){
  if(!items.length)return null;
  return <section className="recent-site-readings" aria-label="Capítulos lidos nas fontes"><h2>Capítulos online <small>{items.length}</small></h2><div className="book-grid">{items.map(item=><article className="book-card site-history-book" key={item.id}>
    <div className="cover-wrap"><button className="cover-button" disabled={busy} onClick={()=>open(item)} aria-label={`Reabrir ${item.title} · ${item.chapter}`}><HistoryCover path={item.cover} title={item.title}/><span className="cover-overlay"><BookOpen size={24}/>Reabrir capítulo</span></button><span className="format-badge">ONLINE</span></div>
    <div className="book-info"><h3 title={item.title}>{item.title}</h3><div className="book-actions"><button className="card-action" aria-label={`Apagar do histórico ${item.title} · ${item.chapter}`} title="Apagar do histórico" disabled={busy} onClick={()=>remove(item)}><Trash2 size={14}/></button></div><span className="book-series standalone">{item.chapter}</span><p>Aberto em {new Date(item.lastRead).toLocaleString('pt-BR')}</p></div>
  </article>)}</div></section>;
}
