mod storage;
mod pdf;
mod backup;
mod batch;
mod suwayomi;
mod downloads;
mod queue_store;
mod data_location;
mod download_files;
mod auth_sessions;
mod engine;
mod extensions;
mod source_browser;
mod site_history;
mod online_favorites;
mod source_catalog;
#[derive(Default)]struct BrowserProxy(std::sync::Mutex<Option<source_browser::Proxy>>);
struct SiteLayout{active:std::sync::atomic::AtomicBool,comfortable:std::sync::atomic::AtomicBool,zoom:std::sync::atomic::AtomicU32,hidden:std::sync::atomic::AtomicBool}
impl Default for SiteLayout{fn default()->Self{Self{active:std::sync::atomic::AtomicBool::new(false),comfortable:std::sync::atomic::AtomicBool::new(true),zoom:std::sync::atomic::AtomicU32::new(100),hidden:std::sync::atomic::AtomicBool::new(false)}}}

use std::path::{Path, PathBuf, Component};
use tauri::{Manager, State};
use storage::{Book, BookMetadata, BookPages, Library, Result};

fn allow_library_image(app: &tauri::AppHandle, library: &Library, path: &str) -> Result<()> {
    let path=Path::new(path);
    if !path.starts_with(library.root.join("library")) || path.components().any(|part|matches!(part,Component::ParentDir)) {
        return Err("Imagem fora da biblioteca interna".into());
    }
    // MSIX virtualization may redirect individual files while their parent stays physical.
    app.asset_protocol_scope().allow_file(path).map_err(|error|error.to_string())
}

async fn blocking<T, F>(operation: F) -> Result<T>
where T: Send + 'static, F: FnOnce() -> Result<T> + Send + 'static {
    tauri::async_runtime::spawn_blocking(operation).await.map_err(|e| e.to_string())?
}
async fn online<T,F>(sessions:&auth_sessions::Sessions,server:String,operation:F)->Result<T>
where T:Send+'static,F:FnOnce(suwayomi::Connection)->Result<T>+Send+'static{
    let snapshot=sessions.snapshot(&server)?;let key=snapshot.server.clone();let ticket=snapshot.ticket;
    let result=blocking(move||operation(suwayomi::Connection::new(&snapshot.server)?.authorized(snapshot.header))).await;
    if result.as_ref().err().is_some_and(|error|error==auth_sessions::AUTH_REQUIRED){sessions.invalidate(&key,ticket);}
    result
}
#[tauri::command]
async fn start_integrated_engine(app:tauri::AppHandle,state:State<'_,Library>,engine:State<'_,std::sync::Arc<engine::Engine>>,sessions:State<'_,auth_sessions::Sessions>)->Result<suwayomi::ConnectionInfo>{
    let runtime=app.path().resource_dir().map_err(|e|e.to_string())?.join("suwayomi");
    let data=state.root.join("engine");
    let sockets=PathBuf::from(std::env::var_os("USERPROFILE").ok_or("Pasta do usuário indisponível")?).join(".yomi-sock");
    let manager=engine.inner().clone();
    let (server,secret)=blocking(move||manager.start(&runtime,&data,&sockets)).await?;
    let connection=suwayomi::Connection::new(&server)?;
    let header=connection.basic_header("yomi-internal",&secret)?;
    let ticket=sessions.begin(&server)?;sessions.finish(&server,ticket,header)?;
    online(&sessions,server,|connection|connection.connect()).await
}
#[tauri::command]
async fn extension_catalog(sessions:State<'_,auth_sessions::Sessions>,server:String,refresh:bool)->Result<extensions::Catalog>{online(&sessions,server,move|connection|extensions::catalog(connection,refresh)).await}
#[tauri::command]
async fn extension_store(sessions:State<'_,auth_sessions::Sessions>,server:String,url:String,remove:bool)->Result<()>{online(&sessions,server,move|connection|extensions::store(connection,&url,remove)).await}
#[tauri::command]
async fn extension_change(sessions:State<'_,auth_sessions::Sessions>,server:String,id:String,action:String)->Result<()>{online(&sessions,server,move|connection|extensions::change(connection,&id,&action)).await}
#[tauri::command]
fn reader_fullscreen(app:tauri::AppHandle,enabled:Option<bool>)->Result<bool>{
    let window=app.get_window("main").ok_or("Janela do leitor indisponível")?;
    if let Some(value)=enabled{window.set_fullscreen(value).map_err(|e|e.to_string())?;resize_source_site(&app)?;}
    window.is_fullscreen().map_err(|e|e.to_string())
}
fn resize_source_site(app:&tauri::AppHandle)->Result<()>{
    if let (Some(window),Some(view))=(app.get_window("main"),app.get_webview("source-site")){
        let size=window.inner_size().map_err(|e|e.to_string())?;
        let top=(if app.state::<SiteLayout>().hidden.load(std::sync::atomic::Ordering::Relaxed){32.0}else{72.0}*window.scale_factor().map_err(|e|e.to_string())?).round() as u32;
        let layout=app.state::<SiteLayout>();
        let width=if layout.comfortable.load(std::sync::atomic::Ordering::Relaxed){size.width.min((1120.0*window.scale_factor().map_err(|e|e.to_string())?).round() as u32)}else{size.width};
        view.set_position(tauri::PhysicalPosition::new(((size.width-width)/2) as i32,top as i32)).map_err(|e|e.to_string())?;
        view.set_size(tauri::PhysicalSize::new(width,size.height.saturating_sub(top).max(1))).map_err(|e|e.to_string())?;
        view.set_zoom(layout.zoom.load(std::sync::atomic::Ordering::Relaxed) as f64/100.0).map_err(|e|e.to_string())?;
    }Ok(())
}
#[tauri::command]
fn close_source_site(app:tauri::AppHandle)->Result<()>{
    app.state::<SiteLayout>().active.store(false,std::sync::atomic::Ordering::Relaxed);
    // Keep the child controller alive: destroying a focused WebView2 can leave
    // the main controller without a visible surface on some Windows systems.
    if let Some(view)=app.get_webview("source-site"){view.hide().map_err(|e|e.to_string())?;}
    let window=app.get_window("main").ok_or("Janela principal indisponível")?;
    let main=app.get_webview("main").ok_or("Catálogo indisponível")?;
    main.set_position(tauri::PhysicalPosition::new(0,0)).map_err(|e|e.to_string())?;
    main.set_size(window.inner_size().map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    main.set_auto_resize(true).map_err(|e|e.to_string())?;
    main.show().map_err(|e|e.to_string())?;
    main.set_focus().map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command]
fn set_site_layout(app:tauri::AppHandle,comfortable:bool,zoom:u32,hidden:Option<bool>)->Result<()>{
    if !(70..=160).contains(&zoom){return Err("Zoom fora do limite permitido".into());}
    let layout=app.state::<SiteLayout>();layout.comfortable.store(comfortable,std::sync::atomic::Ordering::Relaxed);layout.zoom.store(zoom,std::sync::atomic::Ordering::Relaxed);layout.hidden.store(hidden.unwrap_or(false),std::sync::atomic::Ordering::Relaxed);
    resize_source_site(&app)
}
#[tauri::command]
async fn list_online_favorites(app:tauri::AppHandle,state:State<'_,Library>)->Result<Vec<online_favorites::Favorite>>{
    let library=state.inner().clone();let mut values=blocking(move||online_favorites::list(&library)).await?;
    for value in &mut values{if !value.cover.is_empty(){if Path::new(&value.cover).is_file(){allow_library_image(&app,&state,&value.cover)?;}else{value.cover.clear();}}}
    Ok(values)
}
#[tauri::command]
async fn set_online_favorite(state:State<'_,Library>,engine:State<'_,std::sync::Arc<engine::Engine>>,input:online_favorites::Input,enabled:bool)->Result<()>{
    let integrated=engine.owns(crate::suwayomi::normalized_server(&input.server)?.as_str());let library=state.inner().clone();
    blocking(move||online_favorites::set(&library,input,enabled,integrated)).await
}
#[tauri::command]
async fn list_site_readings(app:tauri::AppHandle,state:State<'_,Library>)->Result<Vec<site_history::Reading>>{
    let library=state.inner().clone();let mut rows=blocking(move||site_history::list(&library)).await?;
    for row in &mut rows{if !row.cover.is_empty(){if Path::new(&row.cover).is_file(){allow_library_image(&app,&state,&row.cover)?;}else{row.cover.clear();}}}
    Ok(rows)
}
#[tauri::command]
async fn remove_site_reading(state:State<'_,Library>,id:String)->Result<()>{let library=state.inner().clone();blocking(move||site_history::remove(&library,&id)).await}
#[tauri::command]
async fn resume_site_reading(app:tauri::AppHandle,state:State<'_,Library>,id:String)->Result<()>{
    let library=state.inner().clone();let site=blocking(move||site_history::resume(&library,&id)).await?;
    show_source_site(&app,&site)
}
#[tauri::command]
async fn open_source_site(app:tauri::AppHandle,state:State<'_,Library>,sessions:State<'_,auth_sessions::Sessions>,server:String,source:String,chapter_id:Option<i32>,metadata:Option<site_history::Metadata>)->Result<()>{
    let server=suwayomi::normalized_server(&server)?.to_string();let key=server.clone();
    let site=online(&sessions,server,move|connection|connection.verification_site(&source,chapter_id)).await?;
    show_source_site(&app,&site)?;
    if let Some(metadata)=metadata.filter(|_|chapter_id.is_some()){
        let library=state.inner().clone();
        blocking(move||{let cover=site_history::cached_cover(&library,&key,metadata.manga_id);site_history::record(&library,&site,&metadata,&cover)}).await?;
    }Ok(())
}
fn show_source_site(app:&tauri::AppHandle,site:&str)->Result<()>{
    app.state::<SiteLayout>().active.store(true,std::sync::atomic::Ordering::Relaxed);
    let url=source_browser::site_url(&site)?;
    if let Some(view)=app.get_webview("source-site"){
        view.navigate(url).map_err(|e|e.to_string())?;
        view.show().map_err(|e|e.to_string())?;
    }else{
        let window=app.get_window("main").ok_or("Janela principal indisponível")?;
        let size=window.inner_size().map_err(|e|e.to_string())?.to_logical::<f64>(window.scale_factor().map_err(|e|e.to_string())?);
        let builder=tauri::webview::WebviewBuilder::new("source-site",tauri::WebviewUrl::External(url))
            .on_page_load(|view,payload|{if view.app_handle().state::<SiteLayout>().active.load(std::sync::atomic::Ordering::Relaxed)&&matches!(payload.event(),tauri::webview::PageLoadEvent::Finished){let library=view.app_handle().state::<Library>().inner().clone();let url=payload.url().to_string();tauri::async_runtime::spawn_blocking(move||{let _=site_history::visited(&library,&url);});}})
            .on_navigation(|url|source_browser::site_url(url.as_str()).is_ok());
        window.add_child(builder,tauri::LogicalPosition::new(0.0,72.0),tauri::LogicalSize::new(size.width,(size.height-72.0).max(1.0))).map_err(|e|e.to_string())?;
    }
    resize_source_site(app)
}
#[tauri::command]
async fn open_source_browser(app:tauri::AppHandle,state:State<'_,Library>,engine:State<'_,std::sync::Arc<engine::Engine>>,proxy:State<'_,BrowserProxy>,sessions:State<'_,auth_sessions::Sessions>,server:String,source:String,chapter_id:Option<i32>)->Result<()>{
    let server=suwayomi::normalized_server(&server)?.to_string();
    if !engine.owns(&server){return Err("Use as fontes integradas para abrir a verificação. Um servidor externo precisa do próprio navegador.".into());}
    source.parse::<i64>().map_err(|_|"Fonte inválida")?;
    let key=server.clone();
    let site:String=online(&sessions,server.clone(),move|connection|{
        let site=connection.verification_site(&source,chapter_id)?;
        let _:serde_json::Value=connection.graphql("mutation{setSettings(input:{settings:{kcefEnabled:true}}){settings{kcefEnabled}}}",serde_json::json!({}),"setSettings")?;
        Ok(site)
    }).await?;
    std::fs::write(state.root.join("engine/browser-enabled"),b"1").map_err(|e|e.to_string())?;
    if let Some(window)=app.get_webview_window("source-browser"){
        let mut url=proxy.0.lock().map_err(|_|"Navegador ocupado")?.as_ref().ok_or("Feche a janela de verificação e tente novamente")?.url.clone();
        url.query_pairs_mut().append_pair("view",&uuid::Uuid::new_v4().to_string());url.set_fragment(Some(&site));
        window.navigate(url).map_err(|e|e.to_string())?;window.set_focus().map_err(|e|e.to_string())?;return Ok(());
    }
    let header=sessions.snapshot(&key)?.header.ok_or("Reconecte as fontes integradas")?;
    let bridge=source_browser::Proxy::new(&key,header)?;
    let mut url=bridge.url.clone();url.set_fragment(Some(&site));
    let origin=url.origin();let path=url.path().to_string();
    *proxy.0.lock().map_err(|_|"Navegador ocupado")?=Some(bridge);
    tauri::WebviewWindowBuilder::new(&app,"source-browser",tauri::WebviewUrl::External(url))
        .title("Verificação da fonte — conclua, feche e tente o capítulo novamente")
        .inner_size(1100.0,850.0).on_navigation(move|url|url.origin()==origin&&url.path()==path)
        .build().map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command]
async fn suwayomi_login(sessions:State<'_,auth_sessions::Sessions>,server:String,username:String,password:String)->Result<suwayomi::ConnectionInfo>{
    let key=suwayomi::normalized_server(&server)?.to_string();let ticket=sessions.begin(&key)?;let target=key.clone();
    let result=blocking(move||{let connection=suwayomi::Connection::new(&target)?;let header=connection.basic_header(&username,&password)?;let info=connection.authorized(Some(header.clone())).connect()?;Ok((info,header))}).await;
    match result{Ok((info,header))=>{sessions.finish(&key,ticket,header)?;Ok(info)},Err(error)=>{sessions.invalidate(&key,Some(ticket));Err(error)}}
}
#[tauri::command]
fn suwayomi_logout(app:tauri::AppHandle,proxy:State<'_,BrowserProxy>,sessions:State<'_,auth_sessions::Sessions>,server:Option<String>)->Result<()>{
    if let Some(window)=app.get_webview("source-site"){let _=window.close();}
    if let Some(window)=app.get_webview_window("source-browser"){let _=window.close();}
    if let Ok(mut state)=proxy.0.lock(){state.take();}
    sessions.logout(server.as_deref())
}
#[tauri::command]
fn suwayomi_session(sessions:State<'_,auth_sessions::Sessions>,server:String)->Result<bool>{Ok(sessions.snapshot(&server)?.header.is_some())}
#[tauri::command]
async fn get_saved_queue(state:State<'_,Library>)->Result<queue_store::Record>{let library=state.inner().clone();blocking(move||queue_store::load(&library)).await}
#[tauri::command]
fn get_data_location(state:State<'_,Library>)->String{state.root.to_string_lossy().to_string()}
#[tauri::command]
async fn save_download_queue(state:State<'_,Library>,expected_revision:i64,queue:Option<queue_store::Snapshot>)->Result<queue_store::Record>{let library=state.inner().clone();blocking(move||queue_store::store(&library,expected_revision,queue)).await}

#[tauri::command]
async fn suwayomi_connect(sessions:State<'_,auth_sessions::Sessions>,server:String) ->Result<suwayomi::ConnectionInfo> {online(&sessions,server,|connection|connection.connect()).await}
#[tauri::command]
async fn suwayomi_search(sessions:State<'_,auth_sessions::Sessions>,server:String,source:String,query:String,page:u32,kind:Option<String>,genre:Option<String>) ->Result<suwayomi::SearchResults> {online(&sessions,server,move|connection|if kind.is_none()&&genre.is_none(){connection.search(&source,&query,page)}else{source_catalog::fetch(&connection,&source,&query,page,kind.as_deref().unwrap_or("popular"),genre.as_deref())}).await}
#[tauri::command]
async fn suwayomi_catalog_options(sessions:State<'_,auth_sessions::Sessions>,server:String,source:String)->Result<source_catalog::Options>{online(&sessions,server,move|connection|source_catalog::options(&connection,&source)).await}
#[tauri::command]
async fn suwayomi_chapters(sessions:State<'_,auth_sessions::Sessions>,server:String,manga_id:i32) ->Result<suwayomi::ChapterList> {online(&sessions,server,move|connection|connection.chapters(manga_id)).await}
#[tauri::command]
async fn open_online_chapter(state:State<'_,Library>,sessions:State<'_,auth_sessions::Sessions>,server:String,manga_id:i32,chapter_id:i32)->Result<Book>{
    let library=state.inner().clone();online(&sessions,server,move|connection|connection.open_stream(&library,manga_id,chapter_id)).await
}
#[tauri::command]
async fn online_page(app:tauri::AppHandle,state:State<'_,Library>,sessions:State<'_,auth_sessions::Sessions>,id:String,index:usize)->Result<String>{
    let library=state.inner().clone();
    let server=library.db()?.query_row("SELECT server FROM stream_pages WHERE book_id=?1 AND position=?2",rusqlite::params![id,index],|r|r.get::<_,String>(0)).map_err(|_|"Página online não encontrada")?;
    let path=online(&sessions,server,move|connection|{let _guard=library.mutation.lock().map_err(|e|e.to_string())?;connection.stream_page(&library,&id,index)}).await?;
    allow_library_image(&app,&state,&path)?;Ok(path)
}
#[tauri::command]
async fn suwayomi_cover(app:tauri::AppHandle,state:State<'_,Library>,sessions:State<'_,auth_sessions::Sessions>,server:String,manga_id:i32) ->Result<String> {
    let library=state.inner().clone();let path=online(&sessions,server,move|connection|connection.cover(&library,manga_id)).await?;
    allow_library_image(&app,&state,&path)?;Ok(path)
}
#[tauri::command]
async fn suwayomi_download(state:State<'_,Library>,jobs:State<'_,downloads::Downloads>,sessions:State<'_,auth_sessions::Sessions>,server:String,manga_id:i32,chapter_id:i32,job_id:String) ->Result<Book> {
    let control=jobs.start(&job_id)?;let library=state.inner().clone();
    let result=online(&sessions,server,move|connection|connection.download_chapter_controlled(&library,manga_id,chapter_id,&control)).await;
    jobs.remove(&job_id);result
}
#[tauri::command]
fn prepare_download(jobs:State<'_,downloads::Downloads>)->Result<String>{jobs.prepare()}
#[tauri::command]
fn download_progress(jobs:State<'_,downloads::Downloads>,job_id:String)->Result<downloads::Progress>{jobs.get(&job_id)?.snapshot()}
#[tauri::command]
fn cancel_download(jobs:State<'_,downloads::Downloads>,job_id:String)->Result<bool>{match jobs.get(&job_id){Ok(job)=>job.cancel(),Err(_)=>Ok(false)}}
#[tauri::command]
async fn list_books(app:tauri::AppHandle,state: State<'_, Library>) -> Result<Vec<Book>> {
    let library = state.inner().clone(); let books=blocking(move || library.list()).await?;
    for book in &books { allow_library_image(&app,&state,&book.cover)?; } Ok(books)
}
#[tauri::command]
async fn import_book(state: State<'_, Library>, kind: String) -> Result<Option<Book>> {
    let library = state.inner().clone();
    blocking(move || {
        let path = match kind.as_str() {
            "folder" => rfd::FileDialog::new().set_title("Escolha uma pasta de imagens").pick_folder(),
            "cbz" => rfd::FileDialog::new().set_title("Escolha um mangá CBZ").add_filter("Comic Book ZIP", &["cbz"]).pick_file(),
            "pdf" => rfd::FileDialog::new().set_title("Escolha um PDF sem senha").add_filter("PDF", &["pdf"]).pick_file(),
            _ => return Err("Formato de importação inválido".into()),
        };
        path.map(|path| library.import(&path, &kind)).transpose()
    }).await
}
#[tauri::command]
async fn import_cbz_batch(state: State<'_, Library>) -> Result<Option<batch::BatchReport>> {
    let library = state.inner().clone();
    blocking(move || {
        rfd::FileDialog::new().set_title("Selecione até 50 arquivos CBZ")
            .add_filter("Comic Book ZIP", &["cbz"]).pick_files()
            .filter(|paths| !paths.is_empty()).map(|paths| library.import_cbz_batch(paths)).transpose()
    }).await
}
#[tauri::command]
async fn open_book(app:tauri::AppHandle,state: State<'_, Library>, id: String) -> Result<BookPages> {
    let library = state.inner().clone(); let book=blocking(move || library.open(&id)).await?;
    for path in &book.pages { allow_library_image(&app,&state,path)?; } Ok(book)
}
#[tauri::command]
async fn save_progress(state: State<'_, Library>, id: String, page: usize, completed: bool) -> Result<()> {
    let library = state.inner().clone(); blocking(move || library.progress(&id, page, completed)).await
}
#[tauri::command]
async fn set_favorite(state: State<'_, Library>, id: String, favorite: bool) -> Result<()> {
    let library = state.inner().clone(); blocking(move || library.favorite(&id, favorite)).await
}
#[tauri::command]
async fn remove_book(state: State<'_, Library>, id: String) -> Result<()> {
    let library = state.inner().clone(); blocking(move || library.remove(&id)).await
}
#[tauri::command]
async fn update_metadata(state: State<'_, Library>, id: String, metadata: BookMetadata) -> Result<()> {
    let library = state.inner().clone(); blocking(move || library.update_metadata(&id,metadata)).await
}
#[tauri::command]
async fn set_bookmark(state: State<'_, Library>, id: String, page: usize, marked: bool) -> Result<()> {
    let library = state.inner().clone(); blocking(move || library.bookmark(&id, page, marked)).await
}
#[tauri::command]
async fn export_reading_backup(state: State<'_, Library>) -> Result<Option<String>> {
    let library = state.inner().clone();
    blocking(move || {
        let path = rfd::FileDialog::new().set_title("Salvar backup de leitura (sem imagens)")
            .add_filter("Backup Selene JSON", &["json"]).set_file_name("selene-leitura.json").save_file();
        path.map(|path| { library.export_reading_backup(&path)?; Ok(path.to_string_lossy().to_string()) }).transpose()
    }).await
}
#[tauri::command]
async fn preview_reading_restore(state: State<'_, Library>) -> Result<Option<backup::RestorePreview>> {
    let library = state.inner().clone();
    blocking(move || {
        rfd::FileDialog::new().set_title("Selecionar backup de leitura").add_filter("Backup Selene JSON", &["json"])
            .pick_file().map(|path| library.preview_reading_restore(&path)).transpose()
    }).await
}
#[tauri::command]
async fn apply_reading_restore(state: State<'_, Library>, token: String, include_settings: bool) -> Result<backup::RestoreResult> {
    let library = state.inner().clone(); blocking(move || library.apply_reading_restore(&token, include_settings)).await
}
#[tauri::command]
async fn cancel_reading_restore(state: State<'_, Library>, token: String) -> Result<()> {
    let library = state.inner().clone(); blocking(move || library.cancel_reading_restore(&token)).await
}
#[tauri::command]
async fn get_settings(state: State<'_, Library>) -> Result<serde_json::Value> {
    let library = state.inner().clone(); blocking(move || library.settings()).await
}
#[tauri::command]
async fn save_settings(state: State<'_, Library>, value: serde_json::Value) -> Result<()> {
    let library = state.inner().clone(); blocking(move || library.save_settings(value)).await
}
pub fn run() {
    tauri::Builder::default()
        .manage(downloads::Downloads::default())
        .manage(auth_sessions::Sessions::default())
        .manage(std::sync::Arc::new(engine::Engine::default()))
        .manage(BrowserProxy::default())
        .manage(SiteLayout::default())
        .setup(|app| {
            let root: PathBuf = data_location::resolve(std::env::args_os().skip(1),app.path().app_data_dir()?).map_err(std::io::Error::other)?;
            let library = Library::new(root).map_err(std::io::Error::other)?;
            // Resolve the real library after creating it, including Windows canonical paths.
            app.asset_protocol_scope().allow_directory(library.root.join("library"), true)?;
            for entry in std::fs::read_dir(library.root.join("library"))? {
                let entry=entry?;
                if entry.file_type()?.is_dir() {app.asset_protocol_scope().allow_directory(entry.path(),true)?;}
            }
            app.manage(library);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![reader_fullscreen, remove_site_reading, suwayomi_catalog_options, list_online_favorites, set_online_favorite, set_site_layout, list_site_readings, resume_site_reading, close_source_site, open_source_site, open_source_browser, open_online_chapter, online_page, start_integrated_engine, extension_catalog, extension_store, extension_change, list_books, import_book, import_cbz_batch, open_book, save_progress, set_favorite, remove_book, update_metadata, set_bookmark, get_settings, save_settings, export_reading_backup, preview_reading_restore, apply_reading_restore, cancel_reading_restore, get_data_location, get_saved_queue, save_download_queue, prepare_download, download_progress, cancel_download, suwayomi_login, suwayomi_logout, suwayomi_session, suwayomi_connect, suwayomi_search, suwayomi_chapters, suwayomi_cover, suwayomi_download])
        .build(tauri::generate_context!())
        .expect("Não foi possível iniciar o Selene Reader")
        .run(|app,event|{
            if matches!(event,tauri::RunEvent::WindowEvent{ref label,event:tauri::WindowEvent::Resized(_)|tauri::WindowEvent::ScaleFactorChanged{..},..} if label=="main"){let _=resize_source_site(app);}
            if matches!(event,tauri::RunEvent::WindowEvent{ref label,event:tauri::WindowEvent::Destroyed,..} if label=="main"){
                if let Some(window)=app.get_webview("source-site"){let _=window.close();}
    if let Some(window)=app.get_webview_window("source-browser"){let _=window.close();}
            }
            if matches!(event,tauri::RunEvent::Exit){app.state::<std::sync::Arc<engine::Engine>>().stop();}
        });
}




