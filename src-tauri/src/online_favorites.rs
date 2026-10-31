use crate::storage::{Library,Result};
use rusqlite::params;
use serde::{Deserialize,Serialize};
use std::time::{SystemTime,UNIX_EPOCH};

#[derive(Clone,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Input{pub server:String,pub source_id:String,pub source_name:String,pub lang:String,pub manga_id:i32,pub title:String}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct Favorite{pub id:String,pub server:String,pub source_id:String,pub source_name:String,pub lang:String,pub manga_id:i32,pub title:String,pub cover:String,pub integrated:bool}
fn db(library:&Library)->Result<rusqlite::Connection>{
    let db=library.db()?;
    db.execute_batch("CREATE TABLE IF NOT EXISTS online_favorites(id TEXT PRIMARY KEY,server TEXT NOT NULL,source_id TEXT NOT NULL,source_name TEXT NOT NULL,lang TEXT NOT NULL,manga_id INTEGER NOT NULL,title TEXT NOT NULL,cover TEXT NOT NULL,integrated INTEGER NOT NULL,added_at INTEGER NOT NULL,UNIQUE(server,source_id,manga_id));").map_err(|e|e.to_string())?;Ok(db)
}
pub fn set(library:&Library,input:Input,enabled:bool,integrated:bool)->Result<()>{
    let server=crate::suwayomi::normalized_server(&input.server)?.to_string();
    input.source_id.parse::<i64>().map_err(|_|"Fonte inválida")?;
    if input.manga_id<0||input.title.trim().is_empty()||input.title.chars().count()>512||input.source_name.chars().count()>256||input.lang.len()>40||input.title.chars().chain(input.source_name.chars()).any(char::is_control){return Err("Identificação do mangá inválida".into());}
    let db=db(library)?;
    if !enabled{db.execute("DELETE FROM online_favorites WHERE server=?1 AND source_id=?2 AND manga_id=?3",params![server,input.source_id,input.manga_id]).map_err(|e|e.to_string())?;return Ok(());}
    let cover=crate::site_history::cached_cover(library,&server,input.manga_id);
    let stamp=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as i64;
    db.execute("INSERT INTO online_favorites(id,server,source_id,source_name,lang,manga_id,title,cover,integrated,added_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10) ON CONFLICT(server,source_id,manga_id) DO UPDATE SET title=excluded.title,source_name=excluded.source_name,lang=excluded.lang,integrated=excluded.integrated,cover=CASE WHEN excluded.cover<>'' THEN excluded.cover ELSE online_favorites.cover END",params![uuid::Uuid::new_v4().to_string(),server,input.source_id,input.source_name,input.lang,input.manga_id,input.title.trim(),cover,integrated,stamp]).map_err(|e|e.to_string())?;Ok(())
}
pub fn list(library:&Library)->Result<Vec<Favorite>>{
    let db=db(library)?;let mut query=db.prepare("SELECT id,server,source_id,source_name,lang,manga_id,title,cover,integrated FROM online_favorites ORDER BY added_at DESC,rowid DESC").map_err(|e|e.to_string())?;
    let rows=query.query_map([],|row|Ok(Favorite{id:row.get(0)?,server:row.get(1)?,source_id:row.get(2)?,source_name:row.get(3)?,lang:row.get(4)?,manga_id:row.get(5)?,title:row.get(6)?,cover:row.get(7)?,integrated:row.get(8)?})).map_err(|e|e.to_string())?;
    let mut values=rows.collect::<std::result::Result<Vec<_>,_>>().map_err(|e|e.to_string())?;
    for value in &mut values{if value.cover.is_empty(){value.cover=crate::site_history::cached_cover(library,&value.server,value.manga_id);}}
    Ok(values)
}
#[cfg(test)]mod tests{
    use super::*;
    fn item()->Input{Input{server:"http://127.0.0.1:4567/".into(),source_id:"9223372036854775807".into(),source_name:"ToonLivre".into(),lang:"pt-BR".into(),manga_id:42,title:"Obra".into()}}
    #[test]fn favorites_persist_without_duplicating_and_keep_sources_separate(){
        let root=tempfile::tempdir().unwrap();let library=Library::new(root.path().into()).unwrap();
        set(&library,item(),true,true).unwrap();let first=list(&library).unwrap()[0].id.clone();set(&library,item(),true,true).unwrap();
        let mut other=item();other.source_id="100".into();set(&library,other,true,false).unwrap();
        let library=Library::new(root.path().into()).unwrap();let rows=list(&library).unwrap();assert_eq!(rows.len(),2);assert!(rows.iter().any(|v|v.id==first&&v.integrated));
        set(&library,item(),false,true).unwrap();assert_eq!(list(&library).unwrap().len(),1);assert!(library.list().unwrap().is_empty());
        let mut invalid=item();invalid.server="file:///private".into();assert!(set(&library,invalid,true,false).is_err());
    }
}
