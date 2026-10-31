# Fontes integradas no Yomi 0.12

A edição completa Windows inclui o Suwayomi Server 2.4.2366 e seu Java portátil. Você instala e abre apenas o Yomi. Não precisa instalar Java ou iniciar um servidor separadamente.

A partir de 0.11, você também pode pesquisar por **Biblioteca → Catálogos das fontes**, sem abrir as configurações de extensões. Guia: [CATALOGOS.md](./CATALOGOS.md).

## Usar

1. Instale a edição completa 0.12, feche versões antigas e abra o Yomi.
2. Entre em **Fontes online → Ativar fontes integradas**. O Yomi inicia o motor em segundo plano. Essa escolha fica salva. Ao voltar a Fontes online, o motor inicia e conecta automaticamente; ele não inicia com o Windows.
3. Em **Extensões**, informe o endereço HTTPS do índice do repositório que você escolheu e clique em **Adicionar repositório**. O Yomi não fornece repositórios ou sites predefinidos.
4. Pesquise a extensão desejada e clique em **Instalar extensão**. Confira o nome e confirme. Instale apenas extensões de sua confiança: elas executam código e acessam a internet no motor.
5. Após instalar, as fontes são recarregadas. Escolha uma fonte, pesquise um mangá e abra seus capítulos.
6. **Ler online** abre a lista de páginas e busca as imagens conforme você lê. **Baixar e ler** continua disponível para guardar o capítulo inteiro. Não precisa exportar CBZ nem importar manualmente.

**Atualizar catálogo** consulta os repositórios. **Atualizar extensão** aparece quando há uma versão nova. Desinstalar uma extensão preserva os capítulos já copiados para a biblioteca do Yomi. Remover um repositório não é o mesmo que desinstalar suas extensões.

## O que mudou

- O motor e o Java acompanham o instalador, que por isso ficou maior.
- Um botão inicia e conecta o motor sem solicitar senha ao usuário.
- O motor atende apenas em 127.0.0.1, com autenticação interna gerada para o processo. A porta é reservada na pasta de dados e reaproveitada ao reiniciar para preservar os endereços dos capítulos e filas.
- O processo iniciado pelo Yomi é encerrado junto com ele. Um Job Object do Windows também vincula sua vida ao processo do aplicativo em caso de encerramento forçado.
- Não há serviço do Windows, janela separada ou Java global instalado pelo Yomi.

## Limites atuais

A leitura online progressiva está disponível nos quatro modos. As páginas carregadas ficam em cache persistente; as restantes precisam de conexão. A biblioteca identifica esses volumes como ONLINE · CACHE PARCIAL. Baixar e ler completa o mesmo volume, sem duplicar páginas ou perder progresso. O cache tem limite de 1 GiB por capítulo. Preferências específicas de cada fonte e filtros avançados ainda não têm interface dedicada. Use Verificar acesso à fonte para abrir a navegação manual com sessão compartilhada. O navegador adicional é baixado na primeira ativação; a aceitação de verificações e login depende do site. Veja [VERIFICACAO-FONTES.md](./VERIFICACAO-FONTES.md).

O gerenciador usa a API real do Suwayomi. Compatibilidade de cada repositório, extensão e site depende do provedor; o Yomi não converte qualquer APK Android em uma extensão compatível. Extensões não são plugins próprios de tradução ou OCR.

**Conexão avançada** mantém o suporte a um Suwayomi externo e é opcional. O repositório, as extensões instaladas e a última fonte escolhida são preservados entre aberturas. Não é preciso colar o índice novamente. Configurações de um servidor externo anterior não são migradas automaticamente. Filas de um servidor externo continuam apontando para esse servidor.

O motor mantém seus dados na subpasta `engine` da pasta de dados do Yomi; o banco dele é separado do SQLite da biblioteca. O backup JSON de leitura não inclui esse motor, suas extensões, repositórios ou imagens. Diagnóstico de inicialização: `engine/engine.log`. Os sockets temporários do Java usam `%USERPROFILE%/.yomi-sock` para evitar caminhos longos do Windows. Não remova os arquivos de dados enquanto o programa estiver aberto.

## Recompilar

Prepare os recursos a partir da edição portátil oficial:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Preparar-Motor.ps1 -RuntimePath "CAMINHO DA EDICAO PORTATIL"
pnpm run desktop:build
```

`src-tauri/resources/suwayomi` contém binários locais ignorados pelo controle de versão. O pacote preserva as licenças do Java e inclui os avisos, licença e endereços de código-fonte do Suwayomi. Distribuição de origem: [Suwayomi 2.4.2366](https://github.com/Suwayomi/Suwayomi-Server/releases/tag/v2.4.2366).
