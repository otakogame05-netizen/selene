# Selene · Leitor de mangás para Windows

Leitor híbrido de mangás em **Tauri 2, React, TypeScript, Rust e SQLite**. Interface em português, sem imagens geradas e motor Suwayomi incluído na edição completa Windows. A identidade visual usa vermelho escarlate, preto e dourado, com uma lua carmesim.

Guia de instalação, prioridades e sugestões: [PROXIMOS-PASSOS.md](./PROXIMOS-PASSOS.md). Verificação local dos requisitos: `pnpm run doctor`.

## Estado real da entrega

**O aplicativo Windows e o instalador NSIS 0.20.0 foram compilados localmente.** Este repositório contém o código-fonte; os instaladores não são incluídos no histórico Git. As versões para download serão disponibilizadas em [Releases](https://github.com/otakogame05-netizen/selene/releases). A detecção de atualizações dentro do aplicativo ainda não foi implementada. O assistente do instalador e o roteiro manual completo ainda não foram validados automaticamente. Veja [VALIDACAO.md](./VALIDACAO.md).

O histórico acessível da conversa anterior continha referências opacas, sem o texto integral do planejamento. Por isso, esta implementação segue o escopo explícito da solicitação atual. Guardião foi interpretado como lembretes de pausa; outras funções precisam de especificação.

## Implementado no código

- **0.17.0 — Capítulos e histórico:** busca por número exato, ordem crescente/decrescente lembrada, cartões online no formato de Últimas leituras e lixeira individual que remove somente o registro.
- **0.16.0 — Categorias e gêneros:** Populares e Atualizados usam as listas da fonte; Novas obras usa a ordenação de lançamentos quando disponível. Filtro por gênero extraído dos filtros reais da extensão e aplicado no servidor, com paginação. A extensão atual da ToonLivre não expõe gêneros; fontes sem suporte exibem essa limitação.

- **0.15.0 — Catálogo como início:** seleção compacta de fonte junto à pesquisa, ações recolhidas e Meus mangás como aba secundária. Coração nas capas e nos detalhes salva favoritos online por fonte; Favoritos reabre a lista de capítulos do mangá. Persistência SQLite sem download obrigatório.

- **0.14.0 — Selene:** novo nome, ícone vetorial de lua carmesim, paleta escarlate/preto/dourado, executável Selene.exe e instalador Selene. Identificação de dados mantida para acessar a biblioteca e o histórico existentes.

- **0.13.0 — Histórico online e conforto:** capítulos abertos na ToonLivre aparecem em Lidos recentemente, com reabertura pelo endereço salvo. Leitura integrada com largura confortável centralizada ou toda a tela e zoom persistente de 70% a 160%. Consulte [HISTORICO-ONLINE.md](./HISTORICO-ONLINE.md).

- **0.12.5 — Retorno ao catálogo:** a área da fonte é ocultada e reutilizada; tamanho, visibilidade e foco do catálogo são restaurados explicitamente para evitar a tela vazia após voltar.

- **0.12.4 — Leitura integrada:** Ler online da ToonLivre abre o capítulo dentro da janela principal, com Voltar ao catálogo preservando a seleção. A confirmação do site é manual e não transfere páginas ao leitor local.

- **0.12.3 — Ler no site:** navegação direta em WebView2, dentro do Yomi, para fontes que abrem no navegador e falham no motor. Sessão e leitura separadas da extensão; os modos e o progresso do leitor local não se aplicam. Consulte [LEITURA-NO-SITE.md](./LEITURA-NO-SITE.md).

- **Correção 0.12.2:** Verificar capítulo abre a página específica do capítulo, usando realUrl ou resolvendo o caminho contra a fonte. A janela existente é redirecionada para o novo capítulo; a verificação continua manual.

- **Correção 0.12.1:** consulta do endereço da fonte usa o tipo LongString exigido pelo motor. A versão 0.12.0 testava o navegador separadamente, mas a consulta incorreta impedia abrir a verificação pelo botão.

- **Novo na versão 0.12:** janela manual de verificação de fontes usando o navegador oficial do motor, com sessão compartilhada. Componente adicional baixado na primeira ativação. Não resolve desafios automaticamente nem garante aceitação dos sites. Guia: [VERIFICACAO-FONTES.md](./VERIFICACAO-FONTES.md).

- **Novo na versão 0.11:** Biblioteca com Meus mangás e Catálogos das fontes, seleção por fonte/idioma, carregamento automático de populares, pesquisa mantida ao trocar de fonte, paginação e acesso aos capítulos. Guia: [CATALOGOS.md](./CATALOGOS.md).

- **Novo na versão 0.10:** Ler online busca páginas por demanda nos quatro modos, mantém cache e progresso, e permite completar o mesmo volume para uso offline. Última fonte e ativação do motor são salvas; Fontes online reconecta automaticamente após ativação inicial. Repositórios e extensões instaladas são preservados.

- **Correção 0.9.1:** mensagens específicas para capítulos não retornados pela fonte, página 404, bloqueio e limite de consultas, mantendo dados de autenticação fora dos erros.

- **Novo na versão 0.9:** motor Suwayomi e Java portátil no instalador, início pelo Yomi e gerenciamento de repositórios/extensões. Não requer instalação separada do Suwayomi. Na versão 0.9, a leitura ainda aguardava o download completo; isso foi ampliado em 0.10. Guia: [FONTES-INTEGRADAS.md](./FONTES-INTEGRADAS.md).

- **Novo na versão 0.8:** importação local de PDF sem senha no Windows, conversão para PNG e leitura com progresso e marcadores. Até 1.000 páginas, resolução de 2.000 pixels no lado maior. Guia e limites: [PDF.md](./PDF.md).

- **Novo na versão 0.7:** Basic Auth do Suwayomi com sessão em memória, saída, reaproveitamento enquanto o processo está aberto e pausa da fila em caso de recusa de autenticação. HTTPS exigido fora do loopback. Sem armazenamento de senha. Guia: [LOGIN-SUWAYOMI.md](./LOGIN-SUWAYOMI.md).

- **Novo na versão 0.6:** retomada validada no executável real após encerramento forçado, limpeza de parciais identificados ao retomar e pasta alternativa de dados via `--data-dir`. Downloads ativos e capítulos concluídos são preservados. Veja [DADOS.md](./DADOS.md).

- **Novo na versão 0.5:** fila salva em SQLite, recuperação manual após reiniciar, conferência dos capítulos já gravados, descarte sem remover mangás e proteção contra gravações desatualizadas. Não inicia downloads automaticamente.

- **Novo na versão 0.4:** seleção de até 50 capítulos do mesmo mangá, fila sequencial, relatório individual, preservação dos concluídos, cancelamento da fila e tentativa apenas dos pendentes. A fila precisa da janela aberta e não é retomada automaticamente após reiniciar.

- **Novo na versão 0.3:** progresso por páginas concluídas e MiB, cancelamento de download e limpeza dos arquivos parciais. Cancelar pode aguardar uma resposta em andamento (até 35 segundos). A conclusão e o cancelamento são coordenados para preservar a consistência do capítulo.


- **Fontes online via Suwayomi:** conexão explícita, fontes instaladas, busca/populares, paginação, capas, capítulos e download para leitura local. O motor incluído é iniciado pelo botão Ativar fontes integradas; um servidor externo também é opcional. Extensões são gerenciadas pela API do motor, sem carregador APK independente. Guia: [SUWAYOMI.md](./SUWAYOMI.md).

- Biblioteca com capas extraídas da primeira página, pesquisa por título/série/capítulo, favoritos, filtros de leitura e ordenação.
- Edição de título, série e capítulo; filtro por série/avulsos e ordenação natural por capítulo. Organização manual, sem alterar arquivos originais. Veja [SERIES.md](./SERIES.md).
- Importação por seletor nativo de pastas de imagens (incluindo subpastas, até 32 níveis) e CBZ/ZIP Deflate ou Stored. O seletor aceita extensão `.cbz`.
- Importação de até 50 CBZ por seleção, com relatório por arquivo, distinção de existentes e falhas independentes. Importador coberto por testes Rust reais; seletor múltiplo ainda depende de verificação manual. Veja [IMPORTACAO.md](./IMPORTACAO.md).
- JPG/JPEG, PNG, WebP, GIF e BMP. Ordenação natural: página 2 antes de página 10.
- Cada importação corresponde a um volume da biblioteca. Subpastas são concatenadas na ordem natural; não há descoberta automática de séries/capítulos.
- Cópia interna das páginas para leitura independente dos originais. Duplicidade detectada pelo caminho canônico de origem; mover o original permite nova importação. Reimportar o mesmo caminho devolve o volume existente, sem atualizar suas páginas.
- Leitura em página única, dupla, vertical com espaçamento e webtoon contínuo sem espaçamento. Direção direita/esquerda, ajuste por largura/página inteira, zoom, barra de página e tela cheia.
- Progresso e conclusão persistidos em SQLite, retomada de leitura, favoritos e configurações. A conclusão acompanha a página atual; voltar para uma página anterior pode tornar o volume “Lendo” novamente.
- Marcadores de páginas por volume, lista de páginas marcadas e campo para ir diretamente a uma página. Direção e ajuste disponíveis dentro do leitor.
- Estado visível do salvamento, nova tentativa após falha e gravações em sequência. Voltar à biblioteca aguarda a gravação e permanece no leitor em caso de erro. O fechamento normal do aplicativo real passou no smoke test; o caso de gravação pendente permanece coberto pelo teste de interface simulado.
- Exportação/restauração de dados de leitura em JSON, com prévia, configurações opcionais e cópia anterior automática. **Não inclui imagens ou arquivos CBZ.** Os dez testes Rust de backup passaram com arquivos/SQLite reais. Veja [BACKUP.md](./BACKUP.md).
- Temas escuro, claro e sépia.
- Guardião local: lembrete de pausa por intervalo configurável **enquanto o leitor estiver aberto**. Não é um controle parental, antivírus, classificador de conteúdo ou monitor do sistema.
- Confirmação de remoção, preservando os arquivos originais.

## Preparado, mas indisponível

| Recurso | Estado |
| --- | --- |
| Autenticação avançada e sincronização Suwayomi | Basic disponível; cookies/JWT, progresso remoto e atualizações automáticas indisponíveis |
| Plugins | Tipos de manifesto e provedores; sem carregador, instalação ou execução |
| Tradução opcional | Idioma salvo e contrato de provedor; sem OCR, tradução ou envio de páginas |
| PDF avançado | Importação Windows disponível; sem senha, texto selecionável, OCR ou lote |
| Guardião além das pausas | Não especificado e não implementado |
| Sincronização, atualizações e backup dos arquivos de mangás | Não implementados |

Nenhum botão simula integrações inexistentes. A prévia no navegador permite conhecer o layout e experimentar temas; a importação e a leitura real requerem o aplicativo Tauri.

## Como usar o aplicativo

Execute o instalador na pasta `entrega` e siga o assistente. Depois, abra **Yomi Reader**. Rust, Node e as ferramentas C++ são requisitos para compilar o código; não são necessários para usar o instalador. O aplicativo usa WebView2, já instalado neste computador.

## Como desenvolver e recompilar

Requisitos do Windows:

1. Node.js 24 e pnpm 11.25 (`npm install -g pnpm@11.25.0`).
2. Rust estável com o alvo padrão `x86_64-pc-windows-msvc`, instalado por [rustup](https://rustup.rs/).
3. Visual Studio Build Tools com **Desenvolvimento para desktop com C++**, MSVC e Windows SDK.
4. Microsoft Edge WebView2 Runtime. Este computador já possui WebView2.

Referência oficial: [pré-requisitos do Tauri para Windows](https://v2.tauri.app/start/prerequisites/).

**Neste computador, os requisitos já foram instalados.** Rust/Cargo, compilador C++ e arquivos de compilação estão configurados no D: por `local-build.json`. Os scripts carregam esses caminhos somente para o processo atual. Detalhes em [AMBIENTE.md](./AMBIENTE.md).

Abra o terminal nesta pasta:

```powershell
pnpm install --frozen-lockfile
pnpm desktop
```

Ou execute `scripts/Iniciar.ps1` em um terminal PowerShell com os requisitos instalados. O script não instala ferramentas do sistema.

Para gerar o instalador:

```powershell
pnpm desktop:build
pnpm deliver
```

Com a configuração local deste computador, o build sai em `D:/YomiBuildTools/target-yomi/release/bundle/nsis/`; `pnpm deliver` copia o instalador para `entrega/` e registra SHA256. Sem `local-build.json`, a saída padrão é `src-tauri/target/release/bundle/nsis/`. O instalador não é assinado. Usa o ícone padrão existente do template oficial Tauri; nenhuma arte foi gerada.

Para abrir somente a prévia da interface:

```powershell
pnpm dev
```

Acesse `http://127.0.0.1:1420`. A prévia começa vazia, sem uma coleção fictícia.

## Verificações

```powershell
pnpm test
pnpm build
pnpm test:rust
pnpm test:smoke
```

Teste da interface, com o servidor `pnpm dev` aberto em outro terminal:

```powershell
pnpm exec playwright install chromium
pnpm test:ui
```

Para usar um Edge já instalado em vez de baixar Chromium, defina `$env:YOMI_BROWSER_CHANNEL = 'msedge'` antes de executar `pnpm test:ui`. A variável opcional `YOMI_TEST_URL` altera o endereço do servidor de teste.

`test:ui` injeta um transporte Tauri em memória. `test:rust` executa 46 testes nativos; há 2 opcionais de servidor real. O de Basic foi aprovado nesta versão; o anônimo antigo não foi repetido. Veja SUWAYOMI.md para habilitá-lo. `test:smoke` abre a versão de distribuição em processo próprio e verifica interface embutida, IPC Rust/SQLite e protocolo de imagens no WebView2. O smoke usa um PNG existente do Playwright, remove somente sua cópia temporária e fecha o processo de teste; não cadastra volume fictício na biblioteca. As fixtures Rust de importação usam bytes simples para verificar armazenamento. O roteiro manual de leitura e seletores continua pendente.

O workflow `.github/workflows/windows.yml` prepara testes e build com instalador num agente Windows. Ele só será executado após colocar o projeto num repositório GitHub e ativar o workflow; **nenhuma execução remota foi feita nesta entrega**.

## Atalhos de leitura

| Tecla | Ação |
| --- | --- |
| ← / → | Página anterior/próxima conforme a direção configurada |
| Espaço / Page Down | Avançar; nos modos contínuos, rolar |
| Page Up | Voltar; nos modos contínuos, rolar para cima |
| H | Exibir ou ocultar controles |

Os botões da barra inferior seguem anterior/próximo na sequência do arquivo. Na página dupla, a página atual inicia o spread e a última página ímpar aparece sozinha. O progresso considera as duas páginas visíveis.

## Dados, limites e arquitetura

Dados em `%APPDATA%/com.yomi.reader/`: banco `yomi.sqlite3` (com arquivos WAL/SHM), páginas em `library/<uuid>/` e cópias de leitura anteriores a restaurações em `backups/`. Cada importação ocupa espaço adicional. Para copiar o banco manualmente, feche o aplicativo antes. Não existe migração de localização de biblioteca neste MVP.

O protocolo de arquivos do Tauri está limitado à pasta interna `library`. Arquivos CBZ nunca controlam nomes de destino: as páginas recebem nomes numéricos. Entradas ocultas e `__MACOSX` são ignoradas; links simbólicos de pastas não são seguidos. Limites: 10.000 páginas, 64 MiB por página, 1 GiB de dados descomprimidos por volume e 50.000 entradas ZIP. Arquivos criptografados ou métodos ZIP não suportados resultam em erro. A validação de imagens é por extensão; arquivos danificados podem falhar na exibição. As capas usam a imagem original, sem miniaturas pré-calculadas.

O esquema SQLite usa `user_version=3`, com tabelas de marcadores e organização (`book_details`) e atualização aditiva a partir das versões 1 e 2. Bancos de versões futuras são recusados em vez de serem rebaixados. Os testes Rust de migração foram executados e passaram.

Falhas controladas na importação limpam a cópia parcial. Uma interrupção abrupta do processo pode deixar arquivos órfãos; não há coletor automático desses arquivos. O progresso tem atraso de até 350 ms durante a leitura e é aguardado ao voltar à biblioteca; desligar o computador ou encerrar o processo abruptamente pode perder a última atualização.

O leitor contínuo usa carregamento tardio de imagens, mas mantém um elemento por página; não há virtualização completa. Retomar uma página distante aguarda carregar as imagens anteriores para posicionar a rolagem corretamente. Volumes muito grandes podem consumir memória e levar mais tempo para abrir.

```text
src/domain.ts                  Modelos e regras puras
src/libraryModel.ts            Busca, filtros, séries e ordem natural
src/importModel.ts             Resultado e filtros da importação em lote
src/services/library.ts        Adaptador IPC Tauri / prévia web
src/services/writeQueue.ts     Gravações em sequência e recuperação de falhas
src/services/pendingTasks.ts   Operações aguardadas no encerramento normal
src/services/backup.ts         Adaptador dos comandos de backup/restauração
src/hooks/useDesktopClose.ts   Gravações antes de fechar a janela
src/components/Reader.tsx      Modos de leitura e Guardião
src/components/BookCard.tsx    Cartão de volume e ações
src/components/BookEditor.tsx  Edição de título, série e capítulo
src/components/ImportReport.tsx Relatório de importação em lote
src/components/SettingsPanel.tsx
src/components/BackupPanel.tsx Prévia e confirmação de restauração
src/integrations/contracts.ts  Pontos de extensão futuros
src/App.tsx                    Biblioteca e navegação
src-tauri/src/storage.rs       SQLite e importadores locais
src-tauri/src/backup.rs        Snapshot, validação e restauração transacional
src-tauri/src/batch.rs         Importação sequencial de CBZ e resultado por arquivo
src-tauri/src/lib.rs           Comandos nativos e seletor de arquivos
tests/ui.mjs                   Testes da UI com backend simulado
```

## Roteiro manual nativo pendente

1. Importar pasta com arquivos `1.png`, `2.png` e `10.png`; confirmar ordem e capa.
2. Importar CBZ válido com subpastas; cancelar uma seleção e testar CBZ inválido.
3. Ler nos quatro modos, testar RTL/LTR, zoom, tela cheia e retomada de rolagem.
4. Fechar/reabrir o programa e confirmar progresso, tema e favoritos.
5. Configurar Guardião para 1 minuto e verificar o lembrete durante a leitura.
6. Remover um volume e confirmar que a pasta ou CBZ original permanece intacto.
7. Instalar o pacote NSIS e repetir importação/leitura, verificando o protocolo de imagens no build de produção.
8. Marcar páginas, fechar pelo X e confirmar retomada e marcadores após reabrir.
9. Exportar dados de leitura, alterar progresso/tema, revisar a prévia e testar restauração com/sem configurações.
10. Confirmar que o JSON não contém imagens e que a cópia anterior permite desfazer a restauração.
11. Editar título/série/capítulo, reabrir o programa e confirmar organização e progresso.
12. Restaurar backup JSON v2 e confirmar organização; restaurar v1 e confirmar que a organização atual é preservada.
13. Importar um lote com CBZ válido, danificado e já cadastrado; confirmar resultado e preservação da leitura do existente.
14. Cancelar a seleção múltipla, testar o limite de 50 e tentar fechar pelo X durante o processamento.













### Abertura · 0.18.0

Lua carmesim animada com halo dourado e mensagem de boas-vindas. Entrada automática após 6,5 segundos ou ao finalizar o carregamento, se levar mais tempo. Entrar no catálogo permite antecipar a entrada quando os dados estão prontos. A preferência de reduzir animações elimina a animação e a espera adicional. A abertura reaparece a cada início do aplicativo.


### Capas e sinopses · 0.19.0

Ao abrir uma obra pelo catálogo ou favoritos, a tela de capítulos exibe a capa e a descrição fornecidas pela extensão. Descrições longas podem ser expandidas. Ausência ou falha de capa mostra um marcador; descrição ausente mostra uma mensagem. A descrição é exibida como texto seguro, sem executar HTML da fonte.


### Leitura sem distrações · 0.20.0

Tela cheia usa a janela nativa do Windows nos leitores normal, streaming e site integrado. Ao voltar da leitura, o estado anterior da janela é restaurado. No leitor normal, Ocultar controles esconde cabeçalho, barra de opções e rodapé; o botão discreto de engrenagem ou H recupera os controles. No leitor online integrado, Ocultar barras remove a barra completa e reserva apenas uma faixa de 32 pixels para Mostrar controles e sair da tela cheia. A área do capítulo cresce automaticamente. Os controles do próprio site permanecem sob responsabilidade da fonte.

