import { BookOpen, Check, Heart, Pencil, Trash2 } from 'lucide-react';
import { progress, type Book } from '../domain';
import { asset } from '../services/library';

interface Props {
  book: Book;
  busy: boolean;
  read: () => void;
  favorite: () => void;
  edit: () => void;
  remove: () => void;
  selectSeries: () => void;
}

export default function BookCard({ book, busy, read, favorite, edit, remove, selectSeries }: Props) {
  return <article className="book-card">
    <div className="cover-wrap">
      <button className="cover-button" disabled={busy} onClick={read} aria-label={`Ler ${book.title}`}><img src={asset(book.cover)} loading="lazy" alt={`Capa de ${book.title}`}/><span className="cover-overlay"><BookOpen size={24}/> {book.lastRead === null ? 'Começar leitura' : 'Continuar'}</span></button>
      <span className="format-badge">{book.format === 'stream' ? 'ONLINE · CACHE PARCIAL' : book.format.toUpperCase()}</span>
      <button className={`favorite-button ${book.favorite ? 'is-favorite' : ''}`} disabled={busy} onClick={favorite} aria-label={book.favorite ? `Remover ${book.title} dos favoritos` : `Favoritar ${book.title}`} aria-pressed={book.favorite}><Heart size={17} fill={book.favorite ? 'currentColor' : 'none'}/></button>
      {book.completed && <span className="completed-badge"><Check size={13}/> Lido</span>}
    </div>
    <div className="book-info">
      <h3 title={book.title}>{book.title}</h3>
      <div className="book-actions"><button className="card-action" disabled={busy} aria-label={`Editar ${book.title}`} onClick={edit}><Pencil size={14}/></button><button className="card-action" disabled={busy} aria-label={`Remover ${book.title}`} onClick={remove}><Trash2 size={14}/></button></div>
      {book.series ? <button className="book-series" title={[book.series,book.chapter].filter(Boolean).join(' · ')} aria-label={`Ver série ${book.series}`} onClick={selectSeries}>{book.series}{book.chapter && <span> · {book.chapter}</span>}</button> : <span className="book-series standalone">Volume avulso</span>}
      <p>{book.pageCount} páginas <span>·</span> {book.lastRead === null ? 'Não lido' : `${progress(book)}% lido`}</p>
      <div className="progress-track"><div style={{ width: `${progress(book)}%` }}/></div>
    </div>
  </article>;
}
