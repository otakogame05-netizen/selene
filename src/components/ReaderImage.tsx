import { useEffect, useRef, useState } from 'react';
import { asset } from '../services/library';
import { suwayomi } from '../services/suwayomi';

export default function ReaderImage({path,id,index,active}:{path:string;id:string;index:number;active:boolean}){
  const pending=path.endsWith('.pending');
  const [cached,setCached]=useState(pending?'':path);
  const [visible,setVisible]=useState(active);
  const [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  const placeholder=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(active)setVisible(true);},[active]);
  useEffect(()=>{
    if(!placeholder.current||visible)return;
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'300px'});
    observer.observe(placeholder.current);return()=>observer.disconnect();
  },[visible]);
  useEffect(()=>{
    if(!pending||cached||!visible)return;let current=true;setError('');
    void suwayomi.page(id,index).then(value=>{if(current)setCached(value);}).catch(value=>{if(current)setError(String(value));});
    return()=>{current=false;};
  },[id,index,pending,cached,visible,attempt]);
  if(cached&&!error)return <img src={asset(cached)} alt={`Página ${index+1}`} onError={()=>setError('Não foi possível exibir a imagem desta página.')}/>;
  return <div ref={placeholder} style={{minHeight:'70vh',minWidth:'35%',display:'grid',placeContent:'center',padding:24,textAlign:'center'}} role="status"><p>{error||`Carregando página ${index+1}…`}</p>{error&&<button className="secondary-button" onClick={()=>{setError('');setVisible(true);setAttempt(value=>value+1);}}>Tentar página novamente</button>}</div>;
}
