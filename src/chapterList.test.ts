import {describe,it,expect} from 'vitest';
import {selectChapters} from './chapterList';
const chapters=[{id:1,name:'Capítulo 00',chapterNumber:0},{id:2,name:'Capítulo 01',chapterNumber:1},{id:3,name:'Capítulo 10',chapterNumber:10},{id:4,name:'Capítulo 100',chapterNumber:100},{id:5,name:'Capítulo 10.5',chapterNumber:10.5},{id:6,name:'Extra',chapterNumber:-1}];
describe('chapter list',()=>{
 it('reverses numeric order without changing source data',()=>{const before=chapters.map(c=>c.id);expect(selectChapters(chapters,'desc','').map(c=>c.id)).toEqual([4,5,3,2,1,6]);expect(chapters.map(c=>c.id)).toEqual(before);});
 it('matches an exact chapter number and accepts leading zeros and decimals',()=>{expect(selectChapters(chapters,'asc','010').map(c=>c.id)).toEqual([3]);expect(selectChapters(chapters,'asc','Capítulo 10,5').map(c=>c.id)).toEqual([5]);expect(selectChapters(chapters,'asc','00').map(c=>c.id)).toEqual([1]);});
 it('supports named specials and a source with missing numeric metadata',()=>{expect(selectChapters(chapters,'asc','extra').map(c=>c.id)).toEqual([6]);expect(selectChapters([{id:7,name:'Capítulo 222',chapterNumber:0}],'asc','222')[0].id).toBe(7);expect(selectChapters(chapters,'asc','999')).toEqual([]);});
});
