use crate::storage::{Library, Result};
use rusqlite::{params, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub enum Status { Queued, Downloading, Saved, Failed, Cancelled, NotStarted }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct Item { pub id:i32,pub name:String,pub status:Status,pub error:Option<String> }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct Snapshot { pub server:String,pub manga_id:i32,pub title:String,pub items:Vec<Item> }
#[derive(Debug, Serialize)]
#[serde(rename_all="camelCase")]
pub struct Record { pub revision:i64,pub queue:Option<Snapshot> }
fn error(value:impl std::fmt::Display)->String {value.to_string()}
fn validate(mut queue:Snapshot)->Result<Snapshot> {
    let mut url=reqwest::Url::parse(&queue.server).map_err(|_|"Endereço inválido na fila")?;
    if !matches!(url.scheme(),"http"|"https")||url.host_str().is_none()||!url.username().is_empty()||url.password().is_some()||url.query().is_some()||url.fragment().is_some()||queue.server.len()>2048{return Err("Endereço inválido na fila".into())}
    url.set_path(&format!("{}/",url.path().trim_end_matches('/')));queue.server=url.to_string();
    if queue.manga_id<0||queue.title.trim().is_empty()||queue.title.chars().count()>512||queue.items.is_empty()||queue.items.len()>50{return Err("Fila inválida: selecione entre 1 e 50 capítulos".into())}
    let mut ids=HashSet::new();
    for item in &queue.items {if item.id<0||!ids.insert(item.id)||item.name.trim().is_empty()||item.name.chars().count()>512||item.error.as_ref().is_some_and(|value|value.chars().count()>1000){return Err("Capítulos inválidos ou repetidos na fila".into())}}
    Ok(queue)
}
fn database(library:&Library)->Result<rusqlite::Connection> {
    let conn=rusqlite::Connection::open(library.root.join("downloads.sqlite3")).map_err(error)?;
    conn.busy_timeout(std::time::Duration::from_secs(5)).map_err(error)?;
    let version:i64=conn.query_row("PRAGMA user_version",[],|row|row.get(0)).map_err(error)?;
    if version>1{return Err("A fila foi criada por uma versão mais recente do Selene".into())}
    conn.execute_batch("CREATE TABLE IF NOT EXISTS queue_state(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL CHECK(revision>=0),payload TEXT); INSERT OR IGNORE INTO queue_state VALUES(1,0,NULL); PRAGMA user_version=1;").map_err(error)?;
    Ok(conn)
}
pub fn load(library:&Library)->Result<Record> {
    let conn=database(library)?;
    let (revision,payload):(i64,Option<String>)=conn.query_row("SELECT revision,payload FROM queue_state WHERE id=1",[],|row|Ok((row.get(0)?,row.get(1)?))).map_err(error)?;
    let queue=payload.map(|value|serde_json::from_str::<Snapshot>(&value).map_err(|_|"Não foi possível ler a fila salva".to_string()).and_then(validate)).transpose()?;
    Ok(Record{revision,queue})
}
pub fn store(library:&Library,expected:i64,queue:Option<Snapshot>)->Result<Record> {
    let queue=queue.map(validate).transpose()?;
    let payload=queue.as_ref().map(serde_json::to_string).transpose().map_err(error)?;
    let mut conn=database(library)?;let transaction=conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(error)?;
    let revision:i64=transaction.query_row("SELECT revision FROM queue_state WHERE id=1",[],|row|row.get(0)).map_err(error)?;
    if expected!=revision{return Err("A fila foi alterada por outra janela. Recarregue a fila antes de continuar.".into())}
    let revision=revision.checked_add(1).ok_or("Revisão da fila fora dos limites")?;
    transaction.execute("UPDATE queue_state SET revision=?1,payload=?2 WHERE id=1",params![revision,payload]).map_err(error)?;
    transaction.commit().map_err(error)?;Ok(Record{revision,queue})
}
#[cfg(test)]
mod tests {
    use super::*;
    fn snapshot()->Snapshot {Snapshot{server:"http://127.0.0.1:4567".into(),manga_id:42,title:"Teste".into(),items:vec![Item{id:8,name:"Capítulo 1".into(),status:Status::Downloading,error:None}]}}
    #[test] fn queue_survives_reopen_and_clear_keeps_revision() {
        let dir=tempfile::tempdir().unwrap();let library=Library::new(dir.path().to_path_buf()).unwrap();assert!(load(&library).unwrap().queue.is_none());
        let saved=store(&library,0,Some(snapshot())).unwrap();assert_eq!(saved.revision,1);
        let reopened=Library::new(dir.path().to_path_buf()).unwrap();let loaded=load(&reopened).unwrap();assert!(matches!(loaded.queue.unwrap().items[0].status,Status::Downloading));
        assert_eq!(store(&reopened,1,None).unwrap().revision,2);assert!(load(&reopened).unwrap().queue.is_none());assert!(library.list().unwrap().is_empty());
    }
    #[test] fn stale_writer_cannot_overwrite_or_discard_newer_queue() {
        let dir=tempfile::tempdir().unwrap();let library=Library::new(dir.path().to_path_buf()).unwrap();store(&library,0,Some(snapshot())).unwrap();
        assert!(store(&library,0,None).is_err());assert!(store(&library,0,Some(snapshot())).is_err());assert_eq!(load(&library).unwrap().revision,1);
    }
    #[test] fn invalid_queue_does_not_change_saved_data() {
        let dir=tempfile::tempdir().unwrap();let library=Library::new(dir.path().to_path_buf()).unwrap();
        let mut invalid=snapshot();invalid.items.push(invalid.items[0].clone());assert!(store(&library,0,Some(invalid)).is_err());
        let mut invalid=snapshot();invalid.server="http://user:password@localhost".into();assert!(store(&library,0,Some(invalid)).is_err());
        let mut invalid=snapshot();invalid.items=vec![];assert!(store(&library,0,Some(invalid)).is_err());assert_eq!(load(&library).unwrap().revision,0);
    }
}
