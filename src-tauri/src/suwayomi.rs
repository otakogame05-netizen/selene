use crate::storage::{Book, Library, Result};
use crate::downloads::Download;
use reqwest::{blocking::Client, redirect::Policy, Url};
use rusqlite::params;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{fs, io::{Read, Write}, path::{Path, PathBuf}, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};
use uuid::Uuid;

const MAX_JSON: u64 = 4 * 1024 * 1024;
const MAX_IMAGE: u64 = 64 * 1024 * 1024;
const MAX_CHAPTER: u64 = 1024 * 1024 * 1024;
const MAX_PAGES: usize = 1000;
const CONNECTION_QUERY: &str = "query YomiConnection { aboutServer { name version } sources { nodes { id name lang } } }";
const SEARCH_QUERY: &str = "mutation YomiSearch($input: FetchSourceMangaInput!) { fetchSourceManga(input: $input) { hasNextPage mangas { id title } } }";
const CHAPTERS_QUERY: &str = "mutation YomiChapters($input: FetchMangaAndChaptersInput!) { fetchMangaAndChapters(input: $input) { manga { id title description } chapters { id name chapterNumber } } }";
const PAGES_QUERY: &str = "mutation YomiPages($input: FetchChapterPagesInput!) { fetchChapterPages(input: $input) { chapter { id name manga { id title } } pages } }";

fn err(value: impl std::fmt::Display) -> String { value.to_string() }
fn short(value: &str, limit: usize) -> String { value.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(limit).collect() }
fn now() -> i64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64 }
fn authenticated_source_error(message:&str)->String{
    // Classify known failures without echoing credentials or arbitrary server text.
    let message=message.to_ascii_lowercase();
    if message.contains("no chapters found") {
        "A fonte não retornou capítulos para este título. Atualize a extensão no Selene e tente novamente, ou procure o título em outra fonte.".into()
    } else if message.contains("http error 404") {
        "O site da fonte respondeu 404 (página não encontrada). Atualize a extensão no Selene ou tente outra fonte.".into()
    } else if message.contains("cloudflare") {
        "O site exige uma verificação de navegador. Use Verificar acesso à fonte, conclua a verificação e tente novamente.".into()
    } else if message.contains("http error 403") {
        "O site da fonte recusou o acesso (403). Use Verificar acesso à fonte; se continuar, atualize a extensão ou tente outra fonte.".into()
    } else if message.contains("http error 429") {
        "O site da fonte limitou as consultas. Aguarde alguns minutos antes de tentar novamente.".into()
    } else {
        "O motor não concluiu a operação. Tente novamente ou atualize a extensão na seção Extensões do Selene.".into()
    }
}

fn source_id<'de, D: serde::Deserializer<'de>>(deserializer: D) -> std::result::Result<String,D::Error> {
    let value = Value::deserialize(deserializer)?;
    let id = value.as_str().map(str::to_string).or_else(|| value.as_i64().map(|v| v.to_string())).ok_or_else(|| serde::de::Error::custom("ID de fonte inválido"))?;
    id.parse::<i64>().map_err(serde::de::Error::custom)?;
    Ok(id)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source { #[serde(deserialize_with="source_id")] pub id: String, pub name: String, pub lang: String }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manga { pub id: i32, pub title: String, #[serde(default)] pub description: Option<String> }
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Chapter { pub id: i32, pub name: String, pub chapter_number: f64 }
#[derive(Serialize)]
pub struct ConnectionInfo { pub server: String, pub name: String, pub version: String, pub sources: Vec<Source>,pub authenticated:bool }
#[derive(Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct SearchResults { pub has_next_page: bool, pub mangas: Vec<Manga> }
#[derive(Serialize,Deserialize)]
pub struct ChapterList { pub manga: Manga, pub chapters: Vec<Chapter> }
#[derive(Deserialize)]
struct ChapterHeader { id: i32, name: String, manga: Manga }
#[derive(Deserialize)]
struct PageList { chapter: ChapterHeader, pages: Vec<String> }

pub fn normalized_server(server:&str)->Result<Url>{
        if server.len() > 2048 { return Err("Endereço do servidor muito longo".into()); }
        let mut base = Url::parse(server.trim()).map_err(|_| "Informe o endereço completo do Suwayomi, como http://127.0.0.1:4567")?;
        if !matches!(base.scheme(),"http"|"https") || base.host_str().is_none() || !base.username().is_empty() || base.password().is_some() || base.query().is_some() || base.fragment().is_some() {
            return Err("Use um endereço HTTP/HTTPS sem usuário, senha, parâmetros ou fragmento".into());
        }
        let path = format!("{}/",base.path().trim_end_matches('/'));
        base.set_path(&path);
        Ok(base)
}
pub struct Connection { base: Url, client: Client,authorization:Option<reqwest::header::HeaderValue> }
impl Connection {
    pub fn new(server: &str) -> Result<Self> {
        let base=normalized_server(server)?;
        let client = Client::builder().redirect(Policy::none()).connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(35)).user_agent(concat!("YomiReader/",env!("CARGO_PKG_VERSION"))).build().map_err(err)?;
        Ok(Self { base,client,authorization:None })
    }
    pub fn authorized(mut self,header:Option<reqwest::header::HeaderValue>)->Self{self.authorization=header;self}
    pub fn basic_header(&self,username:&str,password:&str)->Result<reqwest::header::HeaderValue>{
        let host=self.base.host_str().unwrap_or("").trim_start_matches('[').trim_end_matches(']');
        let loopback=host=="localhost"||host.parse::<std::net::IpAddr>().is_ok_and(|ip|ip.is_loopback());
        if self.base.scheme()!="https"&&!loopback{return Err("Use HTTPS para enviar login a um servidor fora deste computador".into())}
        if username.is_empty()||username.len()>1024||username.contains(':')||username.chars().any(char::is_control)||password.is_empty()||password.len()>4096||password.chars().any(char::is_control){return Err("Informe usuário e senha válidos. O usuário não pode conter dois-pontos.".into())}
        let request=self.client.get(self.api_url("api/graphql")?).basic_auth(username,Some(password)).build().map_err(|_|"Não foi possível preparar o login")?;
        let mut header=request.headers().get(reqwest::header::AUTHORIZATION).cloned().ok_or("Não foi possível preparar o login")?;header.set_sensitive(true);Ok(header)
    }
    fn request(&self,method:reqwest::Method,url:Url)->reqwest::blocking::RequestBuilder{let request=self.client.request(method,url);if let Some(header)=&self.authorization{request.header(reqwest::header::AUTHORIZATION,header.clone())}else{request}}
    fn api_url(&self, path: &str) -> Result<Url> { self.base.join(path).map_err(err) }
    pub(crate) fn graphql<T: DeserializeOwned>(&self, query: &str, variables: Value, field: &str) -> Result<T> {
        let response = self.request(reqwest::Method::POST,self.api_url("api/graphql")?).json(&json!({"query":query,"variables":variables})).send()
            .map_err(|error| if error.is_timeout() { "O Suwayomi demorou para responder. Tente novamente.".into() } else { "Não foi possível conectar ao Suwayomi. Confira o endereço e se o servidor está aberto.".to_string() })?;
        let status = response.status();
        if !status.is_success() {
            return Err(if matches!(status.as_u16(),401|403) { crate::auth_sessions::AUTH_REQUIRED.into() } else { format!("O servidor respondeu HTTP {}. Confira o endereço do Suwayomi.",status.as_u16()) });
        }
        let mut bytes = Vec::new(); response.take(MAX_JSON+1).read_to_end(&mut bytes).map_err(err)?;
        if bytes.len() as u64 > MAX_JSON { return Err("Resposta do Suwayomi excede 4 MiB".into()); }
        let body: Value = serde_json::from_slice(&bytes).map_err(|_| "O endereço não retornou uma resposta GraphQL válida do Suwayomi")?;
        if let Some(errors) = body.get("errors").and_then(Value::as_array).filter(|errors| !errors.is_empty()) {
            let message = errors[0].get("message").and_then(Value::as_str).unwrap_or("Erro sem descrição");
            if self.authorization.is_some(){return Err(authenticated_source_error(message))}
            return Err(format!("Suwayomi: {}",short(message,350)));
        }
        let data = body.get("data").filter(|v| !v.is_null()).ok_or("O Suwayomi não retornou dados para esta operação")?;
        let value = if field.is_empty() { data } else { data.get(field).filter(|v| !v.is_null()).ok_or("Resposta incompatível com esta versão da integração")? };
        serde_json::from_value(value.clone()).map_err(|_| "Formato de resposta incompatível com a integração Suwayomi".into())
    }
    pub fn connect(&self) -> Result<ConnectionInfo> {
        #[derive(Deserialize)] struct ServerInfo { name:String,version:String }
        #[derive(Deserialize)] struct Sources { nodes:Vec<Source> }
        #[derive(Deserialize)] #[serde(rename_all="camelCase")] struct Data { about_server:ServerInfo,sources:Sources }
        let mut data: Data = self.graphql(CONNECTION_QUERY,json!({}),"")?;
        data.sources.nodes.sort_by(|a,b| a.lang.cmp(&b.lang).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase())));
        Ok(ConnectionInfo { server:self.base.to_string(),name:data.about_server.name,version:data.about_server.version,sources:data.sources.nodes,authenticated:self.authorization.is_some() })
    }
    pub fn source_site(&self,id:&str)->Result<Option<String>>{
        id.parse::<i64>().map_err(|_|"Fonte inválida")?;
        #[derive(Deserialize)]#[serde(rename_all="camelCase")]struct SourceUrl{base_url:Option<String>}
        let source:SourceUrl=self.graphql("query YomiSourceSite($id:LongString!){source(id:$id){baseUrl}}",json!({"id":id}),"source")?;
        Ok(source.base_url)
    }
    pub fn verification_site(&self,source:&str,chapter:Option<i32>)->Result<String>{
        if let Some(id)=chapter{
            if id<0{return Err("Capítulo inválido".into());}
            #[derive(Deserialize)]#[serde(rename_all="camelCase")]struct ChapterUrl{url:String,real_url:Option<String>}
            let chapter:ChapterUrl=self.graphql("query YomiChapterSite($id:Int!){chapter(id:$id){url realUrl}}",json!({"id":id}),"chapter")?;
            let candidate=chapter.real_url.filter(|url|!url.is_empty()).unwrap_or(chapter.url);
            if candidate.trim().is_empty()||candidate.contains(['{','}','"']){return Err("A fonte ainda não disponibilizou o endereço web deste capítulo".into());}
            let url=match Url::parse(&candidate){Ok(url)=>url,Err(_)=>{
                let base=self.source_site(source)?.ok_or("Esta fonte não possui site para verificação")?;
                Url::parse(&base).and_then(|base|base.join(&candidate)).map_err(|_|"Endereço do capítulo inválido")?
            }};
            return crate::source_browser::site_url(url.as_str()).map(|url|url.to_string());
        }
        crate::source_browser::site_url(&self.source_site(source)?.ok_or("Esta fonte não possui site para verificação")?).map(|url|url.to_string())
    }
    pub fn search(&self, source: &str, query: &str, page: u32) -> Result<SearchResults> {
        source.parse::<i64>().map_err(|_| "Identificador de fonte inválido")?;
        if !(1..=500).contains(&page) || query.chars().count()>512 { return Err("Busca ou página fora dos limites permitidos".into()); }
        let results:SearchResults=self.graphql(SEARCH_QUERY,json!({"input":{"source":source,"query":query.trim(),"page":page,"type":if query.trim().is_empty(){"POPULAR"}else{"SEARCH"}}}),"fetchSourceManga")?;
        if results.mangas.len()>200 || results.mangas.iter().any(|manga|manga.id<0){return Err("Catálogo acima do limite ou com identificadores inválidos".into());}
        Ok(results)
    }
    pub fn chapters(&self, manga_id:i32) -> Result<ChapterList> {
        if manga_id<0 { return Err("Identificador de mangá inválido".into()); }
        let mut result:ChapterList=self.graphql(CHAPTERS_QUERY,json!({"input":{"id":manga_id,"fetchManga":true,"fetchChapters":true}}),"fetchMangaAndChapters")?;
        if result.manga.id!=manga_id || result.chapters.len()>10_000 { return Err("Lista de capítulos inválida ou acima do limite".into()); }
        result.chapters.sort_by(|a,b| a.chapter_number.total_cmp(&b.chapter_number).then_with(||natord::compare(&a.name,&b.name)).then_with(||a.id.cmp(&b.id)));
        Ok(result)
    }
    fn page_url(&self, value:&str, manga_id:i32, page:usize) -> Result<Url> {
        let mut url=self.base.join(value).map_err(err)?;
        if value.starts_with("/api/v1/") && self.base.path()!="/" { url=self.base.join(value.trim_start_matches('/')).map_err(err)?; }
        if url.origin()!=self.base.origin() || url.fragment().is_some() || !url.username().is_empty() || url.password().is_some() {
            return Err("O servidor retornou uma página fora da origem permitida".into());
        }
        let path=url.path().strip_prefix(self.base.path()).ok_or("Página fora do caminho configurado do servidor")?;
        let parts:Vec<_>=path.split('/').collect();
        if parts.len()!=8 || parts[0]!="api" || parts[1]!="v1" || parts[2]!="manga" || parts[3]!=manga_id.to_string() || parts[4]!="chapter" || parts[5].parse::<u32>().is_err() || parts[6]!="page" || parts[7]!=page.to_string() || url.query().is_some() {
            return Err("O Suwayomi retornou um endereço de página não suportado".into());
        }
        Ok(url)
    }
    fn download_image(&self,url:Url,target:&Path,limit:u64) -> Result<(PathBuf,u64)> {
        self.download_image_controlled(url,target,limit,None)
    }
    fn download_image_controlled(&self,url:Url,target:&Path,limit:u64,control:Option<&Download>) -> Result<(PathBuf,u64)> {
        if let Some(control)=control {control.check()?;}
        let response=self.request(reqwest::Method::GET,url).send().map_err(|_|"Falha ao obter uma imagem do Suwayomi")?;
        if matches!(response.status().as_u16(),401|403){return Err(crate::auth_sessions::AUTH_REQUIRED.into())}
        if !response.status().is_success() { return Err(format!("Não foi possível obter a imagem (HTTP {})",response.status().as_u16())); }
        if response.content_length().is_some_and(|n|n>limit) { return Err("A imagem excede o limite permitido".into()); }
        let mut bytes=Vec::new();let mut response=response.take(limit+1);let mut chunk=[0;65536];
        loop {if let Some(control)=control {control.check()?;}let count=response.read(&mut chunk).map_err(err)?;if count==0{break;}bytes.extend_from_slice(&chunk[..count]);}
        if let Some(control)=control {control.check()?;}
        if bytes.len() as u64>limit { return Err("A imagem excede o limite permitido".into()); }
        let extension=if bytes.starts_with(b"\x89PNG\r\n\x1a\n"){"png"}else if bytes.starts_with(b"\xff\xd8\xff"){"jpg"}else if bytes.starts_with(b"GIF87a")||bytes.starts_with(b"GIF89a"){"gif"}else if bytes.starts_with(b"RIFF")&&bytes.get(8..12)==Some(b"WEBP"){"webp"}else if bytes.starts_with(b"BM"){"bmp"}else if bytes.get(4..8)==Some(b"ftyp")&&bytes.get(8..32).is_some_and(|b|b.windows(4).any(|v|v==b"avif")){"avif"}else{return Err("O servidor não retornou uma imagem suportada".into());};
        let destination=target.with_extension(extension);
        let temporary=target.with_extension(format!("{}.part",Uuid::new_v4()));
        let result=(|| ->Result<()> {let mut file=fs::OpenOptions::new().write(true).create_new(true).open(&temporary).map_err(err)?;file.write_all(&bytes).map_err(err)?;file.sync_all().map_err(err)?;drop(file);fs::rename(&temporary,&destination).map_err(err)})();
        if result.is_err(){let _=fs::remove_file(&temporary);} result?;
        Ok((destination,bytes.len() as u64))
    }
    pub fn cover(&self,library:&Library,manga_id:i32) ->Result<String> {
        if manga_id<0{return Err("Identificador de mangá inválido".into());}
        let key=format!("{:x}",Sha256::digest(self.base.as_str().as_bytes()));
        let directory=library.root.join("library").join("online-covers");fs::create_dir_all(&directory).map_err(err)?;
        let prefix=format!("{}-{manga_id}",&key[..24]);
        for extension in ["png","jpg","webp","gif","bmp","avif"] {
            let path=directory.join(format!("{prefix}.{extension}"));
            if path.metadata().ok().and_then(|m|m.modified().ok()).and_then(|time|time.elapsed().ok()).is_some_and(|age|age<Duration::from_secs(86_400)){return Ok(path.to_string_lossy().to_string());}
        }
        let (path,_)=self.download_image(self.api_url(&format!("api/v1/manga/{manga_id}/thumbnail"))?,&directory.join(prefix),4*1024*1024)?;
        Ok(path.to_string_lossy().to_string())
    }
    #[cfg(test)]
    pub fn download_chapter(&self,library:&Library,manga_id:i32,chapter_id:i32) ->Result<Book> {
        self.download_chapter_controlled(library,manga_id,chapter_id,&Download::default())
    }
    pub fn open_stream(&self,library:&Library,manga_id:i32,chapter_id:i32)->Result<Book>{
        if manga_id<0||chapter_id<0{return Err("Capítulo inválido".into());}
        let _guard=library.mutation.lock().map_err(err)?;
        let source=format!("suwayomi:{}#manga:{manga_id}:chapter:{chapter_id}",self.base);
        if let Some(book)=library.list()?.into_iter().find(|book|book.source==source){return Ok(book);}
        let result:PageList=self.graphql(PAGES_QUERY,json!({"input":{"chapterId":chapter_id}}),"fetchChapterPages")?;
        if result.chapter.id!=chapter_id||result.chapter.manga.id!=manga_id||result.pages.is_empty()||result.pages.len()>MAX_PAGES{return Err("Capítulo sem páginas ou acima do limite".into());}
        let urls=result.pages.iter().enumerate().map(|(i,url)|self.page_url(url,manga_id,i)).collect::<Result<Vec<_>>>()?;
        let id=Uuid::new_v4().to_string();let target=library.root.join("library").join(&id);fs::create_dir(&target).map_err(err)?;
        let attempt=(||->Result<()> {
            let mut conn=library.db()?;let tx=conn.transaction().map_err(err)?;
            let series=short(&result.chapter.manga.title,256);let chapter=short(&result.chapter.name,80);let title=short(&format!("{series} · {chapter}"),512);
            tx.execute("INSERT INTO books(id,title,source,format,page_count,added_at) VALUES(?1,?2,?3,'stream',?4,?5)",params![id,title,source,urls.len(),now()]).map_err(err)?;
            tx.execute("INSERT INTO book_details(book_id,series,chapter) VALUES(?1,?2,?3)",params![id,series,chapter]).map_err(err)?;
            for (i,url) in urls.iter().enumerate(){
                tx.execute("INSERT INTO pages(book_id,position,path) VALUES(?1,?2,?3)",params![id,i,target.join(format!("{i:06}.pending")).to_string_lossy()]).map_err(err)?;
                tx.execute("INSERT INTO stream_pages VALUES(?1,?2,?3,?4,?5,?6)",params![id,i,self.base.as_str(),manga_id,chapter_id,url.as_str()]).map_err(err)?;
            }
            tx.commit().map_err(err)
        })();
        if attempt.is_err(){let _=fs::remove_dir_all(&target);}attempt?;
        library.list()?.into_iter().find(|book|book.id==id).ok_or("Capítulo não encontrado".into())
    }
    // Caller holds the library mutation lock to serialize cache writes and removals.
    pub fn stream_page(&self,library:&Library,id:&str,index:usize)->Result<String>{
        Uuid::parse_str(id).map_err(|_|"Volume inválido")?;
        let conn=library.db()?;
        let (server,manga,url,path):(String,i32,String,String)=conn.query_row("SELECT s.server,s.manga_id,s.url,p.path FROM stream_pages s JOIN pages p ON p.book_id=s.book_id AND p.position=s.position WHERE s.book_id=?1 AND s.position=?2",params![id,index],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).map_err(|_|"Página online não encontrada")?;
        if server!=self.base.as_str(){return Err("Servidor diferente do capítulo".into());}
        let target=library.root.join("library").join(id);
        if Path::new(&path).starts_with(&target)&&Path::new(&path).is_file(){return Ok(path);}
        let total:u64=fs::read_dir(&target).map_err(err)?.filter_map(|e|e.ok()).filter_map(|e|e.metadata().ok()).map(|m|m.len()).sum();
        if total>=MAX_CHAPTER{return Err("Cache do capítulo excedeu 1 GiB".into());}
        let (path,_)=self.download_image(self.page_url(&url,manga,index)?,&target.join(format!("{index:06}")),MAX_IMAGE.min(MAX_CHAPTER-total))?;
        let path=path.to_string_lossy().to_string();
        conn.execute("UPDATE pages SET path=?1 WHERE book_id=?2 AND position=?3",params![path,id,index]).map_err(err)?;
        Ok(path)
    }
    pub fn download_chapter_controlled(&self,library:&Library,manga_id:i32,chapter_id:i32,control:&Download) ->Result<Book> {
        control.check()?;
        if manga_id<0||chapter_id<0{return Err("Identificador de mangá/capítulo inválido".into());}
        let source=format!("suwayomi:{}#manga:{manga_id}:chapter:{chapter_id}",self.base);
        let _guard=library.mutation.lock().map_err(err)?;
        control.check()?;
        crate::download_files::cleanup(library,&source)?;
        if let Some(book)=library.list()?.into_iter().find(|book|book.source==source){
            if book.format=="stream"{
                for index in 0..book.page_count{control.check()?;self.stream_page(library,&book.id,index)?;control.update(index+1,book.page_count,0)?;}
                return control.commit(||{library.db()?.execute("UPDATE books SET format='online' WHERE id=?1",[&book.id]).map_err(err)?;library.open(&book.id).map(|data|data.book)});
            }
            return control.commit(||Ok(book));
        }
        let result:PageList=self.graphql(PAGES_QUERY,json!({"input":{"chapterId":chapter_id}}),"fetchChapterPages").map_err(|error|control.check().err().unwrap_or(error))?;
        control.check()?;
        if result.chapter.id!=chapter_id||result.chapter.manga.id!=manga_id||result.pages.is_empty()||result.pages.len()>MAX_PAGES{return Err("Capítulo sem páginas ou acima do limite de 1.000 páginas".into());}
        let urls=result.pages.iter().enumerate().map(|(index,path)|self.page_url(path,manga_id,index)).collect::<Result<Vec<_>>>()?;
        control.update(0,urls.len(),0)?;
        let id=Uuid::new_v4().to_string();let target=library.root.join("library").join(&id);fs::create_dir(&target).map_err(err)?;
        let attempt=(|| ->Result<Book> {
            let _lease=crate::download_files::lease(&target,&source)?;
            let started=Instant::now();let mut total=0;let mut pages=Vec::new();
            for (index,url) in urls.into_iter().enumerate(){
                control.check()?;
                if started.elapsed()>Duration::from_secs(300){return Err("O capítulo demorou mais de cinco minutos. Tente novamente com o servidor disponível.".into());}
                let limit=MAX_IMAGE.min(MAX_CHAPTER-total);
                if limit==0{return Err("O capítulo excede 1 GiB".into());}
                let (path,size)=self.download_image_controlled(url,&target.join(format!("{index:06}")),limit,Some(control))?;total+=size;pages.push(path);
                control.update(pages.len(),result.pages.len(),total)?;
            }
            let clean = |text: &str, limit| short(&text.chars().filter(|c| !c.is_control()).collect::<String>(), limit);
            let mut series=clean(&result.chapter.manga.title,256);let chapter=clean(&result.chapter.name,80);
            if series.is_empty(){series="Mangá sem título".into();}
            let title=short(&format!("{series} · {chapter}"),512);
            let mut conn=library.db()?;let transaction=conn.transaction().map_err(err)?;let added=now();
            transaction.execute("INSERT INTO books(id,title,source,format,page_count,added_at) VALUES(?1,?2,?3,'online',?4,?5)",params![id,title,source,pages.len(),added]).map_err(err)?;
            for (position,path) in pages.iter().enumerate(){let path=path.to_string_lossy().to_string();transaction.execute("INSERT INTO pages(book_id,position,path) VALUES(?1,?2,?3)",params![id,position,path]).map_err(err)?;}
            transaction.execute("INSERT INTO book_details(book_id,series,chapter) VALUES(?1,?2,?3)",params![id,series,chapter]).map_err(err)?;
            control.commit(||transaction.commit().map_err(err))?;
            Ok(Book{id:id.clone(),title,series,chapter,source,format:"online".into(),cover:pages[0].to_string_lossy().to_string(),page_count:pages.len(),page:0,completed:false,favorite:false,added_at:added,last_read:None})
        })();
        if attempt.is_err(){let _=fs::remove_dir_all(&target);control.check()?;}else{let _=fs::remove_file(target.join(crate::download_files::MARKER));}attempt
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{net::TcpListener, thread};
    fn fixture(responses:Vec<(u16,Vec<u8>)>) -> (Connection,thread::JoinHandle<()>) {
        fixture_with_hook(responses, |_|{})
    }
    fn fixture_with_hook(responses:Vec<(u16,Vec<u8>)>,hook:impl Fn(usize)+Send+'static) -> (Connection,thread::JoinHandle<()>) {
        fixture_with_requests(responses,move|index,_|hook(index))
    }
    fn fixture_with_requests(responses:Vec<(u16,Vec<u8>)>,hook:impl Fn(usize,&[u8])+Send+'static) -> (Connection,thread::JoinHandle<()>) {
        let listener=TcpListener::bind("127.0.0.1:0").unwrap();
        let connection=Connection::new(&format!("http://{}",listener.local_addr().unwrap())).unwrap();
        let thread=thread::spawn(move || {
            for (index,(status,body)) in responses.into_iter().enumerate() {
                let (mut stream,_)=listener.accept().unwrap();stream.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
                let mut received=Vec::new();let mut buffer=[0;4096];
                loop {
                    let n=stream.read(&mut buffer).unwrap();assert!(n>0);received.extend_from_slice(&buffer[..n]);
                    if let Some(end)=received.windows(4).position(|part|part==b"\r\n\r\n") {
                        let header=String::from_utf8_lossy(&received[..end]);let length=header.lines().find_map(|line|line.to_lowercase().strip_prefix("content-length:").and_then(|v|v.trim().parse::<usize>().ok())).unwrap_or(0);
                        if received.len()>=end+4+length {break;}
                    }
                }
                hook(index,&received);
                write!(stream,"HTTP/1.1 {status} Test\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",body.len()).unwrap();stream.write_all(&body).unwrap();
            }
        });(connection,thread)
    }
    fn pages_response() -> Vec<u8> {serde_json::to_vec(&json!({"data":{"fetchChapterPages":{"chapter":{"id":8,"name":"Capítulo 1","manga":{"id":42,"title":"Teste"}},"pages":["/api/v1/manga/42/chapter/0/page/0","/api/v1/manga/42/chapter/0/page/1"]}}})).unwrap()}
    #[test]fn basic_credentials_require_https_outside_loopback_and_are_sensitive(){
        for server in ["http://127.0.0.1:4567","http://[::1]:4567","http://localhost:4567","https://remote.test"]{let connection=Connection::new(server).unwrap();let header=connection.basic_header("test","test").unwrap();assert!(header.is_sensitive());assert!(!format!("{header:?}").contains("dGVzdDp0ZXN0"));}
        for server in ["http://192.168.1.2:4567","http://localhost.example.test"]{assert!(Connection::new(server).unwrap().basic_header("test","test").is_err());}
        let connection=Connection::new("http://127.0.0.1:4567").unwrap();for(user,password)in[("","test"),("a:b","test"),("test",""),("test","line\nbreak")]{assert!(connection.basic_header(user,password).is_err());}
    }
    #[test]fn basic_header_is_used_for_catalog_cover_and_chapter_images(){
        let data=|value:Value|serde_json::to_vec(&json!({"data":value})).unwrap();let png=b"\x89PNG\r\n\x1a\nfixture".to_vec();
        let responses=vec![(200,data(json!({"aboutServer":{"name":"Test","version":"1"},"sources":{"nodes":[{"id":"0","name":"Local","lang":"all"}]}}))),(200,data(json!({"fetchSourceManga":{"hasNextPage":false,"mangas":[{"id":42,"title":"Teste"}]}}))),(200,data(json!({"fetchMangaAndChapters":{"manga":{"id":42,"title":"Teste"},"chapters":[{"id":8,"name":"1","chapterNumber":1}]}}))),(200,png.clone()),(200,pages_response()),(200,png.clone()),(200,png)];
        let(connection,server)=fixture_with_requests(responses,|_,request|{assert!(String::from_utf8_lossy(request).to_lowercase().contains("authorization: basic dgvzddp0zxn0"),"Cabeçalho Basic ausente");});
        let header=connection.basic_header("test","test").unwrap();let connection=connection.authorized(Some(header));
        assert!(connection.connect().unwrap().authenticated);assert_eq!(connection.search("0","",1).unwrap().mangas.len(),1);assert_eq!(connection.chapters(42).unwrap().chapters.len(),1);
        let temp=tempfile::tempdir().unwrap();let library=Library::new(temp.path().to_path_buf()).unwrap();connection.cover(&library,42).unwrap();assert_eq!(connection.download_chapter(&library,42,8).unwrap().page_count,2);server.join().unwrap();
    }
    #[test]fn authenticated_graphql_diagnostics_do_not_echo_server_text(){
        let(connection,server)=fixture(vec![(200,serde_json::to_vec(&json!({"errors":[{"message":"secret sentinel"}]})).unwrap())]);let header=connection.basic_header("test","test").unwrap();let error=connection.authorized(Some(header)).connect().err().unwrap();assert!(!error.contains("secret sentinel"));server.join().unwrap();
    }
    #[test]fn source_site_uses_the_real_long_string_scalar(){
        let(connection,server)=fixture_with_requests(vec![(200,serde_json::to_vec(&json!({"data":{"source":{"baseUrl":"https://source.test/"}}})).unwrap())],|_,bytes|{
            let text=String::from_utf8_lossy(bytes);assert!(text.contains("LongString!"));assert!(text.contains("9223372036854775807"));
        });
        assert_eq!(connection.source_site("9223372036854775807").unwrap().as_deref(),Some("https://source.test/"));server.join().unwrap();
    }
    #[test]fn catalog_categories_and_genres_use_server_filters_instead_of_local_page_filtering(){
        let options=json!({"data":{"source":{"supportsLatest":true,"filters":[{"__typename":"SelectFilter","name":"Ordem","values":["Mais Visualizados","Lançamentos","Última Atualização"]},{"__typename":"GroupFilter","name":"Gêneros","filters":[{"__typename":"TriStateFilter","name":"Ação"}]}]}}});
        let results=json!({"data":{"fetchSourceManga":{"hasNextPage":true,"mangas":[{"id":42,"title":"Obra"}]}}});
        let bodies=std::sync::Arc::new(std::sync::Mutex::new(Vec::<Value>::new()));let captured=bodies.clone();
        let(connection,server)=fixture_with_requests(vec![(200,serde_json::to_vec(&options).unwrap()),(200,serde_json::to_vec(&results).unwrap())],move|_,bytes|{
            let start=bytes.windows(4).position(|v|v==b"\r\n\r\n").unwrap()+4;captured.lock().unwrap().push(serde_json::from_slice(&bytes[start..]).unwrap());
        });
        assert_eq!(crate::source_catalog::fetch(&connection,"9223372036854775807","",3,"latest",Some("1.0:include")).unwrap().mangas[0].id,42);server.join().unwrap();
        let requests=bodies.lock().unwrap();assert!(requests[0]["query"].as_str().unwrap().contains("LongString!"));
        let input=&requests[1]["variables"]["input"];assert_eq!(input["source"],"9223372036854775807");assert_eq!(input["page"],3);assert_eq!(input["type"],"SEARCH");
        assert_eq!(input["filters"],json!([{"position":0,"selectState":2},{"position":1,"groupChange":{"position":0,"triState":"INCLUDE"}}]));
    }
    #[test]fn unfiltered_categories_use_real_popular_and_latest_feeds(){
        let result=serde_json::to_vec(&json!({"data":{"fetchSourceManga":{"hasNextPage":false,"mangas":[]}}})).unwrap();
        let(connection,server)=fixture_with_requests(vec![(200,result.clone()),(200,result)],|index,bytes|{let text=String::from_utf8_lossy(bytes);assert!(text.contains(if index==0{"POPULAR"}else{"LATEST"}));});
        crate::source_catalog::fetch(&connection,"99","",1,"popular",None).unwrap();crate::source_catalog::fetch(&connection,"99","",1,"latest",None).unwrap();server.join().unwrap();
    }
    #[test]fn unsupported_genre_is_rejected_before_requesting_an_unfiltered_catalog(){
        let(connection,server)=fixture(vec![(200,serde_json::to_vec(&json!({"data":{"source":{"supportsLatest":true,"filters":[]}}})).unwrap())]);
        assert!(crate::source_catalog::fetch(&connection,"99","",1,"popular",Some("unknown")).err().unwrap().contains("gênero"));server.join().unwrap();
    }
    #[test]fn verification_prefers_exact_chapter_url_and_resolves_relative_paths(){
        let cases=[("/old",Some("https://source.test/read/258"),"https://source.test/read/258",false),("/read/258",None,"https://source.test/read/258",true)];
        for (url,real,expected,needs_base) in cases{
            let mut responses=vec![(200,serde_json::to_vec(&json!({"data":{"chapter":{"url":url,"realUrl":real}}})).unwrap())];
            if needs_base{responses.push((200,serde_json::to_vec(&json!({"data":{"source":{"baseUrl":"https://source.test/"}}})).unwrap()));}
            let(connection,server)=fixture(responses);assert_eq!(connection.verification_site("99",Some(258)).unwrap(),expected);server.join().unwrap();
        }
        let(connection,server)=fixture(vec![(200,serde_json::to_vec(&json!({"data":{"chapter":{"url":"file:///private","realUrl":null}}})).unwrap())]);assert!(connection.verification_site("99",Some(258)).is_err());server.join().unwrap();
    }
    #[test]fn progressive_reading_fetches_only_requested_pages_and_reuses_cache(){
        let requests=std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));let count=requests.clone();
        let png=b"\x89PNG\r\n\x1a\nfixture".to_vec();
        let(connection,server)=fixture_with_hook(vec![(200,pages_response()),(200,png.clone()),(200,png)],move |_|{count.fetch_add(1,std::sync::atomic::Ordering::SeqCst);});
        let temp=tempfile::tempdir().unwrap();let library=Library::new(temp.path().to_path_buf()).unwrap();
        let book=connection.open_stream(&library,42,8).unwrap();assert_eq!(book.format,"stream");
        assert_eq!(requests.load(std::sync::atomic::Ordering::SeqCst),1);
        let data=library.open(&book.id).unwrap();assert_eq!(data.pages.len(),2);assert!(!Path::new(&data.pages[0]).exists());
        let first=connection.stream_page(&library,&book.id,0).unwrap();assert!(Path::new(&first).is_file());
        assert!(!Path::new(&data.pages[1]).exists());assert_eq!(requests.load(std::sync::atomic::Ordering::SeqCst),2);
        assert_eq!(connection.stream_page(&library,&book.id,0).unwrap(),first);
        assert_eq!(requests.load(std::sync::atomic::Ordering::SeqCst),2);
        library.progress(&book.id,1,true).unwrap();library.bookmark(&book.id,1,true).unwrap();
        let library=Library::new(library.root.clone()).unwrap();assert_eq!(library.open(&book.id).unwrap().book.page,1);
        connection.stream_page(&library,&book.id,1).unwrap();server.join().unwrap();
        assert_eq!(connection.stream_page(&library,&book.id,0).unwrap(),first);
        let offline=connection.download_chapter(&library,42,8).unwrap();assert_eq!(offline.id,book.id);assert_eq!(offline.format,"online");
        assert_eq!(library.open(&book.id).unwrap().bookmarks,vec![1]);assert_eq!(library.list().unwrap().len(),1);
    }
    #[test]fn authenticated_chapter_failure_is_actionable_without_echoing_diagnostics(){
        for (message,expected) in [("Exception while fetching data (/fetchMangaAndChapters) : No chapters found; secret sentinel","não retornou capítulos"),("HTTP error 404; secret sentinel","404"),("HTTP error 403; secret sentinel","recusou o acesso"),("HTTP error 429; secret sentinel","limitou as consultas")]{
            let(connection,server)=fixture(vec![(200,serde_json::to_vec(&json!({"errors":[{"message":message}]})).unwrap())]);
            let header=connection.basic_header("test","test").unwrap();let error=connection.authorized(Some(header)).chapters(42).err().unwrap();
            assert!(error.contains(expected),"{error}");assert!(!error.contains("secret sentinel"));assert!(!error.contains("interface do servidor"));server.join().unwrap();
        }
    }
    #[test]#[ignore="requer Suwayomi real com Basic"]fn real_basic_server_catalog_and_images(){
        let url=std::env::var("YOMI_SUWAYOMI_BASIC_URL").unwrap();let user=std::env::var("YOMI_SUWAYOMI_BASIC_USER").unwrap();let password=std::env::var("YOMI_SUWAYOMI_BASIC_PASSWORD").unwrap();
        assert_eq!(Connection::new(&url).unwrap().connect().err().unwrap(),crate::auth_sessions::AUTH_REQUIRED);
        let connection=Connection::new(&url).unwrap();let header=connection.basic_header(&user,&password).unwrap();let connection=connection.authorized(Some(header));assert!(connection.connect().unwrap().authenticated);
        let manga=connection.search("0","Yomi Test",1).unwrap().mangas.into_iter().find(|manga|manga.title=="Yomi Test").unwrap();let chapters=connection.chapters(manga.id).unwrap();let temp=tempfile::tempdir().unwrap();let library=Library::new(temp.path().to_path_buf()).unwrap();connection.cover(&library,manga.id).unwrap();assert_eq!(connection.download_chapter(&library,manga.id,chapters.chapters[0].id).unwrap().page_count,2);
        let database=fs::read(temp.path().join("yomi.sqlite3")).unwrap();assert!(!database.windows(password.len()).any(|bytes|bytes==password.as_bytes()));
    }
    #[test] fn cancellation_after_first_page_cleans_files_and_preserves_database() {
        let control=std::sync::Arc::new(Download::default());let signal=control.clone();
        let png=b"\x89PNG\r\n\x1a\nfixture".to_vec();
        let (connection,server)=fixture_with_hook(vec![(200,pages_response()),(200,png.clone()),(200,png)],move |index|{if index==2 {assert_eq!(signal.snapshot().unwrap().completed,1);signal.cancel().unwrap();}});
        let root=tempfile::tempdir().unwrap();let library=Library::new(root.path().to_path_buf()).unwrap();
        assert_eq!(connection.download_chapter_controlled(&library,42,8,&control).unwrap_err(),crate::downloads::CANCELLED);server.join().unwrap();
        assert!(library.list().unwrap().is_empty());assert_eq!(fs::read_dir(root.path().join("library")).unwrap().count(),0);
        let progress=control.snapshot().unwrap();assert_eq!(progress.completed,1);assert_eq!(progress.total,2);assert!(progress.bytes>0);
    }
    #[test] fn failed_page_rolls_back_files_and_database() {
        let (connection,server)=fixture(vec![(200,pages_response()),(200,b"\x89PNG\r\n\x1a\nfixture".to_vec()),(200,b"<html>not an image</html>".to_vec())]);
        let root=tempfile::tempdir().unwrap();let library=Library::new(root.path().to_path_buf()).unwrap();
        assert!(connection.download_chapter(&library,42,8).is_err());server.join().unwrap();
        assert!(library.list().unwrap().is_empty());assert_eq!(fs::read_dir(root.path().join("library")).unwrap().count(),0);
    }
    #[test] fn cached_chapter_preserves_progress_without_requesting_server() {
        let (connection,server)=fixture(vec![(200,pages_response()),(200,b"\x89PNG\r\n\x1a\nfixture".to_vec()),(200,b"\x89PNG\r\n\x1a\nfixture".to_vec())]);
        let root=tempfile::tempdir().unwrap();let library=Library::new(root.path().to_path_buf()).unwrap();
        let book=connection.download_chapter(&library,42,8).unwrap();server.join().unwrap();library.progress(&book.id,1,true).unwrap();
        let again=connection.download_chapter(&library,42,8).unwrap();assert_eq!(again.id,book.id);assert_eq!(again.page,1);assert!(again.completed);assert_eq!(library.list().unwrap().len(),1);
        let backup_dir=tempfile::tempdir().unwrap();let backup=backup_dir.path().join("reading.json");library.export_reading_backup(&backup).unwrap();assert!(library.preview_reading_restore(&backup).is_ok());
    }
    #[test] fn graphql_errors_and_authentication_failures_are_reported() {
        for (status,body,expected) in [(401,b"Login".to_vec(),crate::auth_sessions::AUTH_REQUIRED),(200,r#"{"errors":[{"message":"Fonte indisponível"}],"data":null}"#.as_bytes().to_vec(),"Fonte indisponível"),(200,b"not JSON".to_vec(),"GraphQL válida")] {
            let (connection,server)=fixture(vec![(status,body)]);let error=connection.connect().err().unwrap();assert!(error.contains(expected),"{error}");server.join().unwrap();
        }
    }
    #[test] fn normalizes_server_and_rejects_credentials_or_unsafe_schemes(){
        assert_eq!(Connection::new("http://localhost:4567/sub").unwrap().base.as_str(),"http://localhost:4567/sub/");
        for value in ["file:///tmp/test","http://user:password@localhost:4567","http://localhost/?token=secret","http://localhost/#bad","not-a-url"]{assert!(Connection::new(value).is_err());}
    }
    #[test] fn pages_are_restricted_to_the_server_and_expected_manga(){
        let connection=Connection::new("http://127.0.0.1:4567/proxy/").unwrap();
        assert_eq!(connection.page_url("/api/v1/manga/2/chapter/0/page/1",2,1).unwrap().as_str(),"http://127.0.0.1:4567/proxy/api/v1/manga/2/chapter/0/page/1");
        for path in ["https://other.test/api/v1/manga/2/chapter/0/page/1","/api/v1/manga/3/chapter/0/page/1","/api/v1/manga/2/chapter/0/page/99","/api/graphql","file:///tmp/image.png"]{assert!(connection.page_url(path,2,1).is_err());}
    }
    #[test] fn source_ids_keep_64_bit_precision(){
        let source:Source=serde_json::from_value(json!({"id":"9223372036854775807","name":"Fonte","lang":"pt-BR"})).unwrap();
        assert_eq!(source.id,"9223372036854775807");
        let local:Source=serde_json::from_value(json!({"id":0,"name":"Local","lang":"all"})).unwrap();assert_eq!(local.id,"0");
    }

    // Opt-in: requires an isolated Suwayomi with a local Yomi Test/Chapter 1 fixture.
    #[test]
    #[ignore = "requer servidor Suwayomi de integração"]
    fn real_server_catalog_download_and_offline_progress() {
        let server=std::env::var("YOMI_SUWAYOMI_TEST_URL").expect("Configure o servidor de teste");
        let connection=Connection::new(&server).unwrap();
        let info=connection.connect().unwrap();
        assert!(info.sources.iter().any(|s|s.id=="0"));
        let results=connection.search("0","Yomi Test",1).unwrap();
        let manga=results.mangas.iter().find(|m|m.title=="Yomi Test").expect("Mangá de teste local");
        let chapters=connection.chapters(manga.id).unwrap();assert!(!chapters.chapters.is_empty());
        let root=tempfile::tempdir().unwrap();let library=Library::new(root.path().to_path_buf()).unwrap();
        let cover=connection.cover(&library,manga.id).unwrap();assert!(Path::new(&cover).is_file());
        let book=connection.download_chapter(&library,manga.id,chapters.chapters[0].id).unwrap();assert_eq!(book.page_count,2);
        library.progress(&book.id,1,true).unwrap();
        let again=connection.download_chapter(&library,manga.id,chapters.chapters[0].id).unwrap();assert_eq!(again.id,book.id);assert!(again.completed);
        let reopened=Library::new(root.path().to_path_buf()).unwrap();let pages=reopened.open(&book.id).unwrap();assert_eq!(pages.book.page,1);assert_eq!(pages.pages.len(),2);
        for page in pages.pages {assert!(fs::read(page).unwrap().starts_with(b"\x89PNG\r\n\x1a\n"));}
    }
}


