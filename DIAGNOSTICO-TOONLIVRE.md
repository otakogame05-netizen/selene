# ToonLivre: diagnóstico em 26/10/2026

## Correção do diagnóstico: acesso funciona no navegador

Após o usuário confirmar que o celular abre a fonte no mesmo Wi-Fi, foi feito teste com Edge/Chromium em sessão isolada (perfil novo). Tanto o contexto desktop quanto o móvel receberam HTTP 200 em `https://toonlivre.net/`, sem redirecionamento, com o título `ToonLivre | Manhwas e Webtoons em português`.

Portanto, os resultados de DNS/curl abaixo **não demonstram indisponibilidade geral da fonte**. O comportamento depende do contexto de acesso; não foi isolada a condição exata que provoca a diferença. O navegador remoto KCEF e os testes HTTP não devem ser tratados como equivalentes à navegação normal. O projeto passou a oferecer navegação direta em WebView2, separada da sessão da extensão, sem afirmar que essa mudança corrige o leitor via API.

Os registros anteriores são mantidos como evidência dos testes que falharam, com essa limitação explícita.

Verificação feita às 21h37 (America/Sao_Paulo), a partir da máquina do usuário.

- `https://toonlivre.net/` respondeu HTTP 302 com `Location: https://www.mangalivre.net`.
- `https://toonlivre.net/mangas` apresentou o mesmo redirecionamento para a raiz, sem preservar o caminho.
- `www.mangalivre.net` retornou NXDOMAIN no resolvedor local e na consulta ao DNS público 1.1.1.1.
- `https://mangalivre.net/`, sem www, respondeu HTTP 200, mas mostrou uma página de indicação de plataformas oficiais (MangaPlus, Comikey, JBC e Toomics), sem o antigo leitor. Também foi confirmada por consulta pública à página.

Isso explica por que digitar toonlivre.net na janela volta ao endereço antigo e continua falhando. O erro atual da imagem é de DNS após redirecionamento; não é evidência de um desafio Cloudflare pendente.

Não foi aplicada substituição automática de domínio: trocar mangalivre.net por toonlivre.net criaria um ciclo de navegação. Remover www abriria outra página, sem restaurar o leitor da extensão.

Não há, nesta verificação, endereço funcional confirmado para recuperar a leitura pela fonte. Não é possível afirmar encerramento permanente do serviço apenas por esses resultados. É necessário que o serviço restabeleça um destino com leitor/API, ou que os mantenedores publiquem uma atualização com outro endereço confirmado.

Nenhum dado do usuário, extensão ou instalação foi alterado. Nenhum novo instalador foi gerado: não há correção comprovada do serviço para embutir.

## Investigação complementar às 21h48

- A pasta de extensões do motor contém `tachiyomi-pt.mangalivre-v1.6.89.jar`. O código público atual declara libVersion 1.6 e versionCode 89. Não foi identificada diferença de versão que justifique simplesmente pedir outra atualização.
- GET com identificação comum de navegador desktop e móvel também retornou 302 para `https://www.mangalivre.net`. O caminho público `/api/mangas` apresentou o mesmo redirecionamento. Isso não comprova que todas as redes ou sessões recebam a mesma resposta.
- O código atual de `MangaLivre.kt` tenta a API de acesso ao capítulo e, quando a resposta exige verificação, chama uma `ReaderVerificationActivity` por Intent Android e aguarda as páginas via ResultReceiver. Essa atividade usa Android WebView. É uma dependência específica a investigar para compatibilidade desktop; não foi demonstrado que ela seja a causa do erro atual, que ocorre antes.
- A janela KCEF adicionada ao Yomi não implementa esse contrato Android da extensão. Abrir uma página e obter um resultado de atividade para a extensão são operações diferentes.
- Foi solicitado teste manual no celular, distinguindo mesmo Wi-Fi de dados móveis. É necessário comparar um acesso funcional atual antes de atribuir o redirecionamento exclusivamente ao site, à rede ou à sessão. Não foi confirmado endereço alternativo nem recuperação do leitor.

Código consultado:

- https://github.com/keiyoushi/extensions-source/blob/main/src/pt/mangalivre/build.gradle.kts
- https://github.com/keiyoushi/extensions-source/blob/main/src/pt/mangalivre/src/eu/kanade/tachiyomi/extension/pt/mangalivre/MangaLivre.kt
- https://github.com/keiyoushi/extensions-source/blob/main/src/pt/mangalivre/src/eu/kanade/tachiyomi/extension/pt/mangalivre/ReaderVerificationActivity.java

Referências:

- Site consultado: https://toonlivre.net/
- Destino do redirecionamento: https://www.mangalivre.net/
- Página disponível sem www: https://mangalivre.net/
- Histórico da migração de domínio (não comprova disponibilidade atual): https://github.com/keiyoushi/extensions-source/issues/15082
