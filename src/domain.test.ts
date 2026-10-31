import { describe, expect, it } from 'vitest';
import { clampPage, defaults, normalizeSettings, pageGroup, progress, type Book } from './domain';
describe('limites e spreads do leitor', () => {
  it('limita páginas inválidas e valores não finitos', () => { expect(clampPage(-1, 10)).toBe(0); expect(clampPage(99,10)).toBe(9); expect(clampPage(NaN,10)).toBe(0); expect(clampPage(5,0)).toBe(0); });
  it('não inventa a página final de um spread ímpar', () => { expect(pageGroup(2,3,'double')).toEqual([2]); expect(pageGroup(0,3,'double')).toEqual([0,1]); expect(pageGroup(0,0,'single')).toEqual([]); });
});
describe('persistência e preferências', () => {
  it('restaura a fonte e a ativação do motor sem guardar credenciais',()=>{expect(normalizeSettings({onlineSource:'123456789012345',integratedEngine:true})).toEqual({...defaults,onlineSource:'123456789012345',integratedEngine:true});expect(normalizeSettings({onlineSource:42,integratedEngine:'yes'}).onlineSource).toBe('');});
  it('recupera configurações antigas ou corrompidas', () => { expect(normalizeSettings(null)).toEqual(defaults); expect(normalizeSettings({theme:'unknown',mode:'pdf',breakMinutes:999})).toEqual({...defaults,breakMinutes:180}); expect(normalizeSettings({breakMinutes:NaN})).toEqual(defaults); });
  it('distingue um volume não aberto de uma página lida', () => { const b = {page:0,pageCount:10,completed:false,lastRead:null} as Book; expect(progress(b)).toBe(0); expect(progress({...b,lastRead:1})).toBe(10); expect(progress({...b,completed:true})).toBe(100); });
});
