use crate::storage::{Library,Result};
use rusqlite::params;
use serde::{Deserialize,Serialize};
use std::time::{SystemTime,UNIX_EPOCH};

#[derive(Clone,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Metadata {pub title:String,pub chapter:String,pub manga_id:i32}
#[derive(Clone,Serialize)]
#[serde(rename_all="camelCase")]
pub struct Reading {pub id:String,pub title:String,pub chapter:String,pub url:String,pub cover:String,pub last_read:i64}
fn db(library:&Library)->Result<rusqlite::Connection>{
    let db=library.db()?;
    db.execute_batch("CREATE TABLE IF NOT EXISTS site_readings(id TEXT PRIMARY KEY,url TEXT NOT NULL UNIQUE,title TEXT NOT NULL,chapter TEXT NOT NULL,cover TEXT NOT NULL,last_read INTEGER NOT NULL);").map_err(|e|e.to_string())?;
    Ok(db)
}
pub fn record(library:&Library,url:&str,metadata:&Metadata,cover:&str)->Result<()>{
    let url=crate::source_browser::site_url(url)?.to_string();
    let title=metadata.title.trim();let chapter=metadata.chapter.trim();
    if title.is_empty()||title.chars().count()>512||chapter.chars().count()>128||title.chars().chain(chapter.chars()).any(char::is_control){return Err("Identificação do capítulo inválida".into());}
    let stamp=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as i64;
    db(library)?.execute("INSERT INTO site_readings(id,url,title,chapter,cover,last_read) VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(url) DO UPDATE SET title=excluded.title,chapter=excluded.chapter,last_read=excluded.last_read,cover=CASE WHEN excluded.cover<>'' THEN excluded.cover ELSE site_readings.cover END",params![uuid::Uuid::new_v4().to_string(),url,title,chapter,cover,stamp]).map_err(|e|e.to_string())?;
    Ok(())
}
pub fn list(library:&Library)->Result<Vec<Reading>>{
    let db=db(library)?;let mut query=db.prepare("SELECT id,title,chapter,url,cover,last_read FROM site_readings ORDER BY last_read DESC,rowid DESC LIMIT 200").map_err(|e|e.to_string())?;
    let rows=query.query_map([],|row|Ok(Reading{id:row.get(0)?,title:row.get(1)?,chapter:row.get(2)?,url:row.get(3)?,cover:row.get(4)?,last_read:row.get(5)?})).map_err(|e|e.to_string())?;
    rows.collect::<std::result::Result<Vec<_>,_>>().map_err(|e|e.to_string())
}
pub fn resume(library:&Library,id:&str)->Result<String>{
    let db=db(library)?;
    let url:String=db.query_row("SELECT url FROM site_readings WHERE id=?1",[id],|row|row.get(0)).map_err(|_|"Capítulo não encontrado no histórico")?;
    crate::source_browser::site_url(&url)?;
    let stamp=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as i64;
    db.execute("UPDATE site_readings SET last_read=?1 WHERE id=?2",params![stamp,id]).map_err(|e|e.to_string())?;
    Ok(url)
}
pub fn remove(library:&Library,id:&str)->Result<()>{
    if id.is_empty()||id.len()>128{return Err("Registro de histórico inválido".into());}
    db(library)?.execute("DELETE FROM site_readings WHERE id=?1",[id]).map_err(|e|e.to_string())?;Ok(())
}
pub fn cached_cover(library:&Library,server:&str,manga_id:i32)->String{
    use sha2::{Digest,Sha256};
    let key=format!("{:x}",Sha256::digest(server.as_bytes()));
    for extension in ["png","jpg","webp","gif","bmp","avif"]{
        let path=library.root.join("library/online-covers").join(format!("{}-{manga_id}.{extension}",&key[..24]));
        if path.is_file(){return path.to_string_lossy().to_string();}
    }String::new()
}
pub fn visited(library:&Library,value:&str)->Result<()>{
    let url=crate::source_browser::site_url(value)?;
    let Some((parent,number))=url.path().rsplit_once('/')else{return Ok(());};
    if number.is_empty()||!number.chars().all(|c|c.is_ascii_digit()||c=='.'){return Ok(());}
    for row in list(library)?{
        let previous=crate::source_browser::site_url(&row.url)?;
        if previous.origin()==url.origin()&&previous.path().rsplit_once('/').map(|v|v.0)==Some(parent){
            let chapter=if previous.path()==url.path(){row.chapter}else{format!("Capítulo {number}")};
            return record(library,url.as_str(),&Metadata{title:row.title,chapter,manga_id:0},&row.cover);
        }
    }Ok(())
}
#[cfg(test)]mod tests{
    use super::*;
    #[test]fn chapter_history_survives_restart_deduplicates_and_reopens_without_engine(){
        let root=tempfile::tempdir().unwrap();let library=Library::new(root.path().into()).unwrap();
        let meta=Metadata{title:"Obra".into(),chapter:"Capítulo 65".into(),manga_id:42};
        let cover=root.path().join("shared-cover.cache");std::fs::write(&cover,b"cached-cover-fixture").unwrap();
        record(&library,"https://source.test/obra/65",&meta,cover.to_str().unwrap()).unwrap();
        let first=list(&library).unwrap();assert_eq!(first.len(),1);
        record(&library,"https://source.test/obra/65",&meta,"").unwrap();
        record(&library,"https://source.test/obra/66",&Metadata{chapter:"Capítulo 66".into(),..meta.clone()},"").unwrap();
        let library=Library::new(root.path().into()).unwrap();let rows=list(&library).unwrap();assert_eq!(rows.len(),2);assert_eq!(rows[0].chapter,"Capítulo 66");
        assert_eq!(resume(&library,&first[0].id).unwrap(),"https://source.test/obra/65");
        assert!(record(&library,"file:///private",&meta,"").is_err());
        visited(&library,"https://other.test/obra/67").unwrap();assert_eq!(list(&library).unwrap().len(),2);
        visited(&library,"https://source.test/obra/67").unwrap();assert_eq!(list(&library).unwrap()[0].chapter,"Capítulo 67");
        remove(&library,&first[0].id).unwrap();let library=Library::new(root.path().into()).unwrap();let rows=list(&library).unwrap();assert_eq!(rows.len(),2);assert!(!rows.iter().any(|row|row.id==first[0].id));assert!(library.list().unwrap().is_empty());assert!(cover.is_file());
    }
}
