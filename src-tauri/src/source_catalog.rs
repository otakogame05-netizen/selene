use crate::{storage::Result,suwayomi::{Connection,SearchResults}};
use serde::Serialize;
use serde_json::{json,Value};

const LEAF:&str="__typename ... on SelectFilter{name values} ... on SortFilter{name values} ... on TriStateFilter{name} ... on CheckBoxFilter{name} ... on HeaderFilter{name} ... on SeparatorFilter{name}";
#[derive(Clone,Serialize)]pub struct Genre{pub id:String,pub name:String,#[serde(skip)]change:Value}
#[derive(Serialize)]#[serde(rename_all="camelCase")]
pub struct Options{pub supports_latest:bool,pub supports_newest:bool,pub filter_popular:bool,pub filter_latest:bool,pub filter_newest:bool,pub genres:Vec<Genre>,#[serde(skip)]popular:Option<Value>,#[serde(skip)]latest:Option<Value>,#[serde(skip)]newest:Option<Value>,#[serde(skip)]direction:Option<Value>}
fn key(value:&str)->String{value.to_lowercase().chars().map(|c|match c{'á'|'à'|'â'|'ã'|'ä'=>'a','é'|'ê'|'è'=>'e','í'|'ì'=>'i','ó'|'ô'|'õ'|'ò'=>'o','ú'|'ü'|'ù'=>'u','ç'=>'c',v=>v}).collect()}
fn has(value:&str,parts:&[&str])->bool{parts.iter().any(|p|value.contains(p))}
fn change(path:&[usize],field:&str,state:Value)->Value{
    let mut value=json!({"position":*path.last().unwrap()});value[field]=state;
    for position in path.iter().rev().skip(1){value=json!({"position":position,"groupChange":value});}value
}
fn scan(filters:&[Value],parent:&[usize],in_genres:bool,out:&mut Options){
    if parent.len()>=3{return;}
    for(index,filter)in filters.iter().take(500).enumerate(){
        let mut path=parent.to_vec();path.push(index);
        let name=filter["name"].as_str().unwrap_or("");let normalized=key(name);let genre_group=in_genres||has(&normalized,&["genero","genre"]);
        let values=filter["values"].as_array();let kind=filter["__typename"].as_str().unwrap_or("");
        if kind=="GroupFilter"{if let Some(children)=filter["filters"].as_array(){scan(children,&path,genre_group,out);}continue;}
        if genre_group{
            match kind{
                "TriStateFilter"|"CheckBoxFilter"=>{if out.genres.len()<500{out.genres.push(Genre{id:format!("{}:include",path.iter().map(usize::to_string).collect::<Vec<_>>().join(".")),name:name.into(),change:change(&path,if kind=="TriStateFilter"{"triState"}else{"checkBoxState"},if kind=="TriStateFilter"{json!("INCLUDE")}else{json!(true)})});}},
                "SelectFilter"=>{if let Some(values)=values{for (index,label) in values.iter().enumerate(){let label=label.as_str().unwrap_or("");if label.trim().is_empty()||has(&key(label),&["todos","all genre","any genre","selecion","select genre"]){continue;}if out.genres.len()<500{out.genres.push(Genre{id:format!("{}:{index}",path.iter().map(usize::to_string).collect::<Vec<_>>().join(".")),name:label.into(),change:change(&path,"selectState",json!(index))});}}}},_=>{}
            }continue;
        }
        if !matches!(kind,"SelectFilter"|"SortFilter"){continue;}
        if let Some(values)=values{
            for(index,label)in values.iter().enumerate(){let label=key(label.as_str().unwrap_or(""));
                let ordering=has(&normalized,&["ordem","order","sort","orden","classific"]);
                let selected=if kind=="SortFilter"{change(&path,"sortState",json!({"index":index,"ascending":false}))}else{change(&path,"selectState",json!(index))};
                if ordering||kind=="SortFilter"{
                    if out.popular.is_none()&&has(&label,&["popular","visualiza","most viewed","follow","seguidores","mais vistos","em alta"]){out.popular=Some(selected.clone());}
                    if out.latest.is_none()&&has(&label,&["ultima atualiz","latest upload","latest chapter","recently updated","updated","data de atualiz","ultimo capitulo","capitulo enviado","chapter upload"]){out.latest=Some(selected.clone());}
                    if out.newest.is_none()&&has(&label,&["lancamento","recently added","created","criacao","data de adicao","newly added","novas obras","newest","new titles"]){out.newest=Some(selected);}
                }
                if kind=="SelectFilter"&&has(&normalized,&["direcao","direction","order"])&&has(&label,&["decrescente","descending","desc"]){out.direction=Some(change(&path,"selectState",json!(index)));}
            }
        }
    }
}
pub fn options(connection:&Connection,source:&str)->Result<Options>{
    source.parse::<i64>().map_err(|_|"Fonte inválida")?;
    let query=["query SeleneCatalogOptions($id:LongString!){source(id:$id){supportsLatest filters{",LEAF," ... on GroupFilter{name filters{",LEAF," ... on GroupFilter{name filters{",LEAF,"}}}}}}}"].concat();
    let value:Value=connection.graphql(&query,json!({"id":source}),"source")?;
    let supports_latest=value["supportsLatest"].as_bool().ok_or("A fonte não retornou as opções de catálogo")?;
    let filters=value["filters"].as_array().ok_or("A fonte não retornou seus filtros")?;
    let mut result=Options{supports_latest,supports_newest:false,filter_popular:false,filter_latest:false,filter_newest:false,genres:Vec::new(),popular:None,latest:None,newest:None,direction:None};
    scan(filters,&[],false,&mut result);result.supports_newest=result.newest.is_some();result.filter_popular=result.popular.is_some();result.filter_latest=result.latest.is_some();result.filter_newest=result.newest.is_some();
    result.genres.sort_by_key(|g|key(&g.name));Ok(result)
}
pub fn fetch(connection:&Connection,source:&str,query:&str,page:u32,kind:&str,genre:Option<&str>)->Result<SearchResults>{
    source.parse::<i64>().map_err(|_|"Fonte inválida")?;
    if !(1..=500).contains(&page)||query.chars().count()>512{return Err("Busca ou página fora dos limites permitidos".into());}
    if !matches!(kind,"popular"|"latest"|"newest"){return Err("Categoria de catálogo inválida".into());}
    let genre=genre.filter(|v|!v.is_empty());let query=query.trim();let mut filters=Vec::new();
    let request_type=if genre.is_none()&&query.is_empty()&&kind!="newest"{if kind=="latest"{"LATEST"}else{"POPULAR"}}else{
        if genre.is_some()||kind!="popular"{
            let available=options(connection,source)?;
            let order=match kind{"latest"=>available.latest.as_ref(),"newest"=>available.newest.as_ref(),_=>available.popular.as_ref()};
            if kind!="popular"&&order.is_none(){return Err("Esta fonte não oferece essa ordenação combinada com pesquisa ou gênero".into());}
            if let Some(order)=order{filters.push(order.clone());if let Some(direction)=available.direction.as_ref(){filters.push(direction.clone());}}
            if let Some(id)=genre{let selected=available.genres.iter().find(|g|g.id==id).ok_or("O gênero escolhido não está disponível nesta fonte")?;filters.push(selected.change.clone());}
        }"SEARCH"
    };
    let result:SearchResults=connection.graphql("mutation YomiSearch($input: FetchSourceMangaInput!) { fetchSourceManga(input: $input) { hasNextPage mangas { id title } } }",json!({"input":{"source":source,"query":query,"page":page,"type":request_type,"filters":filters}}),"fetchSourceManga")?;
    if result.mangas.len()>200||result.mangas.iter().any(|m|m.id<0){return Err("Catálogo acima do limite ou com identificadores inválidos".into());}Ok(result)
}
#[cfg(test)]mod tests{
    use super::*;
    #[test]fn real_filter_shapes_preserve_nested_positions_and_source_ordering(){
        let mut options=Options{supports_latest:true,supports_newest:false,filter_popular:false,filter_latest:false,filter_newest:false,genres:Vec::new(),popular:None,latest:None,newest:None,direction:None};
        scan(&[json!({"__typename":"SelectFilter","name":"Ordem","values":["Mais Visualizados","Lançamentos","Última Atualização"]}),json!({"__typename":"GroupFilter","name":"Gêneros","filters":[{"__typename":"TriStateFilter","name":"Ação"},{"__typename":"CheckBoxFilter","name":"Fantasia"}]})],&[],false,&mut options);
        assert_eq!(options.latest,Some(json!({"position":0,"selectState":2})));assert_eq!(options.newest,Some(json!({"position":0,"selectState":1})));
        assert_eq!(options.genres[0].change,json!({"position":1,"groupChange":{"position":0,"triState":"INCLUDE"}}));
        assert_eq!(options.genres[1].change,json!({"position":1,"groupChange":{"position":1,"checkBoxState":true}}));
    }
}
