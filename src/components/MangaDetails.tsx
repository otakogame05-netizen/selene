import {useEffect,useState} from 'react';
import {BookOpen} from 'lucide-react';
import {asset} from '../services/library';
import {suwayomi,type Manga} from '../services/suwayomi';

export default function MangaDetails({server,manga}:{server:string;manga:Manga}){
  const [cover,setCover]=useState('');
  const [loading,setLoading]=useState(true);
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>{let active=true;setCover('');setLoading(true);void suwayomi.cover(server,manga.id).then(path=>{if(active)setCover(path);}).catch(()=>{}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[server,manga.id]);
  const description=manga.description?.trim()??'';
  return <section className="manga-details" aria-label={`Sobre ${manga.title}`}>
    <div className="manga-detail-cover">{cover?<img src={asset(cover)} alt={`Capa de ${manga.title}`} onError={()=>setCover('')}/>:<div className="manga-detail-placeholder"><BookOpen size={32}/><span>{loading?'Carregando capa…':'Capa indisponível'}</span></div>}</div>
    <div className="manga-synopsis"><h3>Sinopse</h3>{description?<><p className={expanded?'':'synopsis-short'} id={`synopsis-${manga.id}`}>{description}</p>{description.length>240&&<button className="text-button" aria-expanded={expanded} aria-controls={`synopsis-${manga.id}`} onClick={()=>setExpanded(value=>!value)}>{expanded?'Mostrar menos':'Ler sinopse completa'}</button>}</>:<p className="muted">Esta fonte não forneceu uma descrição para este mangá.</p>}</div>
  </section>;
}
