import type { Chapter } from './services/suwayomi';
export type ChapterOrder='asc'|'desc';
const collator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
const clean=(text:string)=>text.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase().trim();
function chapterNumber(chapter:Chapter):number{
  const text=clean(chapter.name);
  const named=text.match(/(?:capitulo|chapter|cap\.?|ch\.?)[\s:#-]*(\d+(?:[.,]\d+)?)/i)??text.match(/^(\d+(?:[.,]\d+)?)/);
  return named?Number(named[1].replace(',','.')):Number.isFinite(chapter.chapterNumber)?chapter.chapterNumber:-1;
}
export function selectChapters(chapters:Chapter[],order:ChapterOrder,query:string):Chapter[]{
  const text=clean(query);const numeric=text.replace(/^(?:capitulo|chapter|cap\.?|ch\.?)\s*/,'').replace(/^#\s*/,'');
  const number=/^\d+(?:[.,]\d+)?$/.test(numeric)?Number(numeric.replace(',','.')):null;
  return chapters.filter(chapter=>!text||(number!==null?Math.abs(chapterNumber(chapter)-number)<1e-7:clean(chapter.name).includes(text)))
    .sort((a,b)=>((chapterNumber(a)-chapterNumber(b))||collator.compare(a.name,b.name)||a.id-b.id)*(order==='desc'?-1:1));
}
