import { invoke } from '@tauri-apps/api/core';
import type { Book } from '../domain';
export interface Source { id: string; name: string; lang: string }
export interface Manga { id: number; title: string; description?: string | null }
export interface Chapter { id: number; name: string; chapterNumber: number }
export interface Connection { server: string; name: string; version: string; sources: Source[]; authenticated?:boolean }
export const AUTH_REQUIRED='Autenticação necessária no Suwayomi. Entre novamente em Fontes online.';
export interface Results { hasNextPage: boolean; mangas: Manga[] }
export type CatalogKind='popular'|'latest'|'newest';
export interface CatalogOptions {supportsLatest:boolean;supportsNewest:boolean;filterPopular:boolean;filterLatest:boolean;filterNewest:boolean;genres:{id:string;name:string}[]}
export interface Chapters { manga: Manga; chapters: Chapter[] }
export interface SiteReading { id:string;title:string;chapter:string;url:string;cover:string;lastRead:number }
export interface SiteMetadata {title:string;chapter:string;mangaId:number}
export interface OnlineFavoriteInput {server:string;sourceId:string;sourceName:string;lang:string;mangaId:number;title:string}
export interface OnlineFavorite extends OnlineFavoriteInput {id:string;cover:string;integrated:boolean}
export interface DownloadProgress { completed: number; total: number; bytes: number; cancelled: boolean; finished: boolean }
export interface Extension { pkgName:string; name:string; lang:string; versionName:string; isInstalled:boolean; hasUpdate:boolean; isObsolete:boolean }
export interface ExtensionCatalog { extensions:Extension[]; stores:{name:string;indexUrl:string}[] }
export const chapterSource = (server: string, mangaId: number, chapterId: number) => `suwayomi:${server}#manga:${mangaId}:chapter:${chapterId}`;
export const suwayomi = {
  onlineFavorites: () => invoke<OnlineFavorite[]>('list_online_favorites'),
  favoriteOnline: (input:OnlineFavoriteInput,enabled:boolean) => invoke<void>('set_online_favorite',{input,enabled}),
  siteHistory: () => invoke<SiteReading[]>('list_site_readings'),
  removeSiteReading: (id:string) => invoke<void>('remove_site_reading',{id}),
  resumeSite: (id:string) => invoke<void>('resume_site_reading',{id}),
  layoutSite: (comfortable:boolean,zoom:number,hidden=false) => invoke<void>('set_site_layout',{comfortable,zoom,hidden}),
  closeSite: () => invoke<void>('close_source_site'),
  readSite: (server:string,source:string,chapterId?:number,metadata?:SiteMetadata) => invoke<void>('open_source_site',{server,source,chapterId:chapterId??null,metadata:metadata??null}),
  verifySource: (server:string,source:string,chapterId?:number) => invoke<void>('open_source_browser',{server,source,chapterId:chapterId??null}),
  openOnline: (server:string,mangaId:number,chapterId:number) => invoke<Book>('open_online_chapter',{server,mangaId,chapterId}),
  page: (id:string,index:number) => invoke<string>('online_page',{id,index}),
  startIntegrated: () => invoke<Connection>('start_integrated_engine'),
  extensions: (server:string,refresh=false) => invoke<ExtensionCatalog>('extension_catalog',{server,refresh}),
  store: (server:string,url:string,remove=false) => invoke<void>('extension_store',{server,url,remove}),
  changeExtension: (server:string,id:string,action:'install'|'update'|'uninstall') => invoke<void>('extension_change',{server,id,action}),
  connect: (server: string) => invoke<Connection>('suwayomi_connect', { server }),
  login: (server:string,username:string,password:string) => invoke<Connection>('suwayomi_login',{server,username,password}),
  logout: (server?:string) => invoke<void>('suwayomi_logout',{server:server??null}),
  session: (server:string) => invoke<boolean>('suwayomi_session',{server}),
  catalogOptions: (server:string,source:string) => invoke<CatalogOptions>('suwayomi_catalog_options',{server,source}),
  search: (server: string, source: string, query: string, page: number,kind?:CatalogKind,genre?:string) => invoke<Results>('suwayomi_search', { server, source, query, page,kind:kind??null,genre:genre||null }),
  chapters: (server: string, mangaId: number) => invoke<Chapters>('suwayomi_chapters', { server, mangaId }),
  cover: (server: string, mangaId: number) => invoke<string>('suwayomi_cover', { server, mangaId }),
  prepare: () => invoke<string>('prepare_download'),
  progress: (jobId: string) => invoke<DownloadProgress>('download_progress', { jobId }),
  cancel: (jobId: string) => invoke<boolean>('cancel_download', { jobId }),
  download: (server: string, mangaId: number, chapterId: number, jobId: string) => invoke<Book>('suwayomi_download', { server, mangaId, chapterId, jobId }),
};
