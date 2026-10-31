use crate::storage::{Library, Result};
use serde::Serialize;
use std::path::PathBuf;

pub const MAX_BATCH_FILES: usize = 50;

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum BatchStatus { Added, Existing, Failed }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchItem {
    pub name: String,
    pub status: BatchStatus,
    pub book_id: Option<String>,
    pub title: Option<String>,
    pub message: String,
}

#[derive(Serialize)]
pub struct BatchReport { pub items: Vec<BatchItem> }

impl Library {
    pub fn import_cbz_batch(&self, mut paths: Vec<PathBuf>) -> Result<BatchReport> {
        // Reject the entire selection before importing anything when above the limit.
        if paths.len() > MAX_BATCH_FILES { return Err(format!("Selecione no máximo {MAX_BATCH_FILES} arquivos CBZ por lote")); }
        paths.sort_by(|a,b| {
            let name_a = a.file_name().unwrap_or_default().to_string_lossy();
            let name_b = b.file_name().unwrap_or_default().to_string_lossy();
            natord::compare(&name_a,&name_b).then_with(|| a.cmp(b))
        });
        let items = paths.into_iter().map(|path| {
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            let is_cbz = path.extension().and_then(|value| value.to_str()).is_some_and(|value| value.eq_ignore_ascii_case("cbz"));
            let result = if is_cbz { self.import_with_outcome(&path,"cbz") } else { Err("Formato não suportado neste lote; selecione arquivos .cbz".into()) };
            match result {
                Ok(outcome) => BatchItem {
                    name, status: if outcome.added { BatchStatus::Added } else { BatchStatus::Existing },
                    book_id: Some(outcome.book.id), title: Some(outcome.book.title),
                    message: if outcome.added { "Adicionado à biblioteca" } else { "Já estava na biblioteca; dados de leitura preservados" }.into(),
                },
                Err(message) => BatchItem { name,status:BatchStatus::Failed,book_id:None,title:None,message },
            }
        }).collect();
        Ok(BatchReport { items })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, io::Write, path::Path};
    use tempfile::TempDir;

    fn cbz(path: &Path) {
        let mut writer = zip::ZipWriter::new(fs::File::create(path).unwrap());
        for page in 1..=3 {
            writer.start_file(format!("{page}.png"),zip::write::SimpleFileOptions::default()).unwrap();
            writer.write_all(b"image-storage-fixture").unwrap();
        }
        writer.finish().unwrap();
    }

    #[test]
    fn mixed_batch_continues_after_invalid_file_and_reports_duplicates() {
        let temp = TempDir::new().unwrap();
        let library = Library::new(temp.path().join("data")).unwrap();
        let first = temp.path().join("2.cbz"); let last = temp.path().join("10.CBZ");
        let bad = temp.path().join("3.cbz"); cbz(&first); cbz(&last); fs::write(&bad,b"invalid zip").unwrap();
        let existing = library.import(&first,"cbz").unwrap();
        library.progress(&existing.id,1,false).unwrap(); library.favorite(&existing.id,true).unwrap(); library.bookmark(&existing.id,1,true).unwrap();
        let report = library.import_cbz_batch(vec![last,bad,first]).unwrap();
        assert_eq!(report.items[0].status,BatchStatus::Existing);
        assert_eq!(report.items[1].status,BatchStatus::Failed);
        assert_eq!(report.items[2].status,BatchStatus::Added);
        assert_eq!(report.items[0].name,"2.cbz"); assert_eq!(report.items[2].name,"10.CBZ");
        let preserved = library.open(&existing.id).unwrap();
        assert_eq!(preserved.book.page,1); assert!(preserved.book.favorite); assert_eq!(preserved.bookmarks,vec![1]);
        assert_eq!(library.list().unwrap().len(),2);
        assert_eq!(fs::read_dir(library.root.join("library")).unwrap().count(),2);
    }

    #[test]
    fn rejects_oversized_selection_before_importing_anything() {
        let temp = TempDir::new().unwrap(); let library = Library::new(temp.path().join("data")).unwrap();
        let path = temp.path().join("volume.cbz"); cbz(&path);
        assert!(library.import_cbz_batch(vec![path;MAX_BATCH_FILES + 1]).is_err());
        assert!(library.list().unwrap().is_empty());
        assert_eq!(fs::read_dir(library.root.join("library")).unwrap().count(),0);
    }

    #[test]
    fn repeated_paths_are_only_copied_once_and_missing_files_are_reported() {
        let temp = TempDir::new().unwrap(); let library = Library::new(temp.path().join("data")).unwrap();
        let path = temp.path().join("1.cbz"); cbz(&path);
        let report = library.import_cbz_batch(vec![path.clone(),path,temp.path().join("missing.cbz"),temp.path().join("wrong.pdf")]).unwrap();
        assert_eq!(report.items[0].status,BatchStatus::Added);
        assert_eq!(report.items[1].status,BatchStatus::Existing);
        assert_eq!(report.items.iter().filter(|item| item.status == BatchStatus::Failed).count(),2);
        assert_eq!(library.list().unwrap().len(),1);
        assert!(library.import_cbz_batch(vec![]).unwrap().items.is_empty());
    }
}
