use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::{fs, io::{Read, Write}, path::{Path, PathBuf}, sync::{Arc, Mutex}, time::{SystemTime, UNIX_EPOCH}};
use uuid::Uuid;
use walkdir::WalkDir;

pub type Result<T> = std::result::Result<T, String>;
const MAX_PAGES: usize = 10_000;
const MAX_PAGE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_BOOK_BYTES: u64 = 1024 * 1024 * 1024;
fn err(e: impl std::fmt::Display) -> String { e.to_string() }
fn now() -> i64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64 }
fn image_extension(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    match extension.as_str() { "jpg" | "jpeg" | "png" | "webp" | "gif" | "bmp" => Some(extension), _ => None }
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub id: String, pub title: String, pub series: String, pub chapter: String, pub source: String, pub format: String, pub cover: String,
    pub page_count: usize, pub page: usize, pub completed: bool, pub favorite: bool, pub added_at: i64, pub last_read: Option<i64>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BookMetadata { pub title: String, pub series: String, pub chapter: String }

pub(crate) fn normalize_metadata(value: BookMetadata) -> Result<BookMetadata> {
    let clean = |value: String| value.split_whitespace().collect::<Vec<_>>().join(" ");
    let value = BookMetadata { title: clean(value.title), series: clean(value.series), chapter: clean(value.chapter) };
    if value.title.is_empty() { return Err("Informe um título para o volume".into()); }
    if value.title.chars().count() > 512 || value.series.chars().count() > 256 || value.chapter.chars().count() > 80 {
        return Err("Título, série ou capítulo excede o tamanho permitido".into());
    }
    if [&value.title,&value.series,&value.chapter].iter().any(|text| text.chars().any(char::is_control)) {
        return Err("Remova os caracteres de controle dos campos".into());
    }
    if !value.chapter.is_empty() && value.series.is_empty() { return Err("Informe a série antes de definir o capítulo".into()); }
    Ok(value)
}
#[derive(Serialize)]
pub struct BookPages { pub book: Book, pub pages: Vec<String>, pub bookmarks: Vec<usize> }
pub(crate) struct ImportOutcome { pub book: Book, pub added: bool }

#[derive(Clone)]
pub struct Library {
    pub(crate) root: PathBuf,
    pub(crate) mutation: Arc<Mutex<()>>,
    pub(crate) pending_restore: Arc<Mutex<Option<crate::backup::PendingRestore>>>,
}
impl Library {
    pub fn new(root: PathBuf) -> Result<Self> {
        fs::create_dir_all(root.join("library")).map_err(err)?;
        let library = Self { root, mutation: Arc::new(Mutex::new(())), pending_restore: Arc::new(Mutex::new(None)) };
        let mut conn = library.db()?;
        let version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0)).map_err(err)?;
        if version > 3 { return Err("O banco foi criado por uma versão mais recente do Selene. Atualize o programa para abri-lo.".into()); }
        conn.execute_batch("PRAGMA journal_mode=WAL;").map_err(err)?;
        let transaction = conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(err)?;
        let version: i64 = transaction.query_row("PRAGMA user_version", [], |row| row.get(0)).map_err(err)?;
        if version > 3 { return Err("Atualize o programa para abrir esta biblioteca".into()); }
        transaction.execute_batch("
          CREATE TABLE IF NOT EXISTS books (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL UNIQUE,
            format TEXT NOT NULL, page_count INTEGER NOT NULL CHECK(page_count>0),
            page INTEGER NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0,
            favorite INTEGER NOT NULL DEFAULT 0, added_at INTEGER NOT NULL, last_read INTEGER
          );
          CREATE TABLE IF NOT EXISTS pages (book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            position INTEGER NOT NULL, path TEXT NOT NULL, PRIMARY KEY(book_id,position));
          CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS bookmarks (
            book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            page INTEGER NOT NULL CHECK(page>=0), PRIMARY KEY(book_id,page)
          );
          CREATE TABLE IF NOT EXISTS book_details (
            book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
            series TEXT NOT NULL DEFAULT '', chapter TEXT NOT NULL DEFAULT ''
          );
          CREATE TABLE IF NOT EXISTS stream_pages (
            book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            position INTEGER NOT NULL, server TEXT NOT NULL, manga_id INTEGER NOT NULL,
            chapter_id INTEGER NOT NULL, url TEXT NOT NULL, PRIMARY KEY(book_id,position)
          );
          PRAGMA user_version=3;").map_err(err)?;
        transaction.commit().map_err(err)?;
        Ok(library)
    }
    pub(crate) fn db(&self) -> Result<Connection> {
        let conn = Connection::open(self.root.join("yomi.sqlite3")).map_err(err)?;
        conn.busy_timeout(std::time::Duration::from_secs(10)).map_err(err)?;
        conn.execute_batch("PRAGMA foreign_keys=ON;").map_err(err)?;
        Ok(conn)
    }
    pub fn list(&self) -> Result<Vec<Book>> {
        let conn = self.db()?;
        let mut query = conn.prepare("SELECT b.id,b.title,b.source,b.format,p.path,b.page_count,b.page,b.completed,b.favorite,b.added_at,b.last_read,COALESCE(d.series,''),COALESCE(d.chapter,'') FROM books b JOIN pages p ON p.book_id=b.id AND p.position=0 LEFT JOIN book_details d ON d.book_id=b.id ORDER BY COALESCE(b.last_read,b.added_at) DESC").map_err(err)?;
        let rows = query.query_map([], |row| Ok(Book { id: row.get(0)?, title: row.get(1)?, source: row.get(2)?, format: row.get(3)?, cover: row.get(4)?, page_count: row.get(5)?, page: row.get(6)?, completed: row.get(7)?, favorite: row.get(8)?, added_at: row.get(9)?, last_read: row.get(10)?, series: row.get(11)?, chapter: row.get(12)? })).map_err(err)?;
        rows.collect::<std::result::Result<Vec<_>, _>>().map_err(err)
    }
    pub fn open(&self, id: &str) -> Result<BookPages> {
        let book = self.list()?.into_iter().find(|b| b.id == id).ok_or("Mangá não encontrado")?;
        let conn = self.db()?;
        let mut query = conn.prepare("SELECT path FROM pages WHERE book_id=?1 ORDER BY position").map_err(err)?;
        let pages = query.query_map([id], |r| r.get::<_, String>(0)).map_err(err)?.collect::<std::result::Result<Vec<_>, _>>().map_err(err)?;
        if book.format!="stream" && pages.iter().any(|p| !Path::new(p).is_file()) { return Err("Algumas páginas não estão disponíveis. Remova o título e importe o original novamente.".into()); }
        let mut query = conn.prepare("SELECT page FROM bookmarks WHERE book_id=?1 ORDER BY page").map_err(err)?;
        let bookmarks = query.query_map([id], |r| r.get::<_, usize>(0)).map_err(err)?.collect::<std::result::Result<Vec<_>, _>>().map_err(err)?;
        Ok(BookPages { book, pages, bookmarks })
    }
    pub fn import(&self, source: &Path, kind: &str) -> Result<Book> {
        self.import_with_outcome(source,kind).map(|outcome| outcome.book)
    }
    pub(crate) fn import_with_outcome(&self, source: &Path, kind: &str) -> Result<ImportOutcome> {
        let _guard = self.mutation.lock().map_err(err)?;
        let source = source.canonicalize().map_err(err)?;
        let app_root = self.root.canonicalize().map_err(err)?;
        if source.starts_with(&app_root) || (kind == "folder" && app_root.starts_with(&source)) {
            return Err("Escolha uma pasta que não contenha os dados internos do Selene".into());
        }
        let source_key = source.to_string_lossy().to_string();
        if let Some(book) = self.list()?.into_iter().find(|b| b.source == source_key) { return Ok(ImportOutcome { book, added: false }); }
        let id = Uuid::new_v4().to_string();
        let target = self.root.join("library").join(&id);
        fs::create_dir(&target).map_err(err)?;
        // All paths below target are generated IDs, never names taken from an archive.
        let attempt = (|| -> Result<Book> {
            let pages = match kind { "folder" => import_folder(&source, &target)?, "cbz" => import_cbz(&source, &target)?, "pdf" => crate::pdf::import(&source, &target)?, _ => return Err("Formato não suportado".into()) };
            if pages.is_empty() { return Err("Nenhuma imagem suportada foi encontrada".into()); }
            let name = if source.is_dir() { source.file_name() } else { source.file_stem() };
            let title = name.map(|n| n.to_string_lossy().to_string()).filter(|n| !n.is_empty()).unwrap_or_else(|| "Sem título".into());
            let mut conn = self.db()?;
            let tx = conn.transaction().map_err(err)?;
            let added = now();
            tx.execute("INSERT INTO books(id,title,source,format,page_count,added_at) VALUES(?1,?2,?3,?4,?5,?6)", params![id,title,source_key,kind,pages.len(),added]).map_err(err)?;
            for (position, path) in pages.iter().enumerate() {
                let page_path = path.to_string_lossy().to_string();
                tx.execute("INSERT INTO pages(book_id,position,path) VALUES(?1,?2,?3)", params![id,position,page_path]).map_err(err)?;
            }
            tx.commit().map_err(err)?;
            Ok(Book { id: id.clone(), title, series: String::new(), chapter: String::new(), source: source_key, format: kind.into(), cover: pages[0].to_string_lossy().to_string(), page_count: pages.len(), page: 0, completed: false, favorite: false, added_at: added, last_read: None })
        })();
        if attempt.is_err() { let _ = fs::remove_dir_all(&target); }
        attempt.map(|book| ImportOutcome { book, added: true })
    }
    pub fn progress(&self, id: &str, page: usize, completed: bool) -> Result<()> {
        let conn = self.db()?;
        let count: usize = conn.query_row("SELECT page_count FROM books WHERE id=?1", [id], |r| r.get(0)).map_err(err)?;
        if page >= count { return Err("Página fora dos limites do mangá".into()); }
        // Completion is allowed only when the final page is visible (including a double spread).
        let completed = completed && page.saturating_add(2) >= count;
        conn.execute("UPDATE books SET page=?1,completed=?2,last_read=?3 WHERE id=?4", params![page,completed,now(),id]).map_err(err)?;
        Ok(())
    }
    pub fn favorite(&self, id: &str, favorite: bool) -> Result<()> {
        let updated = self.db()?.execute("UPDATE books SET favorite=?1 WHERE id=?2", params![favorite,id]).map_err(err)?;
        if updated == 0 { return Err("Mangá não encontrado".into()); } Ok(())
    }
    pub fn update_metadata(&self, id: &str, metadata: BookMetadata) -> Result<()> {
        let metadata = normalize_metadata(metadata)?;
        let _guard = self.mutation.lock().map_err(err)?;
        let mut conn = self.db()?;
        let transaction = conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(err)?;
        if transaction.execute("UPDATE books SET title=?1 WHERE id=?2", params![metadata.title,id]).map_err(err)? == 0 {
            return Err("Mangá não encontrado".into());
        }
        transaction.execute("INSERT INTO book_details(book_id,series,chapter) VALUES(?1,?2,?3) ON CONFLICT(book_id) DO UPDATE SET series=excluded.series,chapter=excluded.chapter", params![id,metadata.series,metadata.chapter]).map_err(err)?;
        transaction.commit().map_err(err)
    }
    pub fn bookmark(&self, id: &str, page: usize, marked: bool) -> Result<()> {
        let conn = self.db()?;
        let count: usize = conn.query_row("SELECT page_count FROM books WHERE id=?1", [id], |r| r.get(0)).map_err(err)?;
        if page >= count { return Err("Página fora dos limites do mangá".into()); }
        if marked {
            conn.execute("INSERT INTO bookmarks(book_id,page) VALUES(?1,?2) ON CONFLICT DO NOTHING", params![id,page]).map_err(err)?;
        } else {
            conn.execute("DELETE FROM bookmarks WHERE book_id=?1 AND page=?2", params![id,page]).map_err(err)?;
        }
        Ok(())
    }
    pub fn remove(&self, id: &str) -> Result<()> {
        let _guard = self.mutation.lock().map_err(err)?;
        Uuid::parse_str(id).map_err(|_| "Identificador inválido")?;
        let updated = self.db()?.execute("DELETE FROM books WHERE id=?1", [id]).map_err(err)?;
        if updated == 0 { return Err("Mangá não encontrado".into()); }
        // Never delete original source files. Unreferenced cache can be cleaned on next startup.
        let _ = fs::remove_dir_all(self.root.join("library").join(id));
        Ok(())
    }
    pub fn settings(&self) -> Result<serde_json::Value> {
        let json: Option<String> = self.db()?.query_row("SELECT value FROM settings WHERE id=1", [], |r| r.get(0)).optional().map_err(err)?;
        json.map(|s| serde_json::from_str(&s).map_err(err)).unwrap_or(Ok(serde_json::json!({})))
    }
    pub fn save_settings(&self, value: serde_json::Value) -> Result<()> {
        if !value.is_object() || value.to_string().len() > 16_384 { return Err("Configurações inválidas".into()); }
        self.db()?.execute("INSERT INTO settings(id,value) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET value=excluded.value", [value.to_string()]).map_err(err)?;
        Ok(())
    }
}
fn copy_page(mut reader: impl Read, path: &Path, total: &mut u64) -> Result<()> {
    let mut out = fs::File::create(path).map_err(err)?;
    let remaining = MAX_BOOK_BYTES.saturating_sub(*total).min(MAX_PAGE_BYTES);
    let copied = std::io::copy(&mut reader.by_ref().take(remaining + 1), &mut out).map_err(err)?;
    *total += copied;
    if copied == 0 { return Err("Uma imagem está vazia".into()); }
    if copied > remaining { return Err("Limite excedido: 64 MiB por imagem e 1 GiB por volume".into()); }
    out.flush().map_err(err)?;
    Ok(())
}
fn import_folder(source: &Path, target: &Path) -> Result<Vec<PathBuf>> {
    if !source.is_dir() { return Err("Selecione uma pasta válida".into()); }
    let mut files = Vec::new();
    for entry in WalkDir::new(source).follow_links(false).max_depth(32) {
        let entry = entry.map_err(err)?;
        if entry.file_type().is_file() && image_extension(entry.path()).is_some() {
            files.push(entry.path().to_path_buf());
            if files.len() > MAX_PAGES { return Err("Limite de 10.000 páginas excedido".into()); }
        }
    }
    files.sort_by(|a,b| natord::compare(&a.to_string_lossy(), &b.to_string_lossy()));
    let mut total = 0;
    files.iter().enumerate().map(|(i,p)| {
        let out = target.join(format!("{i:06}.{}", image_extension(p).unwrap()));
        copy_page(fs::File::open(p).map_err(err)?, &out, &mut total)?;
        Ok(out)
    }).collect()
}
fn import_cbz(source: &Path, target: &Path) -> Result<Vec<PathBuf>> {
    let mut archive = zip::ZipArchive::new(fs::File::open(source).map_err(err)?).map_err(err)?;
    if archive.len() > 50_000 { return Err("Arquivo contém entradas demais".into()); }
    let mut entries = Vec::new();
    for index in 0..archive.len() {
        let file = archive.by_index(index).map_err(err)?;
        let name = file.name().replace('\\', "/");
        if file.is_dir() || name.starts_with("__MACOSX/") || name.split('/').any(|p| p.starts_with('.')) { continue; }
        if let Some(ext) = image_extension(Path::new(&name)) {
            if file.size() > MAX_PAGE_BYTES { return Err("Uma imagem excede 64 MiB".into()); }
            entries.push((index,name,ext));
            if entries.len() > MAX_PAGES { return Err("Limite de 10.000 páginas excedido".into()); }
        }
    }
    entries.sort_by(|a,b| natord::compare(&a.1, &b.1));
    let mut total = 0;
    entries.into_iter().enumerate().map(|(position,(index,_,ext))| {
        let out = target.join(format!("{position:06}.{ext}"));
        copy_page(archive.by_index(index).map_err(err)?, &out, &mut total)?;
        Ok(out)
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    fn fixture() -> (TempDir, Library, PathBuf) {
        let temp = TempDir::new().unwrap();
        let library = Library::new(temp.path().join("data")).unwrap();
        let source = temp.path().join("Meu mangá");
        fs::create_dir(&source).unwrap();
        for n in [10,2,1] { fs::write(source.join(format!("{n}.png")), format!("image-{n}")).unwrap(); }
        (temp,library,source)
    }
    #[test]
    fn imports_naturally_and_persists_progress_after_reopen() {
        let (_temp,lib,source) = fixture();
        let book = lib.import(&source,"folder").unwrap();
        assert_eq!(book.page_count,3);
        let pages = lib.open(&book.id).unwrap().pages;
        assert_eq!(fs::read_to_string(&pages[1]).unwrap(),"image-2");
        lib.progress(&book.id,2,true).unwrap();
        lib.favorite(&book.id,true).unwrap();
        let reopened = Library::new(lib.root.clone()).unwrap();
        let saved = reopened.open(&book.id).unwrap().book;
        assert_eq!(saved.page,2); assert!(saved.completed); assert!(saved.favorite);
        assert!(lib.progress(&book.id,3,true).is_err());
        assert_eq!(lib.import(&source,"folder").unwrap().id,book.id);
    }
    #[test]
    fn failed_import_cleans_up_and_removal_preserves_source() {
        let (temp,lib,source) = fixture();
        let empty = temp.path().join("empty"); fs::create_dir(&empty).unwrap();
        assert!(lib.import(&empty,"folder").is_err());
        assert_eq!(fs::read_dir(lib.root.join("library")).unwrap().count(),0);
        let book = lib.import(&source,"folder").unwrap();
        lib.remove(&book.id).unwrap();
        assert!(source.join("1.png").exists()); assert!(lib.list().unwrap().is_empty());
        assert!(lib.remove("../escape").is_err());
    }
    #[test]
    fn archive_names_never_escape_cache_and_sort_naturally() {
        let temp = TempDir::new().unwrap();
        let cbz = temp.path().join("volume.cbz");
        let mut writer = zip::ZipWriter::new(fs::File::create(&cbz).unwrap());
        for (name,bytes) in [("nested/10.jpg","ten"),("nested/2.jpg","two"),("../../escape.jpg","escape"),("notes.txt","ignore")] {
            writer.start_file(name, zip::write::SimpleFileOptions::default()).unwrap();
            writer.write_all(bytes.as_bytes()).unwrap();
        }
        writer.finish().unwrap();
        let lib = Library::new(temp.path().join("data")).unwrap();
        let book = lib.import(&cbz,"cbz").unwrap();
        assert_eq!(book.page_count,2);
        let pages = lib.open(&book.id).unwrap().pages;
        assert_eq!(fs::read_to_string(&pages[0]).unwrap(),"two");
        assert!(!temp.path().join("escape.jpg").exists());
        assert!(pages.iter().all(|p| Path::new(p).starts_with(lib.root.join("library"))));
    }
    #[test]
    fn settings_roundtrip_and_rejects_nonobject() {
        let (_temp,lib,_) = fixture();
        let value = serde_json::json!({"theme":"sepia","mode":"webtoon"});
        lib.save_settings(value.clone()).unwrap(); assert_eq!(lib.settings().unwrap(),value);
        assert!(lib.save_settings(serde_json::json!("invalid")).is_err());
    }
    #[test]
    fn bookmarks_survive_reopen_are_unique_and_cascade_on_removal() {
        let (_temp,lib,source) = fixture();
        let book = lib.import(&source,"folder").unwrap();
        lib.bookmark(&book.id,2,true).unwrap();
        lib.bookmark(&book.id,0,true).unwrap();
        lib.bookmark(&book.id,2,true).unwrap();
        let reopened = Library::new(lib.root.clone()).unwrap();
        assert_eq!(reopened.open(&book.id).unwrap().bookmarks,vec![0,2]);
        assert!(lib.bookmark(&book.id,3,true).is_err());
        lib.bookmark(&book.id,0,false).unwrap();
        assert_eq!(lib.open(&book.id).unwrap().bookmarks,vec![2]);
        lib.remove(&book.id).unwrap();
        let count: usize = lib.db().unwrap().query_row("SELECT COUNT(*) FROM bookmarks", [], |r| r.get(0)).unwrap();
        assert_eq!(count,0);
    }
    #[test]
    fn upgrades_v1_without_losing_the_collection() {
        let (_temp,lib,source) = fixture();
        let book = lib.import(&source,"folder").unwrap();
        lib.db().unwrap().execute_batch("DROP TABLE bookmarks; DROP TABLE book_details; PRAGMA user_version=1;").unwrap();
        let upgraded = Library::new(lib.root.clone()).unwrap();
        assert_eq!(upgraded.list().unwrap().len(),1);
        upgraded.bookmark(&book.id,1,true).unwrap();
        assert_eq!(upgraded.open(&book.id).unwrap().bookmarks,vec![1]);
    }
    #[test]
    fn metadata_edit_preserves_reading_and_original_files() {
        let (_temp,lib,source) = fixture();
        let book = lib.import(&source,"folder").unwrap();
        lib.progress(&book.id,1,false).unwrap(); lib.bookmark(&book.id,1,true).unwrap();
        lib.update_metadata(&book.id,BookMetadata { title: " Volume  2 ".into(), series: " Aurora ".into(), chapter: " 2 ".into() }).unwrap();
        let reopened = Library::new(lib.root.clone()).unwrap().open(&book.id).unwrap();
        assert_eq!(reopened.book.title,"Volume 2"); assert_eq!(reopened.book.series,"Aurora"); assert_eq!(reopened.book.chapter,"2");
        assert_eq!(reopened.book.page,1); assert_eq!(reopened.book.source,book.source); assert_eq!(reopened.bookmarks,vec![1]);
        assert!(source.join("1.png").exists());
        assert!(lib.update_metadata(&book.id,BookMetadata { title:" ".into(),series:"".into(),chapter:"".into() }).is_err());
        assert!(lib.update_metadata(&book.id,BookMetadata { title:"Volume".into(),series:"".into(),chapter:"2".into() }).is_err());
        lib.remove(&book.id).unwrap();
        let count: usize = lib.db().unwrap().query_row("SELECT COUNT(*) FROM book_details", [], |row| row.get(0)).unwrap();
        assert_eq!(count,0);
    }
    #[test]
    fn v2_upgrade_adds_organization_without_losing_pages_or_progress() {
        let (_temp,lib,source) = fixture();
        let book = lib.import(&source,"folder").unwrap(); lib.progress(&book.id,1,false).unwrap();
        lib.db().unwrap().execute_batch("DROP TABLE book_details; PRAGMA user_version=2;").unwrap();
        let upgraded = Library::new(lib.root.clone()).unwrap();
        let data = upgraded.open(&book.id).unwrap();
        assert_eq!(data.book.page,1); assert_eq!(data.pages.len(),3); assert!(data.book.series.is_empty());
        let version: i64 = upgraded.db().unwrap().query_row("PRAGMA user_version", [], |row| row.get(0)).unwrap();
        assert_eq!(version,3);
    }
}
