use crate::storage::Result;
use std::{path::Path, sync::Mutex};

#[derive(Default)]
pub struct Engine(Mutex<Option<Running>>);
struct Running {
    child: std::process::Child,
    server: String,
    secret: String,
    #[cfg(windows)]
    _job: Job,
}
impl Drop for Running {
    fn drop(&mut self) { let _ = self.child.kill(); let _ = self.child.wait(); }
}
impl Engine {
    pub fn owns(&self,server:&str)->bool{self.0.lock().ok().and_then(|state|state.as_ref().map(|running|running.server==server)).unwrap_or(false)}
    pub fn stop(&self) {
        if let Ok(mut state) = self.0.lock() { state.take(); }
    }
    pub fn start(&self, runtime: &Path, data: &Path, sockets: &Path) -> Result<(String, String)> {
        let mut state = self.0.lock().map_err(|_| "Motor ocupado")?;
        if let Some(running) = state.as_mut() {
            if running.child.try_wait().map_err(|e| e.to_string())?.is_none() {
                return Ok((running.server.clone(), running.secret.clone()));
            }
        }
        state.take();
        let running = launch(runtime, data, sockets)?;
        let result = (running.server.clone(), running.secret.clone());
        *state = Some(running);
        Ok(result)
    }
}

#[cfg(not(windows))]
fn launch(_: &Path, _: &Path, _: &Path) -> Result<Running> { Err("Motor integrado disponível somente no Windows x64".into()) }

#[cfg(windows)]
struct Job(isize);
#[cfg(windows)]
unsafe impl Send for Job {}
#[cfg(windows)]
#[link(name = "kernel32")]
unsafe extern "system" {
    fn CreateJobObjectW(attributes: *const std::ffi::c_void, name: *const u16) -> isize;
    fn SetInformationJobObject(job: isize, class: i32, info: *const std::ffi::c_void, size: u32) -> i32;
    fn AssignProcessToJobObject(job: isize, process: isize) -> i32;
    fn CloseHandle(handle: isize) -> i32;
}
#[cfg(windows)]
impl Drop for Job { fn drop(&mut self) { unsafe { CloseHandle(self.0); } } }
#[cfg(windows)]
fn job(child: &std::process::Child) -> Result<Job> {
    use std::os::windows::io::AsRawHandle;
    // JOBOBJECT_EXTENDED_LIMIT_INFORMATION for the Windows x64 build.
    #[repr(C, align(8))]
    struct Limits([u8; 144]);
    let mut limits = Limits([0; 144]);
    limits.0[16..20].copy_from_slice(&0x2000u32.to_ne_bytes());
    unsafe {
        let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if handle == 0 { return Err("Não foi possível proteger o processo do motor".into()); }
        let job = Job(handle);
        if SetInformationJobObject(handle, 9, &limits as *const _ as _, 144) == 0 || AssignProcessToJobObject(handle, child.as_raw_handle() as isize) == 0 {
            return Err("O Windows não permitiu vincular o motor ao Selene".into());
        }
        Ok(job)
    }
}

#[cfg(windows)]
fn launch(runtime: &Path, data: &Path, sockets: &Path) -> Result<Running> {
    use std::{fs, net::TcpListener, os::windows::process::CommandExt, process::{Command, Stdio}, time::{Duration, Instant}};
    let java = runtime.join("jre/bin/java.exe"); let jar = runtime.join("bin/Suwayomi-Server.jar");
    if !java.is_file() || !jar.is_file() { return Err("Motor não incluído nesta instalação. Instale a edição completa do Selene.".into()); }
    fs::create_dir_all(data).map_err(|e| e.to_string())?;
    fs::create_dir_all(sockets).map_err(|e| e.to_string())?;
    let port_file=data.join("port.txt");
    let preferred=fs::read_to_string(&port_file).ok().and_then(|s|s.trim().parse::<u16>().ok()).filter(|p|*p>=1024).unwrap_or(0);
    let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST,preferred)).map_err(|_| "A porta reservada ao motor está ocupada. Feche outra instância do Selene e tente novamente.")?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port(); drop(listener);
    fs::write(port_file,port.to_string()).map_err(|e|e.to_string())?;
    let server = format!("http://127.0.0.1:{port}/");
    let secret = uuid::Uuid::new_v4().to_string();
    let log = fs::File::create(data.join("engine.log")).map_err(|e| e.to_string())?;
    let mut child = Command::new(java).current_dir(runtime)
        .arg(format!("-Djdk.net.unixdomain.tmpdir={}", sockets.display()))
        .arg(format!("-Djava.io.tmpdir={}", sockets.display()))
        .arg(format!("-Dsuwayomi.tachidesk.config.server.rootDir={}", data.display()))
        .arg("-Dsuwayomi.tachidesk.config.server.ip=127.0.0.1")
        .arg(format!("-Dsuwayomi.tachidesk.config.server.port={port}"))
        .arg("-Dsuwayomi.tachidesk.config.server.authMode=basic_auth")
        .arg("-Dsuwayomi.tachidesk.config.server.authUsername=yomi-internal")
        .arg(format!("-Dsuwayomi.tachidesk.config.server.authPassword={secret}"))
        .arg("-Dsuwayomi.tachidesk.config.server.systemTrayEnabled=false")
        .arg("-Dsuwayomi.tachidesk.config.server.initialOpenInBrowserEnabled=false")
        .arg("-Dsuwayomi.tachidesk.config.server.webUIEnabled=false")
        .arg("-Dsuwayomi.tachidesk.config.server.webUIChannel=BUNDLED")
        .arg(format!("-Dsuwayomi.tachidesk.config.server.kcefEnabled={}",data.join("browser-enabled").is_file()))
        .arg("-Dsuwayomi.tachidesk.config.server.webUIUpdateCheckInterval=0")
        .arg("-jar").arg(jar).stdin(Stdio::null()).stdout(Stdio::from(log.try_clone().map_err(|e|e.to_string())?)).stderr(Stdio::from(log))
        .creation_flags(0x08000000).spawn().map_err(|_| "Não foi possível iniciar o motor integrado")?;
    let job = match job(&child) { Ok(job) => job, Err(error) => { let _ = child.kill(); let _ = child.wait(); return Err(error); } };
    let mut running = Running { child, server, secret, _job: job };
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(90) {
        if running.child.try_wait().map_err(|e|e.to_string())?.is_some() { return Err("O motor encerrou durante a inicialização. Consulte engine.log na pasta de dados.".into()); }
        if let Ok(connection) = crate::suwayomi::Connection::new(&running.server) {
            if let Ok(header) = connection.basic_header("yomi-internal", &running.secret) {
                if connection.authorized(Some(header)).connect().is_ok() { return Ok(running); }
            }
        }
        std::thread::sleep(Duration::from_millis(400));
    }
    Err("O motor demorou para iniciar. Consulte engine.log e tente novamente.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn missing_runtime_does_not_launch_a_process() {
        let temp = tempfile::tempdir().unwrap();
        assert!(Engine::default().start(temp.path(), &temp.path().join("data"), &temp.path().join("tmp")).is_err());
    }
    #[cfg(windows)]
    #[test]
    #[ignore = "inicia Java e baixa navegador opcional, somente página local controlada"]
    fn official_interactive_browser_renders_local_page_through_private_proxy(){
        let runtime=std::env::var_os("YOMI_ENGINE_RUNTIME").expect("YOMI_ENGINE_RUNTIME");
        let temp=tempfile::tempdir().unwrap();let engine=Engine::default();
        let root=std::env::var_os("YOMI_BROWSER_TEST_ROOT").map(std::path::PathBuf::from).unwrap_or_else(||temp.path().to_path_buf());
        let (server,secret)=engine.start(Path::new(&runtime),&root.join("data"),&root.join("sock")).unwrap();
        let connection=crate::suwayomi::Connection::new(&server).unwrap();let header=connection.basic_header("yomi-internal",&secret).unwrap();
        let connection=connection.authorized(Some(header.clone()));
        let _:serde_json::Value=connection.graphql("mutation{setSettings(input:{settings:{kcefEnabled:true}}){settings{kcefEnabled}}}",serde_json::json!({}),"setSettings").unwrap();
        let proxy=crate::source_browser::Proxy::new(&server,header).unwrap();
        let html=reqwest::blocking::get(proxy.url.clone()).unwrap();assert!(html.status().is_success());let html=html.text().unwrap();assert!(html.contains("WebSocket"));assert!(!html.contains(&secret));
        std::fs::write(Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().join(".test-results/source-browser.html"),&html).unwrap();
        let status=std::process::Command::new("node").arg("tests/source-browser-ui.mjs").current_dir(Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap()).env("YOMI_SOURCE_BROWSER_URL",proxy.url.as_str()).status().unwrap();
        engine.stop();if !status.success(){eprintln!("Browser diagnostics preserved: {}",temp.keep().display());}assert!(status.success());
    }
    #[cfg(windows)]
    #[test]
    #[ignore = "requer runtime oficial, inicia Java local isolado"]
    fn official_engine_starts_reuses_stops_and_restarts_with_same_port(){
        let runtime=std::env::var_os("YOMI_ENGINE_RUNTIME").expect("YOMI_ENGINE_RUNTIME");
        let temp=tempfile::tempdir().unwrap();let engine=Engine::default();
        let local=temp.path().join("data/local/Yomi Chapter URL/Chapter 1");std::fs::create_dir_all(&local).unwrap();
        let png=std::fs::read(Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().join("node_modules/playwright-core/lib/server/chromium/appIcon.png")).unwrap();
        std::fs::write(local.join("1.png"),png).unwrap();
        let (server,secret)=engine.start(Path::new(&runtime),&temp.path().join("data"),&temp.path().join("sock")).unwrap();
        assert!(crate::suwayomi::Connection::new(&server).unwrap().connect().is_err());
        let connect=|secret:&str|{let c=crate::suwayomi::Connection::new(&server).unwrap();let h=c.basic_header("yomi-internal",secret).unwrap();c.authorized(Some(h))};
        assert!(connect(&secret).connect().unwrap().authenticated);
        assert_eq!(connect(&secret).source_site("0").unwrap(),None);
        let options=crate::source_catalog::options(&connect(&secret),"0").unwrap();assert!(options.genres.len()<=500);
        assert!(!crate::source_catalog::fetch(&connect(&secret),"0","",1,"popular",None).unwrap().mangas.is_empty());
        let manga=connect(&secret).search("0","Yomi Chapter URL",1).unwrap().mangas.into_iter().find(|m|m.title=="Yomi Chapter URL").unwrap();
        let chapter=connect(&secret).chapters(manga.id).unwrap().chapters[0].id;
        let url:serde_json::Value=connect(&secret).graphql("query($id:Int!){chapter(id:$id){url realUrl}}",serde_json::json!({"id":chapter}),"chapter").unwrap();
        assert!(url.get("url").and_then(serde_json::Value::as_str).is_some());
        let catalog=crate::extensions::catalog(connect(&secret),false).unwrap();assert!(catalog.stores.is_empty());
        assert!(crate::extensions::catalog(connect(&secret),true).is_ok());
        assert!(crate::extensions::change(connect(&secret),"yomi.nonexistent","install").is_err());
        let second=engine.start(Path::new(&runtime),&temp.path().join("data"),&temp.path().join("sock")).unwrap();assert_eq!((server.clone(),secret.clone()),second);
        engine.stop();
        let (same,new_secret)=engine.start(Path::new(&runtime),&temp.path().join("data"),&temp.path().join("sock")).unwrap();assert_eq!(server,same);assert_ne!(secret,new_secret);
        assert!(connect(&new_secret).connect().is_ok());engine.stop();
    }
}
