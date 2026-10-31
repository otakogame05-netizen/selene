# Leitura online no Yomi 0.10

Use **Ler online** para carregar páginas sob demanda. A última fonte e a ativação do motor ficam salvas; ao retornar a Fontes online, a conexão integrada é restaurada. Os repositórios e extensões instalados já permanecem na pasta de dados, sem precisar adicionar novamente. **Baixar e ler** completa o mesmo volume para uso offline. Guia atual: [FONTES-INTEGRADAS.md](./FONTES-INTEGRADAS.md).

As seções abaixo registram o comportamento das versões anteriores.

---

# Fontes integradas no Yomi 0.9

A edição completa agora inclui o motor e o Java: instale apenas o Yomi e use **Fontes online → Ativar fontes integradas**. Repositórios, catálogo e instalação/atualização/remoção de extensões estão na própria tela. Leia [FONTES-INTEGRADAS.md](./FONTES-INTEGRADAS.md).

Ainda é necessário baixar o capítulo inteiro antes de ler. Leitura progressiva permanece pendente.

O roteiro abaixo documenta a conexão **opcional com servidor externo** das versões anteriores; não é necessário para o motor incluído na edição 0.9.

---

# Fontes e extensões no Yomi 0.7

O Yomi agora conecta a um servidor Suwayomi, lista suas fontes instaladas, busca mangás, mostra capítulos e baixa um capítulo inteiro para a biblioteca local. Neste modo externo, as extensões rodam no servidor escolhido.

## Como usar

1. Obtenha o Suwayomi Server na [página oficial de versões](https://github.com/Suwayomi/Suwayomi-Server/releases). Extraia a edição portátil para Windows x64.
2. Inicie o servidor. Para executar somente neste computador com o ajuste de Java usado nos testes, veja o script abaixo.
3. Abra a interface do Suwayomi em `http://127.0.0.1:4567`. Nas configurações de extensões, adicione o endereço do repositório que você escolheu. Nenhum repositório é fornecido ou instalado pelo Yomi.
4. Na área de extensões do Suwayomi, instale a extensão desejada. Configure idioma e preferências da fonte na própria interface dele, quando necessário.
5. No **Yomi Reader 0.7**, abra **Fontes online**. Informe `http://127.0.0.1:4567` e clique em **Conectar**.
6. Escolha uma **Fonte**, digite o título e clique em **Buscar**. Deixe o campo vazio para consultar populares. Abra o mangá e escolha **Baixar e ler** no capítulo.
7. Aguarde o download completo. O leitor abre automaticamente; ao voltar, o capítulo fica na biblioteca. Você pode fechar o servidor e continuar lendo os capítulos já salvos.

Depois de instalar uma extensão nova, clique novamente em **Conectar** no Yomi para atualizar a lista. A fonte local incluída no Suwayomi aparece mesmo sem extensões externas; ela mostra apenas arquivos colocados na pasta local do servidor.

## Iniciar a edição portátil neste computador

Foi baixada uma cópia oficial do Suwayomi v2.4.2366 para os testes. O teste usou dados isolados e a porta 4589; não configurou uma coleção pessoal nem instalou extensões externas.

O script opcional abaixo inicia uma instância pessoal na porta 4567, com dados separados em `%APPDATA%/YomiSuwayomi`, usando a edição portátil já extraída:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Abrir-Suwayomi.ps1 -RuntimePath "D:/YomiBuildTools/Suwayomi/runtime/Suwayomi-Server-v2.4.2366-windows-x64"
```

Depois abra `http://127.0.0.1:4567` no navegador. O script mantém o servidor em segundo plano somente neste computador; não instala serviço nem inicialização automática. Ele imprime o PID e a pasta dos logs. Para encerrar, use `Stop-Process -Id NUMERO_DO_PID` ou encerre esse processo Java no Gerenciador de Tarefas. Não encerre outros processos Java.

O iniciador foi testado em outra porta e pasta isoladas: a API e a página web responderam. No primeiro início, o Suwayomi pode baixar sua interface web; aguarde antes de abrir a página. A instalação/configuração de extensões pela interface continua sendo uma etapa do usuário.

## Limites desta versão

- Servidores sem login ou Basic Auth. Credenciais somente em memória; cookies/JWT ainda não suportados. O script limita a escuta a `127.0.0.1`. Veja LOGIN-SUWAYOMI.md.
- Busca em uma fonte por vez, catálogo com paginação e lista de capítulos. Sem filtros próprios de cada extensão, busca global ou assinaturas de atualização.
- O capítulo inteiro precisa terminar de baixar para abrir; há percentual por páginas concluídas, contagem de páginas/MiB e botão Cancelar download. A fila é salva e pode ser retomada manualmente; a execução exige a janela aberta. Não há streaming nem serviço em segundo plano.
- Até 1.000 páginas por capítulo, 64 MiB por página e 1 GiB por capítulo. Respostas e conexões têm limites de tamanho e tempo.
- Progresso, favoritos e marcadores ficam no Yomi; não são sincronizados com o Suwayomi.
- Remover um capítulo no Yomi apaga sua cópia local e seu progresso no Yomi; não remove o mangá no servidor.
- Capas do catálogo ficam em cache local por até 24 horas. Capítulos salvos não são atualizados automaticamente se a fonte trocar suas páginas.
- Sites e extensões de terceiros não foram testados individualmente. A validação real utilizou a fonte local do Suwayomi e um PNG existente do Playwright, sem mangás externos ou imagens geradas.
- A instalação e execução direta de plugins no Yomi, PDF, OCR e tradução continuam indisponíveis.

## Se não aparecerem mangás

**Erro de conexão:** confirme que o Suwayomi está aberto, o endereço e a porta são os mesmos e o modo de autenticação está correto. Basic está disponível na versão 0.7; cookies/JWT ainda não.

**Só aparece Local source:** instale uma extensão no Suwayomi e reconecte o Yomi. Arquivos APK não devem ser importados pelo menu de CBZ.

**A fonte aparece, mas a busca falha:** tente a mesma busca na interface do Suwayomi. A extensão pode exigir atualização, configuração ou interação própria. O Yomi mostra os erros retornados pelo servidor.

**Porta ocupada:** o script recusa iniciar outra instância. Confira o servidor já aberto antes de escolher outra porta e informar o mesmo endereço no Yomi.

## Repetir o teste real de integração

Com um Suwayomi isolado em `http://127.0.0.1:4589`, coloque dois PNG válidos em `local/Yomi Test/Chapter 1/` na pasta de dados dele:

```powershell
. ./scripts/BuildEnv.ps1
$env:YOMI_SUWAYOMI_TEST_URL = 'http://127.0.0.1:4589'
cargo test --manifest-path src-tauri/Cargo.toml real_server_catalog_download_and_offline_progress -- --ignored
$env:YOMI_SMOKE_SUWAYOMI_URL = 'http://127.0.0.1:4589'
pnpm test:smoke
```

O teste Rust usa uma biblioteca SQLite temporária. O smoke nativo cria apenas seu capítulo de teste, valida leitura e progresso e remove esse capítulo ao terminar, restaurando as configurações anteriores. Não execute contra uma coleção pessoal com um mangá chamado Yomi Test.

## Progresso e cancelamento (0.3)

Durante o download, a barra mostra o percentual por páginas concluídas, a contagem de páginas e o tamanho já concluído em MiB. Ela pode ficar parada enquanto uma página grande está sendo recebida; não é um percentual por bytes. Na fase final aparece Salvando.

Use **Cancelar download** para interromper. Uma resposta HTTP em andamento pode levar até 35 segundos para terminar ou expirar. O Yomi limpa os arquivos parciais antes de avisar que cancelou, sem cadastrar um capítulo incompleto. Se a gravação final já terminou, o cancelamento não é aceito e o capítulo abre normalmente. O Suwayomi pode continuar finalizando uma requisição própria.

O teste nativo de cancelamento com HTTP controlado pode ser repetido definindo a variável YOMI_SMOKE_DOWNLOADS como 1 e executando scripts/Smoke.ps1 -ReadOnly. Ele cria páginas temporárias, cancela após a primeira e confirma que arquivos e coleção voltaram ao estado anterior.


## Fila de capítulos (0.4)

1. Conecte e abra um mangá em Fontes online.
2. Marque os capítulos desejados, ou use **Selecionar até 50**. Capítulos já salvos ficam fora da seleção.
3. Clique em **Baixar selecionados**. A fila segue a ordem exibida, um capítulo por vez; não abre o leitor automaticamente.
4. A barra fixa mostra o capítulo atual e seu progresso. O relatório identifica Salvo, Falhou, Cancelado ou Não iniciado.
5. Use **Cancelar fila** para interromper o atual e impedir os seguintes. Os capítulos concluídos são preservados; a resposta atual pode aguardar até 35 segundos.
6. Use **Tentar pendentes novamente** para tentar apenas os que falharam, foram cancelados ou não chegaram a iniciar. Os salvos não são baixados novamente.
7. Ao terminar, abra os capítulos pela Biblioteca ou por **Ler salvo**.

Limite: 50 capítulos de um mangá por fila. Uma falha não impede os próximos, a menos que você cancele. A tarefa e seus estados são salvos localmente. Depois de sair da tela ou reiniciar, use Retomar fila salva. Os capítulos concluídos e seu progresso continuam na biblioteca. Não há início automático dos downloads. Durante a fila, a navegação fica bloqueada para manter a tarefa visível. O fechamento normal aguarda a tarefa terminar; para sair antes, cancele a fila.

## Retomar depois de reiniciar (0.5)

A área **Retomada da fila**, no início de Fontes online, mostra a tarefa salva e seu servidor. Clique em **Retomar fila salva** com o mesmo Suwayomi aberto. Nenhuma conexão externa é iniciada apenas por abrir essa tela.

Antes de cada capítulo e após cada resultado, o Yomi grava um ponto de recuperação em SQLite. A retomada compara a fila com os capítulos da biblioteca e ignora os já concluídos, inclusive quando a gravação do capítulo terminou antes de salvar o resultado na fila. Um capítulo incompleto recomeça do início; não há retomada por página ou byte.

**Descartar fila** remove somente a tarefa pendente. Os capítulos já baixados permanecem. **Recarregar fila** relê os dados locais, inclusive após um conflito com outra janela. Uma fila pendente precisa ser retomada ou descartada antes de criar outra. A tarefa é removida automaticamente quando todos os seus capítulos estão salvos.

A fila fica em `%APPDATA%/com.yomi.reader/downloads.sqlite3`, separada do banco de leitura. O backup JSON dos dados de leitura não inclui esse arquivo nem a fila. Mantenha o mesmo endereço e a mesma base de dados do Suwayomi: a tarefa guarda os identificadores dos mangás/capítulos desse servidor.

Na versão 0.6, a retomada foi validada no aplicativo Windows com encerramento forçado e três aberturas. Também há limpeza de parciais identificados ao retomar o mesmo capítulo. Detalhes, limites e pasta alternativa: [DADOS.md](./DADOS.md).


Login Basic, sessão em memória, saída e retomada autenticada: [LOGIN-SUWAYOMI.md](./LOGIN-SUWAYOMI.md).

