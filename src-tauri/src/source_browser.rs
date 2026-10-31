use crate::storage::Result;
use reqwest::{header::HeaderValue, Url};
use std::{io::{Read,Write},net::{TcpListener,TcpStream,Shutdown},sync::{Arc,atomic::{AtomicBool,Ordering}},time::Duration};

pub struct Proxy { pub url:Url, stop:Arc<AtomicBool> }
impl Drop for Proxy {fn drop(&mut self){self.stop.store(true,Ordering::SeqCst);}}
pub fn site_url(value:&str)->Result<Url>{
    let url=Url::parse(value).map_err(|_|"Endereço da fonte inválido")?;
    if !matches!(url.scheme(),"https"|"http")||url.host_str().is_none()||!url.username().is_empty()||url.password().is_some(){return Err("A fonte precisa ter um endereço HTTP/HTTPS sem credenciais".into());}Ok(url)
}
impl Proxy {
    pub fn new(server:&str,header:HeaderValue)->Result<Self>{
        let server=Url::parse(server).map_err(|_|"Motor inválido")?;
        if server.scheme()!="http"||server.host_str()!=Some("127.0.0.1")||server.path()!="/"{return Err("Verificação disponível somente para o motor integrado".into());}
        let port=server.port().ok_or("Porta do motor inválida")?;
        let listener=TcpListener::bind("127.0.0.1:0").map_err(|e|e.to_string())?;listener.set_nonblocking(true).map_err(|e|e.to_string())?;
        let local=listener.local_addr().map_err(|e|e.to_string())?;
        let path=format!("/{}/",uuid::Uuid::new_v4());
        let url=Url::parse(&format!("http://{local}{path}?lang=pt-BR")).map_err(|e|e.to_string())?;
        let stop=Arc::new(AtomicBool::new(false));let stopped=stop.clone();
        std::thread::spawn(move||{
            while !stopped.load(Ordering::SeqCst){
                match listener.accept(){
                    Ok((socket,_))=>{let path=path.clone();let header=header.clone();std::thread::spawn(move||{let _=serve(socket,port,&path,header);});},
                    Err(error) if error.kind()==std::io::ErrorKind::WouldBlock=>std::thread::sleep(Duration::from_millis(50)),
                    Err(_)=>break,
                }
            }
        });
        Ok(Self{url,stop})
    }
}
fn serve(mut socket:TcpStream,port:u16,path:&str,header:HeaderValue)->Result<()>{
    // Accepted sockets inherit the listener's nonblocking mode on Windows.
    socket.set_nonblocking(false).map_err(|e|e.to_string())?;
    socket.set_read_timeout(Some(Duration::from_secs(10))).map_err(|e|e.to_string())?;
    let mut bytes=Vec::new();let mut byte=[0];
    while bytes.len()<16384&&!bytes.ends_with(b"\r\n\r\n"){
        if socket.read(&mut byte).map_err(|e|e.to_string())?==0{return Ok(());}bytes.push(byte[0]);
    }
    let request=String::from_utf8(bytes).map_err(|_|"Solicitação inválida")?;
    let first=request.lines().next().unwrap_or("");let parts=first.split_whitespace().collect::<Vec<_>>();
    if parts.len()!=3||parts[0]!="GET"||parts[1].split('?').next()!=Some(path){socket.write_all(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").map_err(|e|e.to_string())?;return Ok(());}
    let websocket=request.lines().any(|line|line.eq_ignore_ascii_case("upgrade: websocket"));
    if websocket{
        let mut upstream=TcpStream::connect((std::net::Ipv4Addr::LOCALHOST,port)).map_err(|_|"Motor não disponível")?;
        let mut outgoing=format!("GET /api/v1/webview HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nAuthorization: {}\r\nOrigin: http://127.0.0.1:{port}\r\n",header.to_str().map_err(|_|"Sessão inválida")?);
        for line in request.lines().skip(1){if let Some((name,_))=line.split_once(':'){if ["upgrade","connection","sec-websocket-key","sec-websocket-version"].contains(&name.to_ascii_lowercase().as_str()){outgoing.push_str(line);outgoing.push_str("\r\n");}}}
        outgoing.push_str("\r\n");upstream.write_all(outgoing.as_bytes()).map_err(|e|e.to_string())?;
        let mut response=Vec::new();
        while response.len()<16384&&!response.ends_with(b"\r\n\r\n"){
            if upstream.read(&mut byte).map_err(|e|e.to_string())?==0{break;}response.push(byte[0]);
        }
        #[cfg(test)]eprintln!("Browser upstream: {}",String::from_utf8_lossy(&response).lines().next().unwrap_or("empty"));
        socket.write_all(&response).map_err(|e|e.to_string())?;
        if !response.starts_with(b"HTTP/1.1 101"){return Err("A conexão interativa do navegador foi recusada".into());}
        socket.set_read_timeout(None).map_err(|e|e.to_string())?;
        let mut client_read=socket.try_clone().map_err(|e|e.to_string())?;let mut upstream_write=upstream.try_clone().map_err(|e|e.to_string())?;
        let forward=std::thread::spawn(move||{let _result=std::io::copy(&mut client_read,&mut upstream_write);#[cfg(test)]eprintln!("Browser client stream: {_result:?}");let _=upstream_write.shutdown(Shutdown::Both);});
        let _result=std::io::copy(&mut upstream,&mut socket);#[cfg(test)]eprintln!("Browser engine stream: {_result:?}");let _=socket.shutdown(Shutdown::Both);let _=upstream.shutdown(Shutdown::Both);let _=forward.join();
    }else{
        let client=reqwest::blocking::Client::builder().redirect(reqwest::redirect::Policy::none()).timeout(Duration::from_secs(30)).build().map_err(|e|e.to_string())?;
        let response=client.get(format!("http://127.0.0.1:{port}/api/v1/webview?lang=pt-BR")).header(reqwest::header::AUTHORIZATION,header).send().map_err(|_|"Não foi possível abrir o navegador do motor")?;
        if !response.status().is_success(){return Err("O navegador do motor recusou a sessão".into());}
        let mut body=Vec::new();response.take(2*1024*1024+1).read_to_end(&mut body).map_err(|e|e.to_string())?;
        if body.len()>2*1024*1024{return Err("Página de verificação excedeu o limite".into());}
        // CEF prepares asynchronously on its first activation. Reconnect the local
        // viewer if it closes before initialization; never interact with site challenges.
        let html=String::from_utf8(body).map_err(|_|"Página do navegador inválida")?;
        let reconnect=r#"<script>setInterval(()=>{const message=document.getElementById('message')?.textContent||'';const transportError=/Connection Idle Timeout|\[object CloseEvent\]/.test(message);if(document.body.classList.contains('disconnected')||transportError){const n=Number(sessionStorage.getItem('yomi-browser-retries')||0);if(n<24){sessionStorage.setItem('yomi-browser-retries',String(n+1));location.reload();}}},3000);</script>"#;
        // The upstream viewer sends its initial ping before CEF may have finished
        // creating the browser. Repeat only that local handshake until its reply.
        let handshake=r#"<script>(()=>{const NativeSocket=window.WebSocket;window.WebSocket=class extends NativeSocket{constructor(...args){super(...args);let timer;this.addEventListener('open',()=>{timer=setInterval(()=>{if(this.readyState===1)this.send(JSON.stringify({type:'ping'}));},1000);});this.addEventListener('message',()=>clearInterval(timer),{once:true});this.addEventListener('close',()=>clearInterval(timer),{once:true});}};})();</script>"#;
        let body=html.replace("<head>",&format!("<head>{handshake}")).replace("</body>",&format!("{reconnect}</body>")).into_bytes();
        write!(socket,"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n",body.len()).map_err(|e|e.to_string())?;
        socket.write_all(&body).map_err(|e|e.to_string())?;
    }
    Ok(())
}
#[cfg(test)]mod tests{
    use super::*;
    #[test]fn rejects_non_web_sites_and_untrusted_motor_origins(){
        for url in ["file:///x","https://user:secret@site.test/x","javascript:alert(1)"]{assert!(site_url(url).is_err());}
        assert!(site_url("https://site.test/").is_ok());
        for url in ["http://remote.test:80/","https://127.0.0.1:4567/","http://127.0.0.1:4567/sub/"]{assert!(Proxy::new(url,HeaderValue::from_static("Basic test")).is_err());}
    }
    #[test]fn private_route_rejects_requests_without_its_nonce(){
        let proxy=Proxy::new("http://127.0.0.1:9/",HeaderValue::from_static("Basic private")).unwrap();
        let url=format!("http://127.0.0.1:{}/wrong/",proxy.url.port().unwrap());
        assert_eq!(reqwest::blocking::get(url).unwrap().status().as_u16(),403);
    }
    #[test]fn websocket_relay_survives_idle_gap_without_exposing_authentication(){
        let listener=TcpListener::bind("127.0.0.1:0").unwrap();let port=listener.local_addr().unwrap().port();
        let engine=std::thread::spawn(move||{
            let(mut stream,_)=listener.accept().unwrap();stream.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
            let mut bytes=Vec::new();let mut b=[0];while !bytes.ends_with(b"\r\n\r\n"){stream.read_exact(&mut b).unwrap();bytes.push(b[0]);}
            assert!(String::from_utf8(bytes).unwrap().contains("Authorization: Basic private"));
            stream.write_all(b"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n").unwrap();
            for expected in [b"one1",b"two2"]{let mut input=[0;4];stream.read_exact(&mut input).unwrap();assert_eq!(&input,expected);stream.write_all(b"done").unwrap();}
        });
        let proxy=Proxy::new(&format!("http://127.0.0.1:{port}/"),HeaderValue::from_static("Basic private")).unwrap();
        let mut client=TcpStream::connect(("127.0.0.1",proxy.url.port().unwrap())).unwrap();client.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
        write!(client,"GET {} HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n",proxy.url.path()).unwrap();
        let mut head=Vec::new();let mut byte=[0];while !head.ends_with(b"\r\n\r\n"){client.read_exact(&mut byte).unwrap();head.push(byte[0]);}
        assert!(!String::from_utf8(head).unwrap().contains("Basic private"));
        for payload in [b"one1",b"two2"]{client.write_all(payload).unwrap();let mut reply=[0;4];client.read_exact(&mut reply).unwrap();assert_eq!(&reply,b"done");std::thread::sleep(Duration::from_millis(150));}
        drop(client);engine.join().unwrap();
    }
}
