// Contracts for future providers; Suwayomi uses its dedicated native client.
export interface CatalogEntry { id: string; title: string; coverUrl?: string }
export interface CatalogProvider { readonly id: string; search(query: string, signal?: AbortSignal): Promise<CatalogEntry[]> }
export interface TranslationRequest { text: string; targetLanguage: string }
export interface TranslationProvider { readonly id: string; translate(request: TranslationRequest, signal?: AbortSignal): Promise<string> }
export interface PluginManifest { id: string; name: string; version: string; permissions: ('catalog' | 'translation')[] }
export const integrationStatus = [
  { name: 'Suwayomi', state: 'Disponível', detail: 'Motor e Java incluídos na edição completa Windows. Início pelo Yomi, repositórios e instalação/atualização/remoção de extensões. Leitura por páginas, cache persistente, fonte lembrada e conexão automática ao motor após ativação. Cookies/JWT externos pendentes.' },
  { name: 'Plugins', state: 'Planejado', detail: 'Contratos de extensão definidos. Instalação e execução ainda indisponíveis.' },
  { name: 'Tradução opcional', state: 'Planejado', detail: 'Idioma de destino configurável. OCR e provedores de tradução ainda não integrados.' },
  { name: 'PDF', state: 'Disponível no Windows', detail: 'Importação de um PDF sem senha por vez. Páginas convertidas localmente em PNG, até 1.000 páginas e 2.000 pixels no lado maior. Sem seleção de texto ou OCR.' },
];


