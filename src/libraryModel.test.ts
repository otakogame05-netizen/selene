import { describe, expect, it } from 'vitest';
import type { Book } from './domain';
import { normalizeMetadata, selectBooks, seriesOptions, type LibraryFilters } from './libraryModel';

const makeBook = (id: string, patch: Partial<Book> = {}): Book => ({ id, title: `Volume ${id}`, series: '', chapter: '', source: id, format: 'cbz', cover: '', pageCount: 10, page: 0, favorite: false, completed: false, addedAt: 1, lastRead: null, ...patch });
const filters: LibraryFilters = { view: 'library', query: '', status: 'all', sort: 'chapter', series: 'all' };

describe('organização da biblioteca', () => {
  it('ordena capítulos numericamente e mantém volumes sem capítulo ao final da série', () => {
    const books = [makeBook('10',{series:'Aurora',chapter:'10'}),makeBook('extra',{series:'Aurora'}),makeBook('2',{series:'Aurora',chapter:'2'}),makeBook('solo')];
    expect(selectBooks(books,filters).map(book => book.id)).toEqual(['2','10','extra','solo']);
    expect(books[0].id).toBe('10');
  });
  it('agrupa nomes com diferenças de maiúsculas/espaços e mantém filtros reservados separados', () => {
    const books = [makeBook('1',{series:' Aurora '}),makeBook('2',{series:'aurora'}),makeBook('3',{series:'all'})];
    expect(seriesOptions(books).find(series => series.key === 'aurora')?.count).toBe(2);
    expect(selectBooks(books,{...filters,series:'series:all'}).map(book => book.id)).toEqual(['3']);
    expect(selectBooks(books,{...filters,series:'none'})).toEqual([]);
  });
  it('busca por título, série e capítulo, ignorando acentos', () => {
    const books = [makeBook('1',{title:'A jornada',series:'Coração',chapter:'Especial de verão'})];
    for (const query of ['coracao','jornada','verao']) expect(selectBooks(books,{...filters,query})).toHaveLength(1);
  });
  it('combina série, favoritos e estado de leitura', () => {
    const books = [makeBook('a',{series:'Aurora',favorite:true,lastRead:1}),makeBook('b',{series:'Aurora'}),makeBook('c',{series:'Outra',favorite:true,lastRead:1})];
    expect(selectBooks(books,{...filters,series:'series:aurora',view:'favorites',status:'reading'}).map(book => book.id)).toEqual(['a']);
  });
});

describe('edição de dados do volume', () => {
  it('normaliza espaços e aceita remover a organização de um volume', () => {
    expect(normalizeMetadata({title:' Volume  2 ',series:' Aurora  Azul ',chapter:' 2 '})).toEqual({title:'Volume 2',series:'Aurora Azul',chapter:'2'});
    expect(normalizeMetadata({title:'Volume',series:'',chapter:''}).series).toBe('');
  });
  it('rejeita título vazio, capítulo sem série e dados inválidos', () => {
    expect(() => normalizeMetadata({title:' ',series:'',chapter:''})).toThrow('título');
    expect(() => normalizeMetadata({title:'Volume',series:'',chapter:'2'})).toThrow('série');
    expect(() => normalizeMetadata({title:'x'.repeat(513),series:'',chapter:''})).toThrow('tamanho');
    expect(() => normalizeMetadata({title:'Volume\u0000',series:'',chapter:''})).toThrow('controle');
  });
});
