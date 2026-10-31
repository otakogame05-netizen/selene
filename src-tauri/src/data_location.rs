use std::{ffi::OsString,path::PathBuf};
pub fn resolve(args:impl IntoIterator<Item=OsString>,default:PathBuf)->Result<PathBuf,String>{
    let mut args=args.into_iter();let mut chosen=None;
    while let Some(arg)=args.next(){if arg=="--data-dir"{if chosen.is_some(){return Err("Informe --data-dir apenas uma vez".into())}let value=args.next().ok_or("Informe a pasta após --data-dir")?;let path=PathBuf::from(value);if !path.is_absolute()||path.components().any(|p|matches!(p,std::path::Component::ParentDir)){return Err("Use uma pasta de dados absoluta, sem ..".into())}chosen=Some(path);}}
    Ok(chosen.unwrap_or(default))
}
#[cfg(test)]mod tests{use super::*;
 #[test]fn default_and_explicit_location(){let default=std::env::temp_dir().join("default-yomi");assert_eq!(resolve(Vec::<OsString>::new(),default.clone()).unwrap(),default);let explicit=std::env::temp_dir().join("portable-yomi");assert_eq!(resolve(vec!["--data-dir".into(),explicit.clone().into_os_string()],default).unwrap(),explicit);}
 #[test]fn invalid_arguments_do_not_silently_fall_back(){let default=std::env::temp_dir();assert!(resolve(vec!["--data-dir".into()],default.clone()).is_err());assert!(resolve(vec!["--data-dir".into(),"relative".into()],default.clone()).is_err());let absolute=default.clone().into_os_string();assert!(resolve(vec!["--data-dir".into(),absolute.clone(),"--data-dir".into(),absolute],default).is_err());}
}
