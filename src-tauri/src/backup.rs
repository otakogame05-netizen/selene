use crate::storage::{normalize_metadata, BookMetadata, Library, Result};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, io::{Read, Write}, path::Path, time::{SystemTime, UNIX_EPOCH}};
use uuid::Uuid;

const MAX_BACKUP_BYTES: u64 = 8 * 1024 * 1024;
fn error(value: impl std::fmt::Display) -> String { value.to_string() }
fn now() -> i64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64 }

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Organization { series: String, chapter: String }

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ReadingEntry {
    id: String, title: String, source: String, format: String,
    page_count: usize, page: usize, completed: bool, favorite: bool,
    last_read: Option<i64>, bookmarks: Vec<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    organization: Option<Organization>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ReadingBackup {
    kind: String, version: u32, created_at: i64,
    books: Vec<ReadingEntry>, settings: Option<serde_json::Value>,
}

impl ReadingBackup {
    fn validate(&self) -> Result<()> {
        if self.kind != "yomi-reading-backup" || !matches!(self.version,1 | 2) {
            return Err("Formato ou versão de backup não suportado".into());
        }
        if self.created_at < 0 || self.books.len() > 10_000 { return Err("Backup excede os limites permitidos".into()); }
        if let Some(settings) = &self.settings {
            if !settings.is_object() || settings.to_string().len() > 16_384 { return Err("Configurações inválidas no backup".into()); }
        }
        let mut ids = HashSet::new();
        let mut sources = HashSet::new();
        for book in &self.books {
            if (self.version == 2) != book.organization.is_some() { return Err("Dados de organização incompatíveis com a versão do backup".into()); }
            if let Some(organization) = &book.organization {
                normalize_metadata(BookMetadata { title: book.title.clone(), series: organization.series.clone(), chapter: organization.chapter.clone() })?;
            }
            if Uuid::parse_str(&book.id).is_err() || !ids.insert(book.id.as_str()) || !sources.insert(book.source.as_str()) {
                return Err("O backup contém identificadores inválidos ou volumes duplicados".into());
            }
            if book.title.is_empty() || book.title.len() > 4096 || book.source.is_empty() || book.source.len() > 32768
                || !matches!(book.format.as_str(), "folder" | "cbz" | "online") || book.page_count == 0 || book.page_count > 10_000
                || book.page >= book.page_count || book.last_read.is_some_and(|value| value < 0)
                || (book.completed && (book.last_read.is_none() || book.page.saturating_add(2) < book.page_count)) {
                return Err("O backup contém dados de leitura inválidos".into());
            }
            let mut marks = HashSet::new();
            if book.bookmarks.len() > book.page_count || book.bookmarks.iter().any(|page| *page >= book.page_count || !marks.insert(*page)) {
                return Err("O backup contém marcadores inválidos ou duplicados".into());
            }
        }
        Ok(())
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewRow { pub title: String, pub matched: bool, pub reason: String }

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestorePreview {
    pub token: String, pub created_at: i64, pub matched: usize, pub skipped: usize,
    pub settings_included: bool, pub rows: Vec<PreviewRow>,
    pub organization_included: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResult { pub restored: usize, pub skipped: usize, pub settings_restored: bool, pub organization_restored: bool, pub recovery_path: String }

#[derive(Clone)]
pub(crate) struct PendingRestore { token: String, incoming: ReadingBackup, baseline: ReadingBackup }

fn find_target<'a>(incoming: &ReadingEntry, current: &'a [ReadingEntry]) -> Option<&'a ReadingEntry> {
    current.iter().find(|book| book.id == incoming.id)
        .or_else(|| current.iter().find(|book| book.source == incoming.source))
        .filter(|book| book.page_count == incoming.page_count && book.format == incoming.format)
}

fn check_unique_targets(incoming: &[ReadingEntry], current: &[ReadingEntry]) -> Result<()> {
    let mut targets = HashSet::new();
    for entry in incoming {
        if let Some(target) = find_target(entry, current) {
            if !targets.insert(target.id.as_str()) {
                return Err("O backup aponta mais de uma entrada para o mesmo volume. Nenhuma alteração foi aplicada".into());
            }
        }
    }
    Ok(())
}

fn snapshot(connection: &Connection) -> Result<ReadingBackup> {
    let mut query = connection.prepare("SELECT b.id,b.title,b.source,b.format,b.page_count,b.page,b.completed,b.favorite,b.last_read,COALESCE(d.series,''),COALESCE(d.chapter,'') FROM books b LEFT JOIN book_details d ON d.book_id=b.id ORDER BY b.id").map_err(error)?;
    let mut books = query.query_map([], |row| Ok(ReadingEntry {
        id: row.get(0)?, title: row.get(1)?, source: row.get(2)?, format: row.get(3)?, page_count: row.get(4)?,
        page: row.get(5)?, completed: row.get(6)?, favorite: row.get(7)?, last_read: row.get(8)?, bookmarks: Vec::new(),
        organization: Some(Organization { series: row.get(9)?, chapter: row.get(10)? }),
    })).map_err(error)?.collect::<std::result::Result<Vec<_>, _>>().map_err(error)?;
    let mut query = connection.prepare("SELECT page FROM bookmarks WHERE book_id=?1 ORDER BY page").map_err(error)?;
    for book in &mut books {
        book.bookmarks = query.query_map([&book.id], |row| row.get::<_, usize>(0)).map_err(error)?
            .collect::<std::result::Result<Vec<_>, _>>().map_err(error)?;
    }
    let json: Option<String> = connection.query_row("SELECT value FROM settings WHERE id=1", [], |row| row.get(0)).optional().map_err(error)?;
    let settings = json.map(|value| serde_json::from_str(&value).map_err(error)).transpose()?;
    Ok(ReadingBackup { kind: "yomi-reading-backup".into(), version: 2, created_at: now(), books, settings })
}

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    if bytes.len() as u64 > MAX_BACKUP_BYTES { return Err("Backup excede o limite de 8 MiB".into()); }
    let parent = path.parent().ok_or("Pasta de destino inválida")?;
    let temporary = parent.join(format!(".yomi-{}.tmp", Uuid::new_v4()));
    let result = (|| -> Result<()> {
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temporary).map_err(error)?;
        file.write_all(bytes).map_err(error)?;
        file.sync_all().map_err(error)?;
        drop(file);
        fs::rename(&temporary, path).map_err(error)?;
        Ok(())
    })();
    if result.is_err() { let _ = fs::remove_file(&temporary); }
    result
}

impl Library {
    pub fn export_reading_backup(&self, path: &Path) -> Result<()> {
        if path.extension().and_then(|value| value.to_str()).map(str::to_ascii_lowercase).as_deref() != Some("json") {
            return Err("Salve o backup com a extensão .json".into());
        }
        let parent = path.parent().ok_or("Pasta de destino inválida")?.canonicalize().map_err(error)?;
        if parent.starts_with(self.root.canonicalize().map_err(error)?) {
            return Err("Salve o backup fora da pasta interna do aplicativo".into());
        }
        let mut connection = self.db()?;
        let transaction = connection.transaction().map_err(error)?;
        let backup = snapshot(&transaction)?;
        backup.validate()?;
        let bytes = serde_json::to_vec_pretty(&backup).map_err(error)?;
        transaction.commit().map_err(error)?;
        write_atomic(path, &bytes)
    }

    pub fn preview_reading_restore(&self, path: &Path) -> Result<RestorePreview> {
        let mut bytes = Vec::new();
        fs::File::open(path).map_err(error)?.take(MAX_BACKUP_BYTES + 1).read_to_end(&mut bytes).map_err(error)?;
        if bytes.len() as u64 > MAX_BACKUP_BYTES { return Err("Backup excede o limite de 8 MiB".into()); }
        let incoming: ReadingBackup = serde_json::from_slice(&bytes).map_err(|_| "O arquivo não é um backup de leitura Selene válido")?;
        incoming.validate()?;
        let _guard = self.mutation.lock().map_err(error)?;
        let mut connection = self.db()?;
        let transaction = connection.transaction().map_err(error)?;
        let baseline = snapshot(&transaction)?;
        transaction.commit().map_err(error)?;
        check_unique_targets(&incoming.books, &baseline.books)?;
        let token = Uuid::new_v4().to_string();
        let rows: Vec<PreviewRow> = incoming.books.iter().map(|entry| {
            let matched = find_target(entry, &baseline.books).is_some();
            PreviewRow { title: entry.title.clone(), matched, reason: if matched { "Volume identificado; os dados incluídos serão substituídos" } else { "Volume ausente ou formato/quantidade de páginas diferente" }.into() }
        }).collect();
        let matched = rows.iter().filter(|row| row.matched).count();
        let preview = RestorePreview { token: token.clone(), created_at: incoming.created_at, matched, skipped: rows.len() - matched, settings_included: incoming.settings.is_some(), organization_included: incoming.version == 2, rows };
        *self.pending_restore.lock().map_err(error)? = Some(PendingRestore { token, incoming, baseline });
        Ok(preview)
    }

    pub fn cancel_reading_restore(&self, token: &str) -> Result<()> {
        let mut pending = self.pending_restore.lock().map_err(error)?;
        if pending.as_ref().is_some_and(|value| value.token == token) { *pending = None; }
        Ok(())
    }

    pub fn apply_reading_restore(&self, token: &str, include_settings: bool) -> Result<RestoreResult> {
        let _guard = self.mutation.lock().map_err(error)?;
        let pending = self.pending_restore.lock().map_err(error)?.as_ref().filter(|value| value.token == token)
            .cloned().ok_or("A prévia expirou. Selecione o backup novamente")?;
        let mut connection = self.db()?;
        let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate).map_err(error)?;
        let current = snapshot(&transaction)?;
        if current.books != pending.baseline.books || current.settings != pending.baseline.settings {
            return Err("A biblioteca mudou desde a prévia. Selecione o backup novamente antes de restaurar".into());
        }
        let matched = pending.incoming.books.iter().filter(|entry| find_target(entry, &current.books).is_some()).count();
        let settings_restored = include_settings && pending.incoming.settings.is_some();
        if matched == 0 && !settings_restored { return Err("Nenhum dado compatível foi selecionado para restauração".into()); }
        // This recovery snapshot is completed before any database mutation.
        let recovery_dir = self.root.join("backups");
        fs::create_dir_all(&recovery_dir).map_err(error)?;
        let recovery = recovery_dir.join(format!("antes-de-restaurar-{}.json", Uuid::new_v4()));
        write_atomic(&recovery, &serde_json::to_vec_pretty(&current).map_err(error)?)?;
        for entry in &pending.incoming.books {
            if let Some(target) = find_target(entry, &current.books) {
                transaction.execute("UPDATE books SET page=?1,completed=?2,favorite=?3,last_read=?4 WHERE id=?5", params![entry.page,entry.completed,entry.favorite,entry.last_read,target.id]).map_err(error)?;
                if let Some(organization) = &entry.organization {
                    let metadata = normalize_metadata(BookMetadata { title: entry.title.clone(),series:organization.series.clone(),chapter:organization.chapter.clone() })?;
                    transaction.execute("UPDATE books SET title=?1 WHERE id=?2", params![metadata.title,target.id]).map_err(error)?;
                    transaction.execute("INSERT INTO book_details(book_id,series,chapter) VALUES(?1,?2,?3) ON CONFLICT(book_id) DO UPDATE SET series=excluded.series,chapter=excluded.chapter", params![target.id,metadata.series,metadata.chapter]).map_err(error)?;
                }
                transaction.execute("DELETE FROM bookmarks WHERE book_id=?1", [&target.id]).map_err(error)?;
                for page in &entry.bookmarks {
                    transaction.execute("INSERT INTO bookmarks(book_id,page) VALUES(?1,?2)", params![target.id,page]).map_err(error)?;
                }
            }
        }
        if settings_restored {
            let settings = pending.incoming.settings.as_ref().unwrap();
            transaction.execute("INSERT INTO settings(id,value) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET value=excluded.value", [settings.to_string()]).map_err(error)?;
        }
        transaction.commit().map_err(error)?;
        // The transaction is committed; cleanup must never turn success into a reported failure.
        let _ = self.cancel_reading_restore(token);
        Ok(RestoreResult { restored: matched, skipped: pending.incoming.books.len() - matched, settings_restored, organization_restored: matched > 0 && pending.incoming.version == 2, recovery_path: recovery.to_string_lossy().to_string() })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn fixture() -> (TempDir, Library, String) {
        let temp = TempDir::new().unwrap();
        let library = Library::new(temp.path().join("data")).unwrap();
        let source = temp.path().join("volume");
        fs::create_dir(&source).unwrap();
        for page in 0..3 { fs::write(source.join(format!("{page}.png")), b"image-storage-fixture").unwrap(); }
        let id = library.import(&source,"folder").unwrap().id;
        (temp,library,id)
    }

    #[test]
    fn roundtrip_preview_does_not_mutate_and_restore_creates_recovery() {
        let (temp,library,id) = fixture();
        library.progress(&id,2,true).unwrap(); library.favorite(&id,true).unwrap(); library.bookmark(&id,1,true).unwrap();
        library.save_settings(serde_json::json!({"theme":"sepia"})).unwrap();
        let path = temp.path().join("backup.json"); library.export_reading_backup(&path).unwrap();
        library.progress(&id,0,false).unwrap(); library.favorite(&id,false).unwrap(); library.bookmark(&id,1,false).unwrap();
        library.save_settings(serde_json::json!({"theme":"light"})).unwrap();
        let preview = library.preview_reading_restore(&path).unwrap();
        assert_eq!(preview.matched,1); assert_eq!(library.open(&id).unwrap().book.page,0);
        let restored = library.apply_reading_restore(&preview.token,true).unwrap();
        let book = library.open(&id).unwrap();
        assert_eq!(book.book.page,2); assert!(book.book.favorite); assert_eq!(book.bookmarks,vec![1]);
        assert_eq!(library.settings().unwrap()["theme"],"sepia");
        let recovery: ReadingBackup = serde_json::from_slice(&fs::read(&restored.recovery_path).unwrap()).unwrap();
        assert_eq!(recovery.books[0].page,0);
        assert!(library.apply_reading_restore(&preview.token,true).is_err());
    }

    #[test]
    fn detects_stale_preview_and_invalid_bookmarks_without_changes() {
        let (temp,library,id) = fixture();
        let path = temp.path().join("backup.json"); library.export_reading_backup(&path).unwrap();
        let preview = library.preview_reading_restore(&path).unwrap();
        library.favorite(&id,true).unwrap();
        assert!(library.apply_reading_restore(&preview.token,false).is_err());
        assert!(library.open(&id).unwrap().book.favorite);
        let mut backup: ReadingBackup = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        backup.books[0].bookmarks = vec![99];
        fs::write(&path,serde_json::to_vec(&backup).unwrap()).unwrap();
        assert!(library.preview_reading_restore(&path).is_err());
        assert!(library.open(&id).unwrap().book.favorite);
    }

    #[test]
    fn reimport_matches_source_but_missing_volumes_are_not_created() {
        let (temp,library,id) = fixture();
        let source = library.open(&id).unwrap().book.source;
        library.progress(&id,2,true).unwrap();
        let path = temp.path().join("backup.json"); library.export_reading_backup(&path).unwrap();
        library.remove(&id).unwrap();
        let absent = library.preview_reading_restore(&path).unwrap(); assert_eq!(absent.skipped,1);
        assert!(library.apply_reading_restore(&absent.token,false).is_err());
        let new_id = library.import(Path::new(&source),"folder").unwrap().id;
        let preview = library.preview_reading_restore(&path).unwrap(); assert_eq!(preview.matched,1);
        library.apply_reading_restore(&preview.token,false).unwrap();
        assert_eq!(library.open(&new_id).unwrap().book.page,2);
    }

    #[test]
    fn cancel_keeps_data_and_settings_can_be_excluded() {
        let (temp,library,id) = fixture();
        library.save_settings(serde_json::json!({"theme":"sepia"})).unwrap();
        let path = temp.path().join("backup.json"); library.export_reading_backup(&path).unwrap();
        library.save_settings(serde_json::json!({"theme":"light"})).unwrap();
        let preview = library.preview_reading_restore(&path).unwrap();
        library.cancel_reading_restore(&preview.token).unwrap();
        assert!(library.apply_reading_restore(&preview.token,true).is_err());
        let preview = library.preview_reading_restore(&path).unwrap(); library.apply_reading_restore(&preview.token,false).unwrap();
        assert_eq!(library.settings().unwrap()["theme"],"light");
        assert_eq!(library.open(&id).unwrap().book.page,0);
    }

    #[test]
    fn rejects_future_versions_duplicates_and_internal_export_destination() {
        let (temp,library,_) = fixture();
        assert!(library.export_reading_backup(&library.root.join("backup.json")).is_err());
        let path = temp.path().join("backup.json"); library.export_reading_backup(&path).unwrap();
        let original = fs::read(&path).unwrap();
        let mut backup: ReadingBackup = serde_json::from_slice(&original).unwrap();
        backup.version = 99; assert!(backup.validate().is_err());
        backup.version = 2; backup.books.push(backup.books[0].clone()); assert!(backup.validate().is_err());
        fs::write(&path,b"invalid json").unwrap(); assert!(library.preview_reading_restore(&path).is_err());
    }

    #[test]
    fn rejects_two_entries_that_would_overwrite_the_same_volume() {
        let (temp,library,_) = fixture();
        let path = temp.path().join("backup.json"); library.export_reading_backup(&path).unwrap();
        let mut backup: ReadingBackup = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        let mut duplicate = backup.books[0].clone();
        duplicate.id = Uuid::new_v4().to_string();
        backup.books[0].source = "different-source-for-id-match".into();
        backup.books.push(duplicate);
        backup.validate().unwrap();
        fs::write(&path,serde_json::to_vec(&backup).unwrap()).unwrap();
        assert!(library.preview_reading_restore(&path).is_err());
    }

    #[test]
    fn database_failure_rolls_back_progress_favorites_and_markers_together() {
        let (temp,library,id) = fixture();
        library.progress(&id,2,true).unwrap(); library.favorite(&id,true).unwrap(); library.bookmark(&id,1,true).unwrap();
        let path = temp.path().join("backup.json"); library.export_reading_backup(&path).unwrap();
        library.progress(&id,0,false).unwrap(); library.favorite(&id,false).unwrap();
        library.bookmark(&id,1,false).unwrap(); library.bookmark(&id,0,true).unwrap();
        let preview = library.preview_reading_restore(&path).unwrap();
        library.db().unwrap().execute_batch("CREATE TRIGGER fail_restore BEFORE INSERT ON bookmarks BEGIN SELECT RAISE(ABORT, 'forced rollback'); END;").unwrap();
        assert!(library.apply_reading_restore(&preview.token,false).is_err());
        let untouched = library.open(&id).unwrap();
        assert_eq!(untouched.book.page,0); assert!(!untouched.book.favorite); assert_eq!(untouched.bookmarks,vec![0]);
        library.db().unwrap().execute_batch("DROP TRIGGER fail_restore;").unwrap();
        library.apply_reading_restore(&preview.token,false).unwrap();
        let restored = library.open(&id).unwrap();
        assert_eq!(restored.book.page,2); assert!(restored.book.favorite); assert_eq!(restored.bookmarks,vec![1]);
    }

    #[test]
    fn recovery_file_failure_prevents_database_changes() {
        let (temp,library,id) = fixture();
        library.progress(&id,2,true).unwrap();
        let path = temp.path().join("backup.json"); library.export_reading_backup(&path).unwrap();
        library.progress(&id,0,false).unwrap();
        let preview = library.preview_reading_restore(&path).unwrap();
        // A regular file occupying the recovery folder prevents creation.
        fs::write(library.root.join("backups"),b"occupied").unwrap();
        assert!(library.apply_reading_restore(&preview.token,false).is_err());
        assert_eq!(library.open(&id).unwrap().book.page,0);
    }

    #[test]
    fn restores_organization_from_v2_but_preserves_it_with_v1_backups() {
        let (temp,library,id) = fixture();
        let path = temp.path().join("backup.json");
        library.update_metadata(&id,BookMetadata { title:"Capítulo 2".into(),series:"Aurora".into(),chapter:"2".into() }).unwrap();
        library.export_reading_backup(&path).unwrap();
        library.update_metadata(&id,BookMetadata { title:"Outro título".into(),series:"Outra série".into(),chapter:"10".into() }).unwrap();
        let preview = library.preview_reading_restore(&path).unwrap(); assert!(preview.organization_included);
        library.apply_reading_restore(&preview.token,false).unwrap();
        let restored = library.open(&id).unwrap().book;
        assert_eq!(restored.title,"Capítulo 2"); assert_eq!(restored.series,"Aurora"); assert_eq!(restored.chapter,"2");
        let mut old: ReadingBackup = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        old.version = 1; for entry in &mut old.books { entry.organization = None; }
        fs::write(&path,serde_json::to_vec(&old).unwrap()).unwrap();
        library.update_metadata(&id,BookMetadata { title:"Título atual".into(),series:"Série atual".into(),chapter:"3".into() }).unwrap();
        let preview = library.preview_reading_restore(&path).unwrap(); assert!(!preview.organization_included);
        library.apply_reading_restore(&preview.token,false).unwrap();
        let preserved = library.open(&id).unwrap().book;
        assert_eq!(preserved.title,"Título atual"); assert_eq!(preserved.series,"Série atual"); assert_eq!(preserved.chapter,"3");
    }

    #[test]
    fn metadata_edits_invalidate_an_existing_restore_preview() {
        let (temp,library,id) = fixture();
        let path = temp.path().join("backup.json"); library.export_reading_backup(&path).unwrap();
        let preview = library.preview_reading_restore(&path).unwrap();
        library.update_metadata(&id,BookMetadata { title:"Atualizado".into(),series:"Aurora".into(),chapter:"1".into() }).unwrap();
        assert!(library.apply_reading_restore(&preview.token,false).is_err());
        assert_eq!(library.open(&id).unwrap().book.title,"Atualizado");
    }
}
