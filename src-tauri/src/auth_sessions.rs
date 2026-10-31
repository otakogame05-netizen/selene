use crate::storage::Result;
use reqwest::header::HeaderValue;
use std::{collections::HashMap,sync::Mutex};
use uuid::Uuid;
pub const AUTH_REQUIRED:&str="Autenticação necessária no Suwayomi. Entre novamente em Fontes online.";
struct Entry{ticket:Uuid,header:Option<HeaderValue>}
pub struct Snapshot{pub server:String,pub ticket:Option<Uuid>,pub header:Option<HeaderValue>}
#[derive(Default)]pub struct Sessions(Mutex<HashMap<String,Entry>>);
impl Sessions{
    pub fn snapshot(&self,server:&str)->Result<Snapshot>{let server=crate::suwayomi::normalized_server(server)?.to_string();let entries=self.0.lock().map_err(|e|e.to_string())?;let entry=entries.get(&server).filter(|entry|entry.header.is_some());Ok(Snapshot{server,ticket:entry.map(|entry|entry.ticket),header:entry.and_then(|entry|entry.header.clone())})}
    pub fn begin(&self,server:&str)->Result<Uuid>{let mut entries=self.0.lock().map_err(|e|e.to_string())?;if entries.len()>=16&&!entries.contains_key(server){return Err("Encerre outras sessões antes de conectar a mais servidores".into())}let ticket=Uuid::new_v4();entries.insert(server.into(),Entry{ticket,header:None});Ok(ticket)}
    pub fn finish(&self,server:&str,ticket:Uuid,header:HeaderValue)->Result<()>{let mut entries=self.0.lock().map_err(|e|e.to_string())?;let entry=entries.get_mut(server).filter(|entry|entry.ticket==ticket).ok_or("A solicitação de login foi substituída. Conecte novamente.")?;entry.header=Some(header);Ok(())}
    pub fn invalidate(&self,server:&str,ticket:Option<Uuid>){if let Ok(mut entries)=self.0.lock(){if entries.get(server).is_some_and(|entry|Some(entry.ticket)==ticket){entries.remove(server);}}}
    pub fn logout(&self,server:Option<&str>)->Result<()>{let mut entries=self.0.lock().map_err(|e|e.to_string())?;if let Some(server)=server{let key=crate::suwayomi::normalized_server(server)?.to_string();entries.remove(&key);}else{entries.clear();}Ok(())}
}
#[cfg(test)]mod tests{use super::*;
    fn header()->HeaderValue{let mut header=HeaderValue::from_static("Basic dGVzdDp0ZXN0");header.set_sensitive(true);header}
    #[test]fn anonymous_request_cannot_cancel_a_login_in_progress(){let sessions=Sessions::default();let server="http://127.0.0.1:4567/";let ticket=sessions.begin(server).unwrap();let anonymous=sessions.snapshot(server).unwrap();assert!(anonymous.ticket.is_none()&&anonymous.header.is_none());sessions.invalidate(server,anonymous.ticket);sessions.finish(server,ticket,header()).unwrap();assert!(sessions.snapshot(server).unwrap().header.is_some());}
    #[test]fn sessions_are_bound_to_exact_server_path_and_logout(){let sessions=Sessions::default();let server="https://server.test/yomi/";let ticket=sessions.begin(server).unwrap();sessions.finish(server,ticket,header()).unwrap();assert!(sessions.snapshot("https://server.test/yomi").unwrap().header.is_some());assert!(sessions.snapshot("https://server.test/other").unwrap().header.is_none());sessions.logout(None).unwrap();assert!(sessions.snapshot(server).unwrap().header.is_none());}
    #[test]fn late_login_and_late_unauthorized_response_cannot_replace_new_session(){let sessions=Sessions::default();let server="http://127.0.0.1:4567/";let old=sessions.begin(server).unwrap();let new=sessions.begin(server).unwrap();assert!(sessions.finish(server,old,header()).is_err());sessions.finish(server,new,header()).unwrap();sessions.invalidate(server,Some(old));assert!(sessions.snapshot(server).unwrap().header.is_some());sessions.logout(Some(server)).unwrap();assert!(sessions.finish(server,new,header()).is_err());}
}
