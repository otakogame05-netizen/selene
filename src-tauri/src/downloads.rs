use crate::storage::Result;
use serde::Serialize;
use std::{collections::HashMap, sync::{Arc, Mutex}, time::{Duration, Instant}};
use uuid::Uuid;

pub const CANCELLED: &str = "Download cancelado";
#[derive(Clone, Default, Serialize)]
#[serde(rename_all="camelCase")]
pub struct Progress { pub completed:usize, pub total:usize, pub bytes:u64, pub cancelled:bool, pub finished:bool }
#[derive(Default)]
pub struct Download { progress:Mutex<Progress> }
impl Download {
    pub fn check(&self)->Result<()> { if self.snapshot()?.cancelled {Err(CANCELLED.into())} else {Ok(())} }
    pub fn snapshot(&self)->Result<Progress> {Ok(self.progress.lock().map_err(|e|e.to_string())?.clone())}
    pub fn cancel(&self)->Result<bool> {let mut value=self.progress.lock().map_err(|e|e.to_string())?;if value.finished{return Ok(false)} value.cancelled=true;Ok(true)}
    pub fn update(&self,completed:usize,total:usize,bytes:u64)->Result<()> {let mut value=self.progress.lock().map_err(|e|e.to_string())?;if value.cancelled{return Err(CANCELLED.into())}value.completed=completed;value.total=total;value.bytes=bytes;Ok(())}
    // Cancellation and commit use the same lock: cancellation cannot succeed after commit.
    pub fn commit<T>(&self,operation:impl FnOnce()->Result<T>)->Result<T> {let mut value=self.progress.lock().map_err(|e|e.to_string())?;if value.cancelled{return Err(CANCELLED.into())}let result=operation();value.finished=true;result}
}
struct Entry { download:Arc<Download>,created:Instant,started:bool }
#[derive(Default)]
pub struct Downloads(Mutex<HashMap<String,Entry>>);
impl Downloads {
    pub fn prepare(&self)->Result<String> {let mut entries=self.0.lock().map_err(|e|e.to_string())?;entries.retain(|_,entry|entry.started||entry.created.elapsed()<Duration::from_secs(600));if entries.len()>=32{return Err("Há muitos downloads pendentes".into())}let id=Uuid::new_v4().to_string();entries.insert(id.clone(),Entry{download:Arc::new(Download::default()),created:Instant::now(),started:false});Ok(id)}
    pub fn get(&self,id:&str)->Result<Arc<Download>> {self.0.lock().map_err(|e|e.to_string())?.get(id).map(|entry|entry.download.clone()).ok_or_else(||"Download encerrado ou não encontrado".into())}
    pub fn start(&self,id:&str)->Result<Arc<Download>> {let mut entries=self.0.lock().map_err(|e|e.to_string())?;let entry=entries.get_mut(id).ok_or("Download não encontrado")?;if entry.started{return Err("Download já iniciado".into())}entry.started=true;Ok(entry.download.clone())}
    pub fn remove(&self,id:&str) {if let Ok(mut entries)=self.0.lock(){entries.remove(id);}}
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn cancellation_prevents_commit_and_progress(){let download=Download::default();download.update(1,3,55).unwrap();assert!(download.cancel().unwrap());assert!(download.update(2,3,99).is_err());let mut committed=false;assert!(download.commit(||{committed=true;Ok(())}).is_err());assert!(!committed);assert_eq!(download.snapshot().unwrap().completed,1);}
    #[test] fn finished_download_cannot_be_cancelled(){let download=Download::default();download.commit(||Ok(())).unwrap();assert!(!download.cancel().unwrap());}
    #[test] fn jobs_cannot_be_started_twice_and_are_removed(){let jobs=Downloads::default();let id=jobs.prepare().unwrap();jobs.get(&id).unwrap().cancel().unwrap();assert!(jobs.start(&id).unwrap().check().is_err());assert!(jobs.start(&id).is_err());jobs.remove(&id);assert!(jobs.get(&id).is_err());}
}
