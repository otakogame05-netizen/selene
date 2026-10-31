import {useEffect,useRef,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {desktop} from '../services/library';

export function useReaderFullscreen(reportError:(error:unknown)=>void){
  const [full,setFull]=useState(false);
  const initial=useRef<boolean|null>(null);
  useEffect(()=>{
    let active=true;
    if(desktop)void invoke<boolean>('reader_fullscreen',{enabled:null}).then(value=>{initial.current=value;if(active)setFull(value);}).catch(reportError);
    const changed=()=>setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange',changed);
    return()=>{active=false;document.removeEventListener('fullscreenchange',changed);if(desktop&&initial.current!==null)void invoke('reader_fullscreen',{enabled:initial.current}).catch(reportError);else if(!desktop&&document.fullscreenElement)void document.exitFullscreen().catch(reportError);};
  },[reportError]);
  async function toggle(){try{if(desktop){const current=await invoke<boolean>('reader_fullscreen',{enabled:null});await invoke<boolean>('reader_fullscreen',{enabled:!current});setFull(!current);}else{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();setFull(!!document.fullscreenElement);}}catch(error){reportError(error);}}
  return {full,toggle};
}
