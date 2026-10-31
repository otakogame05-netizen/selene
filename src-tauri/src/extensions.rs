use crate::{storage::Result, suwayomi::Connection};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Extension { pub pkg_name:String, pub name:String, pub lang:String, pub version_name:String, pub is_installed:bool, pub has_update:bool, pub is_obsolete:bool }
#[derive(Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Store { pub name:String, pub index_url:String }
#[derive(Serialize, Deserialize)]
pub struct Catalog { pub extensions:Vec<Extension>, pub stores:Vec<Store> }
const FIELDS:&str="pkgName name lang versionName isInstalled hasUpdate isObsolete";

pub fn catalog(connection:Connection, refresh:bool)->Result<Catalog>{
    if refresh {
        #[derive(Deserialize)] #[serde(rename_all="camelCase")] struct Data { extensions:Vec<Extension>,extension_stores:Vec<Store> }
        let data:Data=connection.graphql(&format!("mutation {{ fetchExtensions(input:{{}}) {{ extensions {{ {FIELDS} }} extensionStores {{ name indexUrl }} }} }}"),json!({}),"fetchExtensions")?;
        Ok(Catalog{extensions:data.extensions,stores:data.extension_stores})
    } else {
        #[derive(Deserialize)] struct Nodes<T>{nodes:Vec<T>}
        #[derive(Deserialize)] #[serde(rename_all="camelCase")] struct Data {extensions:Nodes<Extension>,extension_stores:Nodes<Store>}
        let data:Data=connection.graphql(&format!("query {{ extensions {{ nodes {{ {FIELDS} }} }} extensionStores {{ nodes {{ name indexUrl }} }} }}"),json!({}),"")?;
        Ok(Catalog{extensions:data.extensions.nodes,stores:data.extension_stores.nodes})
    }
}
fn store_url(value:&str)->Result<String>{
    let url=reqwest::Url::parse(value.trim()).map_err(|_|"Informe o endereço HTTPS do índice do repositório")?;
    if value.len()>2048 || url.scheme()!="https" || url.host_str().is_none() || !url.username().is_empty() || url.password().is_some() || url.fragment().is_some(){return Err("Use um índice HTTPS sem usuário, senha ou fragmento".into());}
    Ok(url.to_string())
}
pub fn store(connection:Connection,url:&str,remove:bool)->Result<()>{
    let url=store_url(url)?;
    let (operation,input)=if remove {("removeExtensionStore","RemoveExtensionStoreInput!")}else{("addExtensionStore","AddExtensionStoreInput!")};
    let _:serde_json::Value=connection.graphql(&format!("mutation($input:{input}){{ {operation}(input:$input){{ clientMutationId }} }}"),json!({"input":{"indexUrl":url}}),operation)?;
    Ok(())
}
pub fn change(connection:Connection,id:&str,action:&str)->Result<()>{
    if id.is_empty() || id.len()>255 || !id.bytes().all(|c|c.is_ascii_alphanumeric()||b"._-".contains(&c)){return Err("Identificador de extensão inválido".into());}
    if !["install","update","uninstall"].contains(&action){return Err("Ação de extensão inválida".into());}
    let patch=match action{"install"=>json!({"install":true}),"update"=>json!({"update":true}),_=>json!({"uninstall":true})};
    #[derive(Deserialize)] struct Payload{extension:Option<Extension>}
    let result:Payload=connection.graphql(&format!("mutation($input:UpdateExtensionInput!){{updateExtension(input:$input){{extension{{{FIELDS}}}}}}}"),json!({"input":{"id":id,"patch":patch}}),"updateExtension")?;
    let item=result.extension.ok_or("Extensão não encontrada. Atualize o catálogo.")?;
    if item.pkg_name!=id || (action=="uninstall" && item.is_installed) || (action!="uninstall" && !item.is_installed) || (action=="update" && item.has_update){return Err("O motor não confirmou a alteração da extensão. Atualize o catálogo e tente novamente.".into());}
    Ok(())
}
#[cfg(test)] mod tests {
    use super::*;
    #[test] fn repository_addresses_are_validated(){
        for url in ["http://example.test/index.json","file:///x","https://name:secret@example.test/x","https://example.test/x#fragment"]{assert!(store_url(url).is_err());}
        assert_eq!(store_url(" https://example.test/index.min.json ").unwrap(),"https://example.test/index.min.json");
    }
}
