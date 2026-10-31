import type { Book, BookMetadata } from './domain';

export type LibraryView = 'library' | 'favorites' | 'recent' | 'settings' | 'online';
export interface LibraryFilters { view: LibraryView; query: string; status: string; sort: string; series: string }
const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
const tidy = (value: string) => value.trim().replace(/\s+/gu, ' ');
export const seriesKey = (value: string) => tidy(value.normalize('NFKC')).toLocaleLowerCase('pt-BR');
const searchKey = (value: string) => seriesKey(value).normalize('NFD').replace(/\p{M}/gu, '');

export function normalizeMetadata(input: BookMetadata): BookMetadata {
  const value = { title: tidy(input.title), series: tidy(input.series), chapter: tidy(input.chapter) };
  if (!value.title) throw new Error('Informe um título para o volume.');
  if ([...value.title].length > 512 || [...value.series].length > 256 || [...value.chapter].length > 80) throw new Error('Título, série ou capítulo excede o tamanho permitido.');
  if (Object.values(value).some(text => /[\u0000-\u001f\u007f-\u009f]/u.test(text))) throw new Error('Remova os caracteres de controle dos campos.');
  if (value.chapter && !value.series) throw new Error('Informe a série antes de definir o capítulo.');
  return value;
}

export function seriesOptions(books: Book[]) {
  const groups = new Map<string, { key: string; name: string; count: number }>();
  for (const book of books) {
    const key = seriesKey(book.series || '');
    if (!key) continue;
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { key, name: tidy(book.series), count: 1 });
  }
  return [...groups.values()].sort((a, b) => collator.compare(a.name, b.name));
}

export function selectBooks(books: Book[], filters: LibraryFilters): Book[] {
  const query = searchKey(filters.query);
  return books.filter(book => {
    const matchesQuery = searchKey([book.title, book.series || '', book.chapter || ''].join(' ')).includes(query);
    const key = seriesKey(book.series || '');
    const matchesSeries = filters.series === 'all' || (filters.series === 'none' ? !key : `series:${key}` === filters.series);
    const matchesView = (filters.view !== 'favorites' || book.favorite) && (filters.view !== 'recent' || book.lastRead !== null);
    const matchesStatus = filters.status === 'all' || (filters.status === 'reading' ? book.lastRead !== null && !book.completed : filters.status === 'done' ? book.completed : book.lastRead === null);
    return matchesQuery && matchesSeries && matchesView && matchesStatus;
  }).sort((a, b) => {
    if (filters.sort === 'title') return collator.compare(a.title, b.title) || a.id.localeCompare(b.id);
    if (filters.sort === 'chapter') {
      const keyA = seriesKey(a.series || ''); const keyB = seriesKey(b.series || '');
      if (!keyA !== !keyB) return keyA ? -1 : 1;
      const seriesOrder = collator.compare(keyA, keyB);
      if (seriesOrder) return seriesOrder;
      if (!a.chapter !== !b.chapter) return a.chapter ? -1 : 1;
      return collator.compare(a.chapter || '', b.chapter || '') || collator.compare(a.title, b.title) || a.id.localeCompare(b.id);
    }
    return (filters.sort === 'added' ? b.addedAt - a.addedAt : (b.lastRead ?? b.addedAt) - (a.lastRead ?? a.addedAt)) || collator.compare(a.title, b.title) || a.id.localeCompare(b.id);
  });
}
