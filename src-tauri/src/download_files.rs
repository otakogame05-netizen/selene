use crate::storage::{Library,Result};
use serde::{Deserialize,Serialize};
use std::{fs::{self,File,OpenOptions},io::{Read,Write},path::Path};
pub const MARKER:&str=".yomi-download.json";
#[derive(Serialize,Deserialize)]struct Marker{version:u8,source:String}
fn error(value:impl std::fmt::Display)->String{value.to_string()}
fn options()->OpenOptions{
    let mut options=OpenOptions::new();options.read(true).write(true);
    #[cfg(windows)] {use std::os::windows::fs::OpenOptionsExt;options.share_mode(0);}
    options
}
// The Windows exclusive sharing mode is released automatically on process exit.
pub fn lease(target:&Path,source:&str)->Result<File>{
    let mut file=options().create_new(true).open(target.join(MARKER)).map_err(error)?;
    let bytes=serde_json::to_vec(&Marker{version:1,source:source.into()}).map_err(error)?;
    file.write_all(&bytes).map_err(error)?;file.sync_all().map_err(error)?;Ok(file)
}
#[cfg(not(windows))]
pub fn cleanup(_library:&Library,_source:&str)->Result<usize>{Ok(0)}
#[cfg(windows)]
pub fn cleanup(library:&Library,source:&str)->Result<usize>{
    let base=library.root.join("library");let mut removed=0;
    for entry in fs::read_dir(&base).map_err(error)?{
        let entry=entry.map_err(error)?;let kind=entry.file_type().map_err(error)?;
        if !kind.is_dir()||kind.is_symlink(){continue;}
        let Some(name)=entry.file_name().to_str().map(str::to_string)else{continue;};
        let Ok(id)=uuid::Uuid::parse_str(&name)else{continue;};
        let target=entry.path();
        // Only a generated UUID immediately under this library is eligible.
        if target.parent()!=Some(base.as_path()){continue;}
        let marker_path=target.join(MARKER);
        let mut file=match options().open(&marker_path){Ok(file)=>file,Err(error)if error.kind()==std::io::ErrorKind::NotFound||matches!(error.raw_os_error(),Some(32|33))=>continue,Err(error)=>return Err(error.to_string())};
        let mut bytes=Vec::new();(&mut file).take(8193).read_to_end(&mut bytes).map_err(error)?;
        if bytes.len()>8192{continue;}
        let Ok(marker)=serde_json::from_slice::<Marker>(&bytes)else{continue;};
        if marker.version!=1||marker.source!=source{continue;}
        // A worker commits before releasing its lease. Check AFTER acquiring it.
        let count:i64=library.db()?.query_row("SELECT COUNT(*) FROM books WHERE id=?1",[id.to_string()],|row|row.get(0)).map_err(error)?;
        drop(file);
        if count>0{let _=fs::remove_file(marker_path);continue;}
        match fs::remove_dir_all(&target){Ok(())=>removed+=1,Err(error)if error.kind()==std::io::ErrorKind::NotFound=>{},Err(error)=>return Err(error.to_string())}
    }
    Ok(removed)
}
#[cfg(all(test,windows))]mod tests{
    use super::*;
    fn directory(library:&Library)->std::path::PathBuf{let path=library.root.join("library").join(uuid::Uuid::new_v4().to_string());fs::create_dir(&path).unwrap();path}
    #[test]fn incomplete_closed_download_is_removed(){let temp=tempfile::tempdir().unwrap();let library=Library::new(temp.path().to_path_buf()).unwrap();let path=directory(&library);drop(lease(&path,"source-a").unwrap());fs::write(path.join("page.png"),b"partial").unwrap();assert_eq!(cleanup(&library,"source-a").unwrap(),1);assert!(!path.exists());}
    #[test]fn active_download_is_never_removed(){let temp=tempfile::tempdir().unwrap();let library=Library::new(temp.path().to_path_buf()).unwrap();let path=directory(&library);let guard=lease(&path,"source-a").unwrap();assert_eq!(cleanup(&library,"source-a").unwrap(),0);assert!(path.exists());drop(guard);assert_eq!(cleanup(&library,"source-a").unwrap(),1);}
    #[test]fn unmarked_and_unrelated_folders_are_preserved(){let temp=tempfile::tempdir().unwrap();let library=Library::new(temp.path().to_path_buf()).unwrap();let unmarked=directory(&library);let other=directory(&library);drop(lease(&other,"source-b").unwrap());assert_eq!(cleanup(&library,"source-a").unwrap(),0);assert!(unmarked.exists()&&other.exists());}
    #[test]fn committed_book_is_preserved_even_if_marker_remains(){let temp=tempfile::tempdir().unwrap();let library=Library::new(temp.path().to_path_buf()).unwrap();let path=directory(&library);drop(lease(&path,"source-a").unwrap());fs::write(path.join("page.png"),b"complete").unwrap();let id=path.file_name().unwrap().to_str().unwrap();library.db().unwrap().execute("INSERT INTO books(id,title,source,format,page_count,added_at) VALUES(?1,'Book','source-a','online',1,0)",[id]).unwrap();assert_eq!(cleanup(&library,"source-a").unwrap(),0);assert!(path.join("page.png").exists());assert!(!path.join(MARKER).exists());}
}
