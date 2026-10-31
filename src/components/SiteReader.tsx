import { useEffect, useState } from 'react';
import {useReaderFullscreen} from '../hooks/useReaderFullscreen';
import {Expand,Minimize,EyeOff,Eye} from 'lucide-react';
import { suwayomi } from '../services/suwayomi';

export default function SiteReader({ title, opening, close, reportError, backLabel='← Voltar ao catálogo' }: {title:string;opening:boolean;close:()=>void;reportError:(error:unknown)=>void;backLabel?:string}) {
  const [closing,setClosing]=useState(false);
  const [hidden,setHidden]=useState(false);
  const {full,toggle}=useReaderFullscreen(reportError);
  const [layout,setLayout]=useState(()=>{try{const value=JSON.parse(localStorage.getItem('yomi-site-layout')??'{}');return {comfortable:value.comfortable!==false,zoom:Number.isInteger(value.zoom)&&value.zoom>=70&&value.zoom<=160?value.zoom:100};}catch{return {comfortable:true,zoom:100};}});
  useEffect(()=>{localStorage.setItem('yomi-site-layout',JSON.stringify(layout));void suwayomi.layoutSite(layout.comfortable,layout.zoom,hidden).catch(reportError);},[layout,hidden,reportError]);

  async function back(){
    setClosing(true);
    try{await suwayomi.closeSite();close();}catch(error){setClosing(false);reportError(error);}
  }
  return <section className="site-reader" aria-label="Leitura integrada da fonte">
    {hidden?<div className="site-reader-recovery"><button onClick={()=>setHidden(false)} aria-label="Mostrar controles da leitura online"><Eye size={14}/> Mostrar controles</button><button onClick={()=>void toggle()} aria-label={full?"Sair da tela cheia":"Tela cheia"}>{full?<Minimize size={14}/>:<Expand size={14}/>}</button></div>:<header className="site-reader-bar"><button className="secondary-button" disabled={opening||closing} onClick={()=>void back()}>{backLabel}</button><strong>{title}</strong><label className="site-width"><span>Largura</span><select aria-label="Largura da leitura" value={layout.comfortable?'comfortable':'screen'} onChange={event=>setLayout({...layout,comfortable:event.target.value==='comfortable'})}><option value="comfortable">Confortável</option><option value="screen">Toda a tela</option></select></label><div className="site-zoom" role="group" aria-label="Zoom da leitura"><button aria-label="Diminuir zoom da leitura" disabled={layout.zoom<=70} onClick={()=>setLayout({...layout,zoom:Math.max(70,layout.zoom-10)})}>−</button><output aria-live="polite">{layout.zoom}%</output><button aria-label="Aumentar zoom da leitura" disabled={layout.zoom>=160} onClick={()=>setLayout({...layout,zoom:Math.min(160,layout.zoom+10)})}>+</button></div><button className="icon-button" title={full?"Sair da tela cheia":"Tela cheia"} aria-label={full?"Sair da tela cheia":"Tela cheia"} onClick={()=>void toggle()}>{full?<Minimize size={18}/>:<Expand size={18}/>}</button><button className="icon-button" title="Ocultar barras da leitura" aria-label="Ocultar barras da leitura online" onClick={()=>setHidden(true)}><EyeOff size={18}/></button></header>}
    <div className="site-reader-placeholder">Abrindo capítulo…</div>
  </section>;
}
