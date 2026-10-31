# Validação 0.16.0 · 28/10/2026

Instalador NSIS entregue: entrega/Selene_0.16.0_x64-setup.exe, 204.129.642 bytes. SHA256 conferido contra manifesto.json: D92E3AB25B216C655C03016A07D57B7459665CAD81625AD92E7CB2B95F360EAF. A instalação sobre a cópia real do usuário não foi executada.

Adicionados Populares, Atualizados, Novas obras quando suportado e filtro de gênero obtido da extensão. A integração consulta supportsLatest e a árvore real de filtros do SourceType. Preserva índices de filtros/grupos e envia FilterChange ao servidor. Sem filtro/texto, usa POPULAR/LATEST; lançamentos e buscas filtradas usam SEARCH com ordenação e gênero correspondentes. Não filtra somente a página local nem inventa gêneros, datas ou ranking diário.

O gênero é selecionado entre grupos TriState/CheckBox ou Select reconhecidos como gêneros. Ordenações são identificadas pelos rótulos disponibilizados pela fonte, nos idiomas reconhecidos. Fontes sem campos reconhecidos mostram a limitação. Não há suporte universal a todas as extensões ou idiomas. A extensão ToonLivre atual só expõe ordenações; o filtro de gênero fica indisponível nessa fonte.

Validação:

- TypeScript e Vite compilados; 27 testes Vitest aprovados.
- 63 testes Rust aprovados; 4 testes opt-in ignorados no conjunto padrão.
- Um teste opt-in foi executado separadamente e passou com o motor oficial 2.4.2366 incluído: inicialização isolada, consulta de filtros usando a união real GraphQL e LongString, popular local e ciclo de vida do motor. Não acessou fontes externas.
- Testes Rust novos verificam enum POPULAR/LATEST, gênero via FilterChange aninhado com ordem correta, paginação, IDs de 64 bits como strings e rejeição de gênero não disponibilizado antes de obter catálogo sem filtro.
- catalog-categories-ui passou: categorias, lançamentos, gênero, busca/paginação mantendo estado, limpeza por fonte e mensagem de fonte sem suporte. Capturas desktop/compacta inspecionadas em .test-results/catalog-categories.
- catalog-favorites-ui e library-catalog-ui passaram mantendo o catálogo compacto e favoritos existentes.
- Teste nativo final em Selene.exe passou: pedidos LATEST, ordenação de lançamentos e filtro de gênero aninhado chegaram ao servidor de teste; favoritos, histórico, retorno, isolamento e zoom continuaram válidos. Dados e páginas controlados; não comprova aceitação de sites externos. Evidência em .test-results/native-source-site-c78e6ba5-2ec0-4b4a-bb0c-9c40450a097e.

As estruturas foram conferidas no código oficial do motor e das extensões; referências em CATALOGOS.md. A primeira montagem da string GraphQL tinha chaves desbalanceadas e foi corrigida antes da validação no motor oficial. Um teste inicialmente exigia Debug no tipo de sucesso ao inspecionar erro; foi ajustado sem modificar o contrato de produção.

Limites: popularidade e datas são critérios da fonte, não um cálculo próprio. Algumas fontes não permitem combinar atualizados/pesquisa com gênero e isso é indicado. A leitura completa após verificação manual do site continua fora desta validação. A instalação sobre a cópia real do usuário não foi executada.

---
# Validação 0.15.0 · 28/10/2026

Instalador NSIS entregue: entrega/Selene_0.15.0_x64-setup.exe, 204.103.677 bytes. SHA256 conferido contra manifesto.json: F5A3C9D1AB3C9F556BAD2F20836088EB0F23F38B3C6B4D830A9FF5935CB0971D. A instalação sobre a cópia real do usuário não foi executada.

O Selene inicia no catálogo de fontes. A aba Catálogos das fontes vem antes de Meus mangás, que permanece acessível como opção secundária. A montagem do catálogo aguarda o carregamento das preferências para reconectar corretamente à fonte salva. Importações e abertura de livros locais continuam encaminhando para Meus mangás/leitor local.

A lista de botões para cada idioma foi removida. A escolha ocorre em um seletor compacto junto da pesquisa. Ações da fonte ficam em details fechado por padrão. O teste com 61 fontes confirmou capas na primeira área visível, sem aumento da altura da seleção de fonte. Capturas desktop/compacta em .test-results/catalog-favorites foram inspecionadas.

Favoritos online: coração nas capas e nos detalhes; armazenamento SQLite por servidor, fonte e ID do mangá; identificação da fonte/idioma, capa já em cache e indicação de motor integrado. A tela Favoritos inclui mangás das fontes e reabre seus capítulos na fonte correspondente. A remoção altera apenas o favorito online. Não baixa capítulos nem cria livros locais fictícios.

Validação:

- TypeScript/Vite compilados; 27 testes Vitest aprovados.
- 59 testes Rust aprovados, 4 opt-in ignorados. Novo teste cobre persistência após reabrir a biblioteca, deduplicação, mesmo ID em fontes distintas, remoção sem alteração de livros locais e rejeição de servidor inválido.
- catalog-favorites-ui aprovado: início no catálogo, 61 fontes, ações recolhidas, altura compacta, favoritar/desfavoritar, acesso pelos Favoritos à lista de capítulos, persistência após recarregar e acesso à aba local secundária.
- library-catalog-ui e site-history-ui aprovados com a nova estrutura.
- Teste nativo aprovado em Selene.exe: favorito gravado com ID da fonte e do mangá, abertura de capítulos pela tela Favoritos, remoção, leitura na mesma janela, retorno ao catálogo e histórico/zoom existentes. Metadados e páginas desse teste foram controlados localmente. Evidência: .test-results/native-source-site-a9dcc8e5-6ccc-4e08-bb96-5933a3657b6c.

Uma tentativa de teste nativo com o site real não encontrou links públicos de capítulo na sessão nova; isso não foi apresentado como falha do recurso de favoritos nem como prova de funcionamento da fonte. A verificação do novo fluxo foi isolada com páginas controladas. A primeira página local não declarava UTF-8 e o título acentuado não correspondia; o servidor da fixture foi corrigido e o teste passou.

Limites: reabrir capítulos depende da disponibilidade e instalação da fonte. Favoritos externos podem exigir reconexão ao servidor. Favoritos online ainda não estão incluídos no backup JSON do leitor local. A instalação sobre a cópia do usuário e os desafios dos sites não foram automatizados.

---
# Validação 0.14.0 · Selene · 28/10/2026

Instalador NSIS entregue: entrega/Selene_0.14.0_x64-setup.exe, 204.082.736 bytes. SHA256 conferido contra manifesto.json: 2931A6EF84BAAD573DF8399CE4FA4D6E6C0BC458CB7BF83721B5C3ECD89C3429. A instalação sobre a cópia real do usuário não foi executada.

Identidade atualizada: nome visível Selene, título da janela Selene, executável Selene.exe, novo ícone vetorial de lua carmesim com aro/estrela dourados, favicon correspondente e paleta escarlate/preto/dourado. Os temas claro e sépia mantêm seus fundos legíveis com os novos acentos. Os tons lilás foram substituídos nas áreas de navegação, botões, cartões, decoração e controles do leitor integrado.

O identificador com.yomi.reader, nomes internos de dados, chaves das preferências, protocolos e formatos de backup foram mantidos para compatibilidade. Não houve migração nem limpeza da biblioteca do usuário. Strings de apresentação e o nome sugerido de novos backups passaram a Selene.

Validação:

- TypeScript/Vite compilados e 27 testes Vitest aprovados.
- 58 testes Rust aprovados, 4 testes opt-in ignorados.
- site-history-ui e library-catalog-ui aprovados após a alteração visual.
- Capturas da identidade escura, clara, sépia e compacta inspecionadas em .test-results/selene-brand.
- Ícone gerado diretamente do SVG pelo gerador do Tauri e inspecionado. Não foram usadas imagens geradas por IA.
- Metadados PE de Selene.exe confirmaram ProductName Selene, FileDescription Selene e FileVersion 0.14.0.
- Conferência nativa final aprovada: título da janela Selene, marca Selene, SVG local carregado com dimensões válidas e captura da biblioteca em .test-results/selene-native-bb88835c-6364-46b4-9d5e-b54863360064/selene-library.png.

A primeira conferência nativa encontrou uma falha real: o Vite embutia o SVG como data:image, bloqueado pela política img-src do aplicativo. O import passou a usar ?no-inline para servir o arquivo local, sem ampliar permissões. A tentativa inicial de aguardar o carregamento confirmou que não era apenas atraso de rede. Uma tentativa de recarregar o alvo antes de a navegação inicial terminar foi abortada e não foi considerada validação.

A mudança é de identidade visual. Não altera a necessidade de confirmação manual nos sites, o suporte das extensões ou as limitações do histórico descritas em HISTORICO-ONLINE.md. O assistente de instalação sobre a cópia real do usuário não foi executado.

---
# Validação 0.13.0 · 26/10/2026

Instalador NSIS entregue: entrega/Yomi Reader_0.13.0_x64-setup.exe, 204.086.685 bytes. SHA256 conferido contra manifesto.json: F3F41F97EB9D1030AB34A4B26EFB1ADA4BE189B60B8E67EFE32EDACA9EDD130F. A instalação sobre a cópia do usuário não foi executada.

Implementado histórico SQLite independente para leitura em sites, com título, capítulo, URL, capa já em cache e data. Capítulos reabertos são atualizados por URL, sem duplicação. Lidos recentemente mostra os capítulos online com ação Reabrir capítulo, que usa a URL salva sem consultar o motor. Navegações para um próximo capítulo numérico de obra conhecida no mesmo domínio são registradas ao terminar de carregar a página, enquanto a área está ativa.

A área de leitura agora é centralizada com largura confortável máxima de 1120 pixels lógicos ou ocupa toda a janela. O cálculo respeita a escala do Windows, a barra de 72px e a altura disponível. Zoom nativo de 70% a 160%. Os ajustes são persistidos no perfil da interface e reaplicados ao reabrir.

Validação realizada:

- TypeScript e Vite compilados; 58 testes Rust passaram, com 4 testes opt-in ignorados; 27 testes Vitest passaram.
- Teste novo site-history-ui: cartão em recentes, reabertura, preferências de largura/zoom e barra sem transbordamento em 720, 1366, 1920 e 3840 pixels. Transporte nativo simulado.
- library-catalog-ui passou com catálogo, leitura integrada e retorno.
- native-source-site passou no executável final: uma janela, WebView centralizada, redimensionamento, isolamento do site remoto, histórico sem duplicação, cartão em recentes, reabertura, largura total, zoom real e preferências mantidas após reabrir. Metadados GraphQL controlados e navegação na ToonLivre real.
- O registro automático de próximo capítulo foi validado também pelo evento nativo de carregamento de uma página local controlada, mudando de /obra/65 para /obra/66.
- Persistência do histórico após reabrir a biblioteca, deduplicação e recusa de URL não web foram verificadas em teste Rust.
- Captura dos recentes inspecionada em .test-results/native-source-site-84ccc688-9156-43c1-ac98-2b5fd03083bc/recent-site-readings.png.

Uma referência do teste ao primeiro alvo do depurador ficou inválida porque o fluxo de conexão encerra a sessão anterior e recria a área de leitura. O teste foi corrigido para selecionar a WebView atual; não foi tratada essa referência antiga como falha do histórico.

Limites: a página real continua solicitando verificação manual antes das imagens. O histórico registra abertura e não conclusão, não preserva rolagem exata nem reconstrói leituras de versões anteriores. A tabela nova não está no backup JSON do leitor local. Ajustes de largura/zoom foram validados com a página real e a interface; leitura completa após desafio manual continua pendente.

---
# Validação 0.12.5 · 26/10/2026

Instalador NSIS entregue: entrega/Yomi Reader_0.12.5_x64-setup.exe, 204.063.989 bytes. SHA256 conferido contra manifesto.json: 70684203A8B04ADD1CED7E24BFE6D1CEB7F56B58C4A3789E2DF865F1A7BEC11B. A instalação sobre a cópia do usuário não foi executada.

O usuário reportou tela vazia e falta de resposta ao voltar ao catálogo na 0.12.4. Os testes anteriores checavam principalmente DOM e ciclo de vida, o que não basta para provar restauração visual em todos os sistemas Windows.

O retorno agora oculta a WebView da fonte, em vez de destruir seu controlador, e restaura explicitamente a WebView principal: posição 0,0, tamanho da área interna da janela, redimensionamento automático, visibilidade e foco. A área da fonte é reutilizada na próxima leitura. As permissões e a separação de sessão continuam iguais.

O teste de regressão passou no executável 0.12.5: foco de volta no documento principal, três ciclos adicionais de abrir/voltar, captura do catálogo restaurado e clique em Voltar aos resultados. A captura foi inspecionada e mostra a interface com a obra e a lista de capítulos preservadas. Evidências em .test-results/native-source-site-ee384e97-5407-44ee-9509-3e97d4f713db. O teste continua usando metadados controlados e navegação no site real; não resolve desafios da fonte.

A leitura completa após a verificação manual permanece pendente e não deve ser apresentada como validada por esta correção.

---
# Validação 0.12.4 · 26/10/2026

Instalador NSIS entregue e hash conferido contra manifesto.json: Yomi Reader_0.12.4_x64-setup.exe, 204.061.695 bytes, SHA256 98D2254C0D0CF26D7DD691BB31A8B3D2E8BC88C2443113887543769D72207BD3. A instalação sobre o aplicativo do usuário não foi executada.

O teste final do executável passou: catálogo com metadados controlados → Ler online → área integrada com site real → Voltar ao catálogo, mantendo a lista de capítulos e fechando a área remota. Evidências em .test-results/native-source-site-ff93051b-2f96-42a0-95ef-9ad9dff3e10a.

A leitura da fonte passou a ser uma WebView filha da janela main. A barra de 72px contém Voltar ao catálogo; a fonte ocupa o restante da área. O catálogo permanece montado, preservando mangá, capítulos, pesquisa e paginação. Ler online da ToonLivre/Manga Livre usa esse fluxo por padrão. Outras fontes mantêm o leitor progressivo e oferecem Ler no site como alternativa.

Validação:

- 57 testes Rust e 27 testes Vitest aprovados; 4 testes Rust opt-in ignorados.
- TypeScript/Vite compilados e teste library-catalog-ui aprovado, incluindo Ler online da ToonLivre, retorno e preservação da lista de capítulos (transporte simulado).
- Teste native-source-site: Tauri lista apenas a janela main e a WebView da fonte informa main como sua janela. A área da fonte acompanha a maximização real e mantém 72px para a barra superior.
- Site real da ToonLivre abriu, links de capítulos apareceram e a página de um capítulo foi carregada. Na observação, a página solicitou Verificação de segurança e não carregou imagens. A confirmação manual e a leitura completa continuam pendentes.
- A página remota não conseguiu invocar get_data_location. Endereço file:// de capítulo foi recusado. Fechar a área de leitura preservou a janela principal e a biblioteca.
- O teste usa um servidor local controlado para os metadados GraphQL e o site real para a navegação. Não comprova obtenção de metadados pela extensão ou obtenção de páginas para o leitor local.

Foi habilitada a API multi-WebView do Tauri (feature unstable) para embutir a fonte. A dependência continua fixada no Cargo.lock. Uma substituição de versão atingiu acidentalmente hashbrown no lockfile; a referência original 0.12.3 foi restaurada após conferir que o SHA256 do pacote local é exatamente o checksum já registrado. O Cargo validou o resultado com --locked --offline.

O teste pelo botão Voltar também revelou uma corrida: o retorno era permitido antes da conclusão do comando que cria a WebView e podia deixar uma área remota órfã. O botão agora fica desabilitado enquanto o comando de abertura está em andamento.

O primeiro teste usou IDs de janela do Chrome DevTools, que identificam áreas WebView e não demonstram janelas Tauri distintas. Foi substituído pela identidade da janela Tauri. O redimensionamento por CDP também alterava só a WebView principal; o teste válido maximiza a janela real pelo comando já permitido do Tauri.

O progresso e os modos do leitor SQLite não se aplicam à leitura na página do site. A confirmação é manual. Não há transferência de cookies para a extensão nem emulação do protocolo de atividade Android.

---
# Validação 0.12.3 · 26/10/2026

Instalador NSIS entregue em entrega/Yomi Reader_0.12.3_x64-setup.exe, 204.042.324 bytes. SHA256 conferido contra entrega/manifesto.json: CDC46E4E60BADA4FE481D897132FC0AF50B9E99029DF185005FF71FB7ED80070. A instalação não foi executada sobre o aplicativo do usuário.

Nova opção Abrir site no Yomi nos catálogos e Ler no site em cada capítulo. A janela usa WebView2 diretamente e não a ponte remota KCEF. A sessão de navegação é separada da extensão; não há transferência de cookies, protocolo Android de verificação, download ou progresso SQLite implementados para esta leitura.

Verificado:

- 57 testes Rust aprovados, 4 testes opt-in ignorados; 27 testes Vitest aprovados.
- TypeScript e Vite compilados; teste library-catalog-ui aprovado, incluindo os IDs de fonte/capítulo enviados ao novo botão (transporte simulado).
- Aplicativo release Tauri compilado.
- Teste native-source-site com o executável final: página inicial real da ToonLivre aberta, título e links reais de obras/capítulos presentes; capítulo Gerente Kim 265 aberto na mesma janela.
- A página remota não conseguiu invocar get_data_location; URL de capítulo file:// foi recusada.
- Metadados GraphQL do teste de janela vieram de um servidor local controlado. A navegação foi ao site real. O teste não demonstra obtenção de metadados pela extensão real.
- O capítulo exibiu Verificação de segurança e nenhuma imagem de página foi carregada durante a observação. Nenhum desafio foi resolvido automaticamente. A leitura completa após confirmação manual continua pendente; não apresentar a fonte como totalmente corrigida.
- A captura de tela e o registro do teste final estão em .test-results/native-source-site-54713141-1694-438e-8167-3129d7f5f7af.

O diagnóstico anterior de indisponibilidade geral foi corrigido: testes HTTP simples receberam redirecionamento, mas o Edge e o WebView2 abriram o site normalmente. A condição que diferencia essas respostas não foi isolada.

Consulte LEITURA-NO-SITE.md para o uso e as limitações. A interface do assistente de instalação ainda requer validação manual.

---
# Validação 0.12.2 · 26/10/2026

Instalador NSIS 0.12.2 gerado e entregue, com SHA256 conferido em manifesto.json.

O vídeo enviado pelo usuário mostra o aplicativo Android abrindo Vilão a Ser Morto, capítulo 258, exibindo a verificação de segurança na própria página e depois exibindo as imagens. Isso demonstra funcionamento naquele aplicativo/dispositivo; não comprova aceitação no navegador Windows.

O Yomi abria a página inicial da fonte. Foi adicionado Verificar capítulo na lista, com ID explícito: usa chapter.realUrl quando disponível ou resolve chapter.url contra o site da fonte. Protocolos não web e URLs opacas são recusados. A janela existente passa a navegar para o novo destino, em vez de apenas voltar ao foco com a página anterior.

- 57 testes Rust padrão aprovados. Novo teste verifica preferência por endereço exato, resolução relativa e rejeição de file://.
- Teste opcional com motor oficial aprovado: criação de um capítulo local controlado, consulta real Int! de url/realUrl, além das verificações de fonte, autenticação e ciclo de vida.
- Teste de interface aprovado para o botão com o ID do capítulo 8 e a fonte 100, preservando catálogo e navegação.
- TypeScript/Vite compilados. Fonte e capítulo usam os tipos reais LongString! e Int!, respectivamente.
- 27 testes unitários frontend aprovados. Regressão do executável final aprovada para o comando de verificação sem capítulo, fonte local sem website, conexão, reabertura e encerramento do motor.

Não foi automatizado desafio externo. Não foi afirmado que a proteção do site aceitará o navegador Windows; a mudança alinha o destino da verificação ao fluxo do vídeo. Guia: [VERIFICACAO-FONTES.md](./VERIFICACAO-FONTES.md).

---

# Validação 0.12.1 · 26/10/2026

Corrigida uma falha do Yomi na consulta do endereço da fonte ao abrir a verificação. Instalador NSIS 0.12.1 gerado, entregue e SHA256 conferido em manifesto.json. A API do Suwayomi usa LongString para IDs de fonte; 0.12.0 declarava a variável como Long, tipo inexistente nesse esquema. O erro de validação era ocultado pela mensagem genérica de sessão autenticada.

- 56 testes Rust padrão aprovados, incluindo novo teste da consulta LongString com ID de 64 bits preservado como string.
- Teste opcional com motor oficial aprovado: consulta real do site da fonte local retorna null, sem erro de esquema; autenticação, catálogo, reutilização, parada e reabertura do motor continuam funcionando.
- Teste do executável final aprovado: o comando open_source_browser consulta a fonte local e devolve a mensagem específica de ausência de site, comprovando que passou pela API real sem erro de esquema. Autenticação, reconexão e encerramento do motor também aprovados.
- O primeiro teste nativo tentou conferir preferências antes de sua gravação assíncrona terminar; o roteiro passou a aguardar a persistência antes da asserção e foi repetido com sucesso.
- A consulta foi extraída para Connection::source_site, compartilhada entre o comando e os testes. O comando deixa de usar uma consulta separada não coberta.

O teste do navegador em 0.12 validava transporte/renderização, mas não passava pela consulta do botão de verificação. Essa lacuna foi corrigida. A atualização corrige a abertura da verificação; a aceitação do site externo continua dependendo da verificação manual.

---

# Validação 0.12 · 26/10/2026

Verificação manual de fontes. Instalador NSIS 0.12.0 gerado, entregue e SHA256 verificado em manifesto.json. O registro real da captura do usuário identificou MangaLivre com `Cloudflare bypass currently disabled`; a mensagem anterior confundia isso com um 403 comum.

- 55 testes Rust padrão aprovados, incluindo validação de URLs/origem local, rejeição de rota sem chave aleatória e um teste de regressão que mantém a conexão bidirecional após um intervalo sem dados.
- 1 teste opcional do navegador oficial aprovado separadamente com instalação já preparada e repetido desde uma pasta nova: download inicial e reconexão de preparo aprovados. Valida HTML autenticado, credencial interna ausente do HTML, comunicação interativa e renderização de uma página local controlada. Não automatiza CAPTCHA ou verificação externa.
- Conferência adicional dos pixels aprovou a renderização com página de teste de fundo opaco. O primeiro teste de pixels assumia que o canto superior esquerdo fosse opaco e falhou com uma página transparente; o teste foi corrigido para examinar uma região da imagem e usar fundo explícito.
- Regressão no executável release aprovada: leitura progressiva, cache, offline e encerramento/reabertura do motor.
- 27 testes unitários frontend aprovados. Teste de interface da biblioteca também aprovou a chamada de verificação para o ID da fonte selecionada e a orientação de preparo manual.

O transporte usa apenas o motor integrado em 127.0.0.1; a janela não recebe as capacidades Tauri da janela principal. Header Basic permanece no Rust. A chave de acesso à ponte local muda a cada janela. A ativação do componente fica em `engine/browser-enabled`; o navegador é baixado pelo próprio motor na primeira ativação e reutilizado.

O teste inicial abriu o HTML mas perdeu a conexão. O diagnóstico encontrou que sockets aceitos herdavam o modo não bloqueante no Windows; a ligação era encerrada com WouldBlock quando não havia dados imediatos. Isso foi corrigido e coberto por teste padrão. A preparação assíncrona do navegador também recebeu repetição do sinal inicial da conexão local, sem interação com desafios do site. A primeira ativação também expôs uma expiração de conexão antes da criação do navegador; a reconexão local foi ampliada para reconhecer esse erro de preparo, e o teste com download inicial passou em 52 segundos. Um teste de renderização chegou ao resultado esperado, mas ficou preso ao fechar o servidor HTTP de teste: a limpeza das conexões do próprio teste foi corrigida e a repetição terminou aprovada. Uma tentativa de recompilar enquanto o executável de teste ainda estava aberto foi recusada por bloqueio de arquivo do Windows; não foi contada como validação.

**A aceitação do MangaLivre/Cloudflare real não foi validada.** O usuário precisa concluir manualmente a verificação e tentar o capítulo novamente. O site ainda pode recusar o navegador, a sessão ou o endereço de rede. Não há integração de resolvedor automático nem garantia de desbloqueio. Guia: [VERIFICACAO-FONTES.md](./VERIFICACAO-FONTES.md).

---

# Validação 0.11 · 26/10/2026

Catálogos de fontes dentro da biblioteca, usando a integração de leitura/download existente. Instalador 0.11.0 gerado e entregue; SHA256 conferido com manifesto.json.

- Conferência adicional dos pixels aprovou a renderização com página de teste de fundo opaco. O primeiro teste de pixels assumia que o canto superior esquerdo fosse opaco e falhou com uma página transparente; o teste foi corrigido para examinar uma região da imagem e usar fundo explícito.
- Regressão no executável release aprovada: leitura progressiva, cache, offline e encerramento/reabertura do motor.
- 27 testes unitários frontend aprovados. Sem alteração da lógica Rust nesta rodada; os 52 testes padrão da versão 0.10 ficam registrados abaixo.
- Novo teste da interface aprovado: aba Catálogos das fontes, fontes por nome/idioma, abertura automática de populares, paginação, pesquisa mantida ao trocar de fonte com retorno à página 1, abertura de capítulos, retorno a Meus mangás, última fonte restaurada e erro de fonte sem repetição automática em loop.
- Os testes anteriores de importação, biblioteca, leitor, backup, fila online e leitura progressiva passaram novamente com transporte simulado no Edge.
- TypeScript/Vite compilados; executável Windows compilado com o motor incluído.
- Teste do executável final com HTTP/SQLite/imagens reais aprovado na variante YOMI_TEST_LIBRARY_CATALOG=1: fonte externa previamente configurada reconectada na aba da biblioteca, catálogo carregado automaticamente, capítulos abertos, leitura progressiva nos quatro modos, conclusão de download sem duplicação e reabertura offline. Dados e perfil exclusivos de teste, removidos após sucesso.

A biblioteca conserva a coleção local em Meus mangás. A aba Catálogos das fontes consulta apenas a fonte selecionada: não baixa todos os catálogos e não adiciona todos os títulos à coleção. Gerenciamento de repositórios/extensões permanece em Fontes online. O guia atual está em [CATALOGOS.md](./CATALOGOS.md).

---

# Validação 0.10 · 26/10/2026

Leitura online progressiva e preferências de fontes persistentes. Instalador NSIS 0.10.0 gerado, copiado para entrega e SHA256 conferido em manifesto.json.

- 52 testes Rust padrão aprovados; 3 opcionais não executados nesta rodada.
- 27 testes unitários frontend aprovados, incluindo restauração da fonte/motor e tratamento de cache parcial na fila.
- Testes anteriores da interface, fila/download e novo teste de leitura progressiva passaram no Edge com transporte simulado. O novo teste verifica que apenas a página exibida é solicitada, e que a fonte é restaurada com ativação automática após recarregar.
- Teste Rust com HTTP controlado: registrar o capítulo consulta só os metadados, sem baixar imagens; solicitar a primeira não busca a segunda; repetir a primeira usa cache; progresso e marcadores sobrevivem à reabertura; completar o download converte o mesmo volume para offline sem duplicar.
- Teste do aplicativo final com Rust/SQLite/HTTP e imagens PNG reais: 1 de 3 imagens requisitada ao abrir, 2 de 3 após avançar, página dupla e modos vertical/webtoon decodificados, fonte e progresso salvos, download completo reutilizando os arquivos e um único volume, reabertura offline com imagem decodificada. Dados e perfil exclusivos de teste.

O teste nativo com o motor oficial também passou: preferência de ativação e fonte gravadas, segunda abertura conectando sem pressionar Ativar fontes integradas, mesma porta, recusa anônima, encerramento normal e encerramento forçado do aplicativo removendo seu Java.

As extensões e os repositórios do motor continuam no diretório persistente usado desde 0.9. A nova preferência integratedEngine restaura o início/conexão quando Fontes online é aberto. A preferência onlineSource restaura o ID da última fonte, sem converter IDs de 64 bits em números JavaScript.

O teste online usa um servidor HTTP controlado: comprova o caminho completo interface → Rust → rede → arquivo → SQLite → imagem, mas não garante disponibilidade de sites/fornecedores externos. Fontes que não retornam capítulos ou exigem recursos não suportados continuam podendo falhar.

Limites: páginas próximas à área visível podem ser carregadas em conjunto nos modos contínuos; cache persistente de até 1 GiB por capítulo; sem limite global/limpeza automática de cache ou preferência de pré-carregamento. As páginas ainda não carregadas exigem conexão. Baixar e ler completa o mesmo volume para uso offline; remover o volume apaga também cache, progresso e marcadores. Backup JSON não inclui imagens nem os dados do motor.

---

# Validação 0.9.1 · 26/10/2026

Correção do diagnóstico de falhas de fontes autenticadas. A captura enviada pelo usuário e o engine.log local mostraram catálogo disponível, mas `No chapters found` ao abrir o título; houve também um HTTP 404 anterior em uma busca. O usuário identificou a fonte como MangaToon (Limited). Isso não identifica sozinho se o título não tem capítulos públicos ou se a extensão falhou na interpretação do site.

- 51 testes Rust padrão aprovados; 3 opcionais não repetidos nesta rodada.
- Novo teste cobre `No chapters found`, HTTP 404, 403 e 429 com autenticação, sem reproduzir texto livre do servidor ou o marcador de segredo.
- As mensagens agora orientam a atualizar a extensão no Yomi, aguardar limites do site ou tentar outra fonte. Não direcionam para uma interface de servidor indisponível no motor integrado.
- O tratamento de autenticação 401/403 do próprio motor foi preservado.
- Instalador 0.9.1 compilado e entregue. A verificação do executável final confirmou abertura, comandos Rust/SQLite e imagem interna, mas o roteiro de smoke terminou com falha: a instância exclusiva não respondeu ao fechamento normal em oito segundos e o roteiro encerrou somente seu próprio processo. Portanto, o smoke completo desta rodada não deve ser contado como aprovado. O fechamento merece investigação separada; não houve alteração desse fluxo nesta correção.

Esta atualização melhora a identificação da causa; não altera o código da extensão MangaToon, não libera capítulos pagos e não garante que o título passe a abrir. A implementação atual da extensão filtra episódios pagos: https://github.com/keiyoushi/extensions-source/blob/main/src/all/mangatoon/src/eu/kanade/tachiyomi/extension/all/mangatoon/MangaToon.kt

---

# Validação da entrega 0.9 · 26/10/2026

Edição completa Windows x64: motor Suwayomi 2.4.2366 e seu Java portátil incluídos. SHA256 do instalador em `entrega/manifesto.json`.

- **50 testes Rust padrão aprovados**, mais **1 teste opcional real do motor integrado aprovado**: 51 no total. Os dois testes opcionais antigos de servidor externo não foram repetidos nesta rodada.
- **26 testes unitários frontend aprovados**. TypeScript/Vite compilados.
- Teste real Rust do motor: início protegido por Basic interno, recusa anônima, catálogo de extensões, consulta dos repositórios, rejeição de extensão inexistente, reutilização do processo e reinício na mesma porta com nova credencial interna.
- Teste do executável release com recursos empacotados: botão Ativar fontes integradas inicia o motor, consulta real de extensões via Rust, acesso anônimo recebe 401, processo reutilizado, encerramento forçado somente do Yomi também encerra seu Java, reabertura preserva porta e fechamento normal encerra o motor. Pasta de dados e perfil WebView2 exclusivos de teste, removidos após sucesso.
- Fluxo novo de interface com respostas simuladas: início integrado, adição de repositório, confirmação/cancelamento de instalação, recarga das fontes, desinstalação e falha sem sucesso falso. Os fluxos anteriores de interface e fila online também passaram no Edge.

A instalação/atualização/desinstalação de uma extensão de repositório externo está implementada na API e na interface, mas **não foi executada com código de extensão de terceiros nesta rodada**. Nenhuma fonte/site externo, login de fonte ou desafio de navegador foi validado. Não há repositórios predefinidos. O assistente do instalador continua sem validação manual.

O teste nativo inicial detectou que o caminho LOCALAPPDATA fornecido por este ambiente era longo demais para sockets Java. O aplicativo passou a usar `%USERPROFILE%/.yomi-sock`; o teste final de início/reinício passou. Outra tentativa identificou parâmetros antigos de autenticação e a inicialização automática de CEF: foram corrigidos para authUsername/authPassword e kcefEnabled=false. O navegador auxiliar não é baixado pelo fluxo final. Houve também uma tentativa de empacotamento enquanto o executável estava em teste, recusada pelo bloqueio de arquivo do Windows; o pacote final é gerado após o encerramento do teste. O teste de fechamento foi ajustado para aceitar a desconexão esperada da janela destruída.

A leitura progressiva online ainda não foi implementada: Baixar e ler aguarda o capítulo completo. Preferências e login de fontes, desafios de navegador e migração de configurações de um servidor externo permanecem pendentes. Guia: [FONTES-INTEGRADAS.md](./FONTES-INTEGRADAS.md).

Para repetir o teste nativo, configure YOMI_TEST_BINARY com o caminho absoluto do executável release e execute `node tests/native-engine.mjs`. Para repetir o teste Rust opcional, configure YOMI_ENGINE_RUNTIME com a pasta do runtime e execute o caso `official_engine_starts_reuses_stops_and_restarts_with_same_port` com `--ignored`. Ambos criam dados isolados.

---

# Validação da entrega 0.8 · 26/10/2026

Instalador: `entrega/Yomi Reader_0.8.0_x64-setup.exe`. SHA256 em `entrega/manifesto.json`.

- **48 testes Rust padrão aprovados**, com dois opcionais dependentes de Suwayomi externo ignorados nesta rodada.
- **26 testes unitários frontend aprovados**; TypeScript/Vite e instalador NSIS compilados.
- Os testes antigos de interface e de catálogo/fila online passaram no Edge com transporte simulado.
- O executável final abriu e chamou Rust/SQLite; uma imagem interna foi decodificada pelo protocolo de arquivos do WebView2. O teste usou instância e perfil próprios e não modificou livros ou configurações existentes.
- PDF real de duas páginas convertido pelo Windows, com retrato/paisagem, assinatura PNG, dimensões de 1.500 × 2.000 e 2.000 × 1.500, ordem das páginas, progresso, conclusão, marcadores e reabertura SQLite verificados. Nome do original inclui acento, apóstrofo, cifrão e &; caminhos são valores de ambiente, sem interpolação em código PowerShell.
- Arquivo sem cabeçalho e PDF corrompido rejeitados, sem livros ou pastas parciais extras. Reimportação do mesmo caminho preserva o volume e a leitura.

A validação PDF chama o importador Rust real diretamente; o seletor nativo de arquivos ainda requer verificação manual. O assistente de instalação, PDFs pessoais variados, PDFs com senha e limites extremos não foram exercitados automaticamente. Os limites estão no código, mas não devem ser confundidos com testes de carga realizados.

O primeiro teste detectou codificador PNG incorreto e uma falha do PowerShell ao finalizar objetos WinRT depois de produzir as imagens. O codificador foi corrigido e o processo auxiliar encerra explicitamente após liberar páginas/streams. A suíte final passou. Uma tentativa inicial dos testes de navegador também falhou por conexão indisponível com o servidor de teste; executar servidor e navegador no mesmo ambiente resolveu e ambos os fluxos passaram.

O suporte PDF depende do Windows PowerShell e da API PDF do Windows. Não adiciona mecanismo de PDF, OCR ou serviço remoto ao instalador. Resolução, limites e ausência de percentual/cancelamento: [PDF.md](./PDF.md).

Os testes reais de autenticação e recuperação de downloads da versão 0.7 ficam registrados abaixo; não foram repetidos nesta rodada. Nenhuma mudança foi feita nesse fluxo.

---

# Validação da entrega 0.7 · 25/10/2026

Instalador: `entrega/Yomi Reader_0.7.0_x64-setup.exe`. SHA256 atual em `entrega/manifesto.json`.

## Testes executados

- **46 testes Rust padrão aprovados**, mais **1 teste opcional Basic com Suwayomi oficial aprovado separadamente: 47 no total**. O teste opcional anônimo antigo não foi repetido.
- **26 testes frontend aprovados**, incluindo pausa da fila na primeira recusa de autenticação.
- TypeScript/Vite e instalador NSIS compilados; fluxos antigos da interface e teste online simulados aprovados no Edge.
- Teste nativo isolado com Basic aprovado: senha incorreta, limpeza do campo, nova tentativa, navegação e reaproveitamento da sessão sem redigitar, fonte/capa/páginas protegidas, encerramento forçado, sessão ausente após reiniciar, pausa da fila no primeiro 401, novo login, retomada, logout e leitura local.
- O teste autenticado terminou com 3 inicializações, 3 capítulos, 2 recusas esperadas de autenticação, zero duplicados, zero diretórios órfãos e zero erros de JavaScript. Senha e cabeçalho Basic de teste não apareceram nos arquivos SQLite do Yomi.
- A recuperação sem login e o smoke nativo da pasta padrão também passaram.

Comandos principais:

```powershell
pnpm test
pnpm test:rust
pnpm test:auth
pnpm test:recovery
```

O conjunto padrão Rust executa 46 casos e ignora 2 dependentes de servidor. O caso `real_basic_server_catalog_and_images` foi habilitado nesta sessão contra Suwayomi Server v2.4.2366 oficial, com Basic em `127.0.0.1:4591`, dados próprios e credenciais temporárias de teste. Ele comprovou recusa anônima, conexão Basic, busca na fonte local, capítulos, capa e duas páginas. O servidor de teste foi encerrado e seu arquivo de configuração com credenciais de teste foi removido.

## Sessões e proteção dos dados

As credenciais ficam no gerenciador nativo em memória, por URL normalizada completa. Não há campos de login no esquema de configurações ou da fila. O cabeçalho é marcado como sensível e erros GraphQL autenticados não ecoam texto arbitrário do servidor. Requisições não seguem redirecionamentos e páginas continuam limitadas às rotas permitidas.

Tentativas possuem identificadores para que um login/resposta atrasados não substituam uma sessão nova nem restaurem uma sessão encerrada. Um pedido anônimo não pode invalidar um login ainda em andamento. Há testes para essas disputas. O frontend aguarda a consulta local da sessão antes de habilitar a reconexão e ignora respostas antigas após ações explícitas.

Basic por HTTP é permitido somente no loopback; para outros destinos é exigido HTTPS. O bloqueio de HTTP remoto e a geração de cabeçalho sensível passaram em testes locais. Não foi realizada conexão a servidor HTTPS remoto nem a certificado próprio.

## Limites da evidência

O teste `test:auth` usa aplicativo real, SQLite real e HTTP controlado com PNG existente do Playwright. O teste opcional adicional utiliza o Suwayomi oficial com sua fonte local. Nenhum dos dois valida sites/extensões externos individualmente.

O teste do leitor foi ajustado para aguardar a volta à biblioteca e a confirmação do progresso antes de destruir a janela de teste. O primeiro ensaio a fechava antes de a ação assíncrona terminar; os ensaios finais aguardam e validam a gravação antes e depois da reabertura.

Cookies/simple_login, JWT/ui_login, senha persistente/cofre do Windows, sincronização de progresso, PDF e tradução continuam indisponíveis. O assistente do instalador e fontes externas continuam pendentes de validação manual. Guia: [LOGIN-SUWAYOMI.md](./LOGIN-SUWAYOMI.md).

---
## Histórico da entrega 0.6 · 25/10/2026

Instalador: `entrega/Yomi Reader_0.6.0_x64-setup.exe`. SHA256 atual em `entrega/manifesto.json`.

- **40 testes Rust aprovados**. Novos casos cobrem a pasta de dados explícita e a limpeza de downloads incompletos sem remover downloads ativos, capítulos registrados ou pastas não identificadas/de outra origem.
- **25 testes frontend aprovados**.
- TypeScript/Vite, release e instalador NSIS compilados.
- **Teste completo do executável real após interrupção aprovado**, via `pnpm test:recovery`, usando dados e WebView2 isolados na pasta do projeto.
- Smoke da pasta padrão aprovado: interface empacotada, SQLite/IPC da fila, revisão desatualizada rejeitada, download HTTP controlado cancelado com limpeza e decodificação do PNG pelo protocolo de imagens.

## Resultado do teste de recuperação

1. A interface real conectou ao servidor HTTP controlado e iniciou uma fila de três capítulos.
2. O primeiro capítulo foi confirmado no SQLite. O segundo recebeu uma página e ficou aguardando a próxima.
3. Somente o processo de teste e seus filhos foram encerrados à força.
4. Ao reabrir a mesma pasta de dados, a fila apareceu sem iniciar downloads sozinha.
5. A retomada baixou apenas os dois capítulos pendentes. O primeiro manteve seu identificador e não solicitou páginas novamente.
6. Os três capítulos ficaram registrados, sem duplicados. Uma imagem foi decodificada no leitor real; avançar a página e reabrir o processo preservou o progresso/conclusão.
7. Nenhum diretório órfão ficou na biblioteca isolada após a retomada.

Resumo: 3 inicializações, 3 capítulos, solicitações de páginas de capítulo por ID `{101:1,102:2,103:1}`, zero diretórios órfãos e zero erros de JavaScript. O resumo completo fica em `.test-results/latest-recovery.json`.

O primeiro teste revelou uma pasta parcial sem vínculo após encerramento forçado. A correção introduziu um marcador/arquivo exclusivo por download. Ao retomar a mesma origem, somente diretórios UUID internos identificados e sem processo ativo são candidatos à remoção; o banco é consultado depois de obter exclusividade para preservar capítulos já confirmados. Pastas antigas sem identificação não são removidas automaticamente.

A pasta alternativa é escolhida por `--data-dir` e foi conferida pelo próprio IPC antes de qualquer alteração no teste. O protocolo de imagens usa a pasta em execução; a autorização padrão anterior não é mantida quando outra pasta é selecionada. O teste não utilizou a coleção pessoal.

## Limites da evidência

O aplicativo, o Rust, o SQLite, os arquivos, a interface e a interrupção/reabertura são reais. A fonte de conteúdo é um servidor HTTP local controlado que implementa as operações necessárias da API, com PNG existente do Playwright. Não foi uma extensão/site externo nem uma nova validação do servidor Suwayomi real. O teste opcional de Suwayomi real continua não repetido nesta versão.

O assistente NSIS, sites/extensões externos, migração guiada da biblioteca, desempenho com grandes coleções, PDF, tradução e autenticação Suwayomi permanecem pendentes. Encerramento forçado não significa teste de queda de energia/falha física do disco. A retomada reinicia o capítulo incompleto e não continua por bytes/páginas.

Reprodução e pasta alternativa: [DADOS.md](./DADOS.md).

---
## Histórico da entrega 0.5 · 25/10/2026

Instalador: `entrega/Yomi Reader_0.5.0_x64-setup.exe`. SHA256 atual em `entrega/manifesto.json`.

- TypeScript/Vite, release Rust e instalador NSIS compilados.
- **34 testes Rust aprovados**, incluindo persistência da fila após reabrir a biblioteca, descarte com revisão monotônica, validação de conteúdo e rejeição de gravações antigas. O teste opcional com Suwayomi real não foi repetido nesta versão.
- **25 testes frontend aprovados**. Novos casos verificam checkpoints aguardados antes do próximo download, interrupção após falha de gravação, isolamento dos campos persistidos e reconciliação com capítulos já existentes.
- Fluxos anteriores da interface aprovados no Edge.
- Teste de interface online com respostas simuladas aprovado: fila, falhas/cancelamento, limite, fechamento aguardando, recuperação após recarregar sem download automático, retomada que pula um capítulo já gravado, descarte preservando a biblioteca, conflito de revisão, falha de checkpoint impedindo downloads e nova tentativa após recuperação.
- Smoke do executável real aprovado: interface empacotada, Rust/SQLite, leitura da fila, gravação/releitura de um snapshot temporário, rejeição de revisão antiga, limpeza da tarefa de teste, progresso/cancelamento HTTP controlado, remoção parcial e PNG pelo protocolo nativo.

Comando usado:

```powershell
$env:YOMI_SMOKE_DOWNLOADS='1'
$env:YOMI_SMOKE_QUEUE_STORE='1'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Smoke.ps1 -ReadOnly
```

O teste de persistência só grava sua tarefa temporária se não houver uma fila prévia; se houver, preserva-a e pula essa gravação. Nesta execução, a gravação/releitura foi realizada e passou. Ao terminar, não ficou tarefa de teste: a revisão local avança, mas a fila volta a vazia. A biblioteca e as configurações existentes não são alteradas.

A fila usa `downloads.sqlite3`, separada de `yomi.sqlite3`; não muda a versão do banco de leitura. Cada checkpoint usa transação e compara a revisão esperada. Se falhar, não inicia o próximo capítulo. A retomada confere os livros existentes para recuperar a janela entre confirmar um capítulo e salvar seu resultado na fila.

A recuperação completa foi verificada por testes de SQLite com novas conexões/reabertura e por interface simulada após recarregar. Não foi feito um lote real seguido de encerramento forçado e reabertura pela interface instalada. Sites/extensões externos e assistente do instalador permanecem pendentes de validação manual.

Não há download automático ao abrir, execução com a janela fechada, várias filas simultâneas ou retomada por byte/página. Um capítulo incompleto recomeça do início. O backup JSON de leitura não inclui a fila.

---
## Histórico da entrega 0.4 · 25/10/2026

Instalador: `entrega/Yomi Reader_0.4.0_x64-setup.exe`. SHA256 atual em `entrega/manifesto.json`.

- TypeScript/Vite, release Rust e instalador NSIS compilados com sucesso.
- **22 testes frontend aprovados**. Os quatro novos verificam ordem, continuidade após falha, cancelamento, preservação de concluídos, interrupção após gravação e limites/duplicados antes de iniciar.
- **31 testes Rust aprovados**. O teste opcional com Suwayomi real não foi repetido nesta versão; sua aprovação anterior está no histórico 0.3.
- Testes de interface existentes aprovados no Edge sobre a interface compilada.
- Teste online com transporte simulado aprovado: busca, leitor individual, progresso/cancelamento, fila com falha no meio, continuidade dos próximos, repetição apenas dos pendentes, cancelamento que impede os seguintes e preservação dos concluídos.
- O mesmo teste verificou seleção de até 50 entre 60 capítulos, troca de seleção ao atingir o limite, limpeza da seleção, janela de 680px sem rolagem horizontal, botão Cancelar visível e fechamento aguardando a fila ser encerrada.
- Smoke no executável real aprovado: interface embutida, Rust/SQLite, PNG pelo protocolo nativo e HTTP controlado com progresso de 1/2 páginas, cancelamento, limpeza parcial e biblioteca preservada.

Comando do smoke executado:

```powershell
$env:YOMI_SMOKE_DOWNLOADS='1'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Smoke.ps1 -ReadOnly
```

A fila usa os mesmos comandos nativos de download já existentes, um de cada vez. Sua coordenação foi testada com unitários e interface simulada; não foi feito um lote completo de múltiplos capítulos pela interface do aplicativo instalado nem com sites/extensões externos. Essa distinção também vale para os testes anteriores: o smoke HTTP controlado não é uma fonte externa real.

A fila não persiste após sair da tela/reiniciar. Os capítulos concluídos e seu progresso persistem. Não há execução em segundo plano com a janela fechada. O fechamento normal aguarda o encerramento das tarefas; o cancelamento pode aguardar uma resposta HTTP em andamento, com limite de 35 segundos.

O servidor Vite de desenvolvimento temporário não respondeu às navegações; por isso os testes de interface usaram o servidor de prévia da compilação, na porta 1424, que respondeu normalmente. Os servidores temporários foram encerrados após os testes. A janela instalada do usuário foi preservada.

Continuam pendentes: validar o assistente do novo instalador, lote real instalado, fontes externas, desempenho em bibliotecas grandes, login/sincronização Suwayomi, persistência de fila, PDF e tradução.

---
## Histórico da entrega 0.3 · 25/10/2026

Instalador: `entrega/Yomi Reader_0.3.0_x64-setup.exe`. SHA256 em `entrega/manifesto.json`.

- TypeScript/Vite, release Rust e instalador NSIS compilados.
- 31 testes Rust aprovados no conjunto padrão; mais 1 teste opcional com Suwayomi real aprovado separadamente: **32 no total**.
- 18 testes unitários frontend aprovados.
- Testes de interface existentes e teste online aprovados no Edge. O teste online agora verifica 50%, cancelamento, ausência de abertura do leitor após cancelar e nova tentativa bem-sucedida.
- Executável real, em processo/perfil WebView2 próprios: interface, SQLite/IPC, PNG, capa, conexão, fontes, busca e capítulos aprovados.
- Novo teste nativo com HTTP controlado: uma página recebida, progresso 1/2 e bytes corretos; cancelamento aceito; nenhum capítulo novo; pasta parcial removida; registro de tarefa liberado e cancelamento posterior recusado. Biblioteca e configurações existentes preservadas.
- Servidor Suwayomi v2.4.2366 real: download completo, duplicidade, progresso e reabertura continuaram aprovados. Nenhuma extensão/site externo foi instalado/testado.

O cancelamento é cooperativo: verifica o sinal entre leituras e antes de confirmar a transação. Cancelar e confirmar a gravação usam a mesma trava, impedindo aceitar um cancelamento depois da conclusão. Uma operação HTTP em andamento pode aguardar seu limite de 35 segundos. O percentual mede páginas concluídas e permanece abaixo de 100% durante a confirmação final.

Comando do smoke executado com sucesso:

```powershell
$env:YOMI_SMOKE_DOWNLOADS='1'
$env:YOMI_SMOKE_SUWAYOMI_URL='http://127.0.0.1:4589'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Smoke.ps1 -ReadOnly
```

A opção de teste de downloads faz gravações temporárias que são desfeitas pelo cancelamento; não confirma um capítulo nem altera configurações. Usa um PNG existente do Playwright. O servidor real foi iniciado somente com dados isolados e encerrado depois dos testes. A janela instalada do usuário permaneceu aberta.

Assistente do instalador, sites/extensões externos e roteiro manual no aplicativo instalado continuam pendentes. Login, fila, sincronização, PDF e tradução continuam indisponíveis.

---
## Histórico da entrega 0.2 · 25/10/2026

Aplicativo Windows x64 e instalador NSIS compilados: `entrega/Yomi Reader_0.2.0_x64-setup.exe`. SHA256 em `entrega/manifesto.json`.

| Verificação | Resultado |
| --- | --- |
| TypeScript e build Vite | Aprovados |
| Testes unitários frontend | 18 aprovados em 5 arquivos |
| Testes Rust | 28 aprovados, incluindo o teste opcional com servidor real |
| Interface com respostas simuladas | Fluxos existentes e fontes online aprovados no Edge |
| Release e instalador NSIS | Aprovados |
| Executável real no WebView2 | Interface embutida, SQLite/IPC e decodificação de PNG aprovados |
| Suwayomi pelo IPC do executável real | Conexão, fontes, busca, capítulos e capa aprovados |
| Iniciador opcional Suwayomi | API e interface web responderam em porta/pasta isoladas |
| Assistente do novo instalador | Não validado automaticamente |

## Suwayomi real

Foi usada a distribuição oficial Suwayomi Server v2.4.2366, com Java incluído, na porta local 4589, dados isolados em `D:/YomiBuildTools/Suwayomi/test-data` e nenhuma extensão externa instalada. A fonte local recebeu dois PNG válidos já existentes do Playwright, em `local/Yomi Test/Chapter 1/`. Não foram geradas imagens.

O teste Rust opcional verificou conexão, fontes, busca, capítulos, capa, download de duas páginas, gravação do progresso, reabertura da biblioteca SQLite e repetição do download sem duplicar ou perder progresso. Testes HTTP controlados verificaram falha de página com limpeza dos arquivos e banco, erros GraphQL, recusa de autenticação e leitura do capítulo salvo com o servidor indisponível. Os demais testes mantêm a cobertura de importação, lote, organização, marcadores e backup.

No comando normal `pnpm test:rust`, são executados 27 testes; o teste de servidor real fica ignorado por depender de uma fixture externa. Nesta sessão ele foi habilitado explicitamente, e os 28 passaram. Reprodução em [SUWAYOMI.md](./SUWAYOMI.md).

## Interface e executável real

`tests/ui.mjs` cobriu os fluxos anteriores. `tests/online-ui.mjs` cobriu falha/repetição da conexão, fonte local com ID zero, IDs de 64 bits sem perda de precisão, populares, paginação mantendo a busca aplicada, troca de fonte, download e abertura do leitor. Esses testes usam um transporte Tauri em memória.

Como uma versão instalada do usuário estava aberta, o smoke da nova versão foi executado em processo próprio com perfil temporário do WebView2 e opção `-ReadOnly`. A janela do usuário permaneceu aberta. Foram verificados interface empacotada, chamadas reais a `list_books` e `get_settings`, decodificação de um PNG temporário e da capa obtida pelo Rust/Suwayomi, conexão, fontes, busca e capítulos pelo IPC real. O processo exclusivo do teste fechou normalmente e sua imagem/perfil temporários foram removidos.

O modo de consulta não altera os livros nem as configurações do Yomi; a capa pode ficar em cache. O catálogo do Suwayomi atualiza seu próprio cache. O fluxo completo de clicar em baixar/ler no executável instalado permanece uma verificação manual: download e persistência reais foram comprovados pelo teste Rust, e o fluxo visual pelo teste simulado.

Foi corrigida a autorização de imagens quando o Windows redireciona arquivos para o cache do aplicativo que iniciou o processo. Os comandos registram os caminhos reais das capas/páginas conhecidas da biblioteca; a permissão não foi ampliada para pastas arbitrárias do usuário.

Comando final:

```powershell
$env:YOMI_SMOKE_SUWAYOMI_URL='http://127.0.0.1:4589'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Smoke.ps1 -ReadOnly
```

O modo completo, sem `-ReadOnly`, está disponível para servidor isolado e requer que outras janelas do Yomi estejam fechadas. Ele não foi executado nesta sessão.

## Iniciador e ambiente

`scripts/Abrir-Suwayomi.ps1` foi testado na porta 4590, com dados em `helper-test`: API e página inicial responderam. Foi necessário um caminho curto de sockets Java porque a pasta temporária do ambiente era longa. O primeiro início baixou a interface web do próprio Suwayomi. As instâncias de teste foram encerradas ao final; nenhuma instância pessoal ou serviço foi ativado automaticamente.

Rust/Cargo 1.99.1, Visual Studio Build Tools 2022 17.14.42, Windows SDK 10.0.26100.0, Node 24.22.1, pnpm 11.25.0 e WebView2 155.0.4283.62. Java 21 foi obtido para diagnóstico; a validação final usou o Java incluído no servidor portátil. Caminhos de compilação: [AMBIENTE.md](./AMBIENTE.md).

## Pendente

- Validar atualização pelo assistente NSIS e seletores nativos no aplicativo instalado.
- Testar extensões/sites de terceiros e suas configurações individualmente.
- Roteiro manual com mangás reais, bibliotecas grandes, zoom, rolagem e tela cheia.
- Login Suwayomi, fila/cancelamento/percentual de download e sincronização de progresso.
- PDF, plugins executáveis no Yomi, OCR/tradução, backup completo, assinatura digital e atualizador.






## Selene 0.17.0 · 28/10/2026

- TypeScript e build de produção: aprovados.
- Vitest: 30 testes aprovados. Rust: 63 aprovados e 4 testes opcionais ignorados.
- Interface isolada: ordem decrescente persistente, busca exata com zeros e decimais, seleção limitada aos resultados visíveis e busca sem resultados.
- Histórico: cartões com a mesma geometria de Últimas leituras; exclusão de um registro preserva outro capítulo e livro local e permanece após recarregar.
- SQLite: remoção preserva capas compartilhadas e os demais registros após reabrir a biblioteca.
- Capturas: .test-results/chapter-history (capítulos, histórico e janela de 720 pixels).
- Os testes de interface usam dados controlados; não comprovam acesso a capítulos reais nem resolvem verificações de sites.


Aplicativo Windows release 0.17.0: regressão nativa aprovada, incluindo exclusão pela lixeira com confirmação de histórico SQLite vazio. Leitura integrada, retorno ao catálogo, favoritos, categorias, zoom e histórico entre capítulos preservados. Perfil e servidor de teste isolados. Evidências: .test-results/native-source-site-4bcae470-d36c-4ec8-a09b-cb288932d74b.


Entrega: Selene_0.17.0_x64-setup.exe, 204139285 bytes. SHA256: 999EC5DEFCF29B72580662121649F4DEE400E538A0B6208336ACD28CBD8A358D. Instalador gerado; assistente de instalação não executado sobre o perfil do usuário.


## Selene 0.18.0 · 28/10/2026

TypeScript e build de produção aprovados. Teste visual de abertura aprovado: SVG carrega, mensagem aparece, entrada automática funciona, botão permite antecipar e reduzir animações dispensa a espera. Regressão da lista de capítulos e exclusão do histórico também aprovada. Captura inspecionada: .test-results/welcome/opening.png. Nenhum teste novo de Rust necessário: alteração da interface e versão, sem mudanças na lógica nativa.


Regressão nativa Windows 0.18.0 aprovada em perfil isolado: entrada no catálogo após a abertura, leitura integrada e retorno, categorias, favoritos, histórico, exclusão individual, largura e zoom. Evidências: .test-results/native-source-site-9a71ead6-858e-4b91-af17-87ed9f541544. O assistente do instalador não foi executado sobre o perfil do usuário.


Instalador entregue: Selene_0.18.0_x64-setup.exe. SHA256: AD5DE12678721BC063F8A16608BDAD4A87933230DB930E687E6794D2FD1B3B2C.


## Selene 0.18.1 · Abertura mais lenta

Tempo mínimo da abertura ampliado de 2,2 para 6,5 segundos. Entrada da lua em 3 segundos e halo em 3,2 segundos. TypeScript, build e teste de interface aprovados: abertura ainda visível após 3,7 segundos, entrada automática posterior, botão para pular e redução de movimento preservados. Sem mudanças na lógica nativa.


Entrega: Selene_0.18.1_x64-setup.exe. SHA256: F2358FF2D240AF6760EA17AB3A2DF6E56C693A8EE888C112F6816A09253AA637.


## Selene 0.19.0 · Capas e sinopses

TypeScript e build aprovados. Rust: 63 aprovados, 4 testes opcionais ignorados. Teste de interface aprovado com capa carregada, sinopse longa expansível, pesquisa/ordem de capítulos e exclusão de histórico preservadas. Captura inspecionada em .test-results/chapter-history/chapters.png (imagem controlada de teste). A consulta de detalhes passou a solicitar description; valores ausentes e nulos são aceitos. Os dados reais dependem de cada fonte.


Regressão Windows 0.19.0 aprovada em perfil isolado com sinopse retornada pelo servidor controlado e exibida na tela de capítulos, incluindo abertura via Favoritos. Leitura integrada, retorno, categorias e histórico preservados. Evidências: .test-results/native-source-site-a3cde8e9-5047-4bb9-acda-a8aab423f9ba. Fontes reais de terceiros não foram validadas individualmente nesta alteração.


Entrega: Selene_0.19.0_x64-setup.exe. SHA256: 7434846362720F2FFDF50857BEC956B912F6997B5EB47DEF596D8B9191181A42.


## Selene 0.20.0 · Tela cheia e barras

TypeScript e build aprovados. Rust: 63 aprovados e 4 testes opcionais ignorados. Interface online: botão de tela cheia, modo discreto, recuperação e restauração da janela ao voltar aprovados com transporte simulado. Regressão do leitor normal aprovada: tela cheia, esconder cabeçalho/rodapé, recuperar controles, modos de leitura, progresso, marcadores e Guardião. Os testes antigos foram atualizados para os comandos de fila e a entrada padrão pelo catálogo.

A leitura integrada mantém uma faixa mínima de 32 pixels para recuperação dos controles; o capítulo cresce de acordo com a janela e escala do Windows. As barras do próprio site não são removidas.


Regressão nativa Windows aprovada: tela cheia real ativada e desativada; altura do capítulo igual à janela menos 32 pixels com barras ocultas e menos 72 após Mostrar controles. Retorno ao catálogo, histórico e favoritos preservados. Evidências: .test-results/native-source-site-9cbe28da-1f2e-43b9-b608-bed532c06509. Servidor e perfil controlados, sem validar desafios de fontes reais.


Entrega: Selene_0.20.0_x64-setup.exe. SHA256: F508B4C7BD369AC33F24850E8EC7EC1C231262201672E0EEB8BF115703B5731E. O assistente de instalação não foi executado sobre o perfil do usuário.

