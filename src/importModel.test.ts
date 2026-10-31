import { expect, it } from 'vitest';
import { filterImportItems, importSummary, type ImportReport } from './importModel';

const report: ImportReport = { items: [
  { name:'2.cbz',status:'added',bookId:'two',title:'2',message:'Adicionado' },
  { name:'3.cbz',status:'failed',bookId:null,title:null,message:'ZIP inválido' },
  { name:'10.cbz',status:'existing',bookId:'ten',title:'10',message:'Já existente' },
  { name:'11.cbz',status:'failed',bookId:null,title:null,message:'Arquivo ausente' },
] };

it('resume importações parciais sem contar duplicados como novos volumes', () => {
  expect(importSummary(report)).toEqual({added:1,existing:1,failed:2,total:4});
  expect(importSummary({items:[]})).toEqual({added:0,existing:0,failed:0,total:0});
});

it('filtra falhas para revisão sem modificar o resultado completo', () => {
  expect(filterImportItems(report,'failed').map(item => item.name)).toEqual(['3.cbz','11.cbz']);
  expect(filterImportItems(report,'all')).toHaveLength(4);
  expect(report.items).toHaveLength(4);
});
