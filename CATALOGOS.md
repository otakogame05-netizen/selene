# Catálogos e favoritos · Selene 0.16.0

O Selene abre em **Catálogos das fontes**. **Meus mangás** fica na segunda aba e reúne seus arquivos e capítulos registrados no leitor local.

## Pesquisar sem ocupar a tela

Escolha a fonte e o idioma no campo **Fonte**, ao lado da pesquisa. Com a pesquisa vazia, aparecem os populares fornecidos pela fonte. A última fonte escolhida continua salva. Não há mais uma lista grande de botões para todos os idiomas.

Digite o título e clique em **Buscar**. Ao trocar de fonte, a pesquisa é mantida e a consulta começa na primeira página. **Anterior** e **Próxima** percorrem os resultados da fonte selecionada.

**Ações da fonte** fica recolhido por padrão. Expanda quando precisar abrir a página inicial ou usar a verificação do motor. A instalação e atualização de extensões continuam em **Fontes online**.

Se o motor já estiver ativado, o catálogo reconecta ao iniciar. Na primeira configuração, use **Abrir catálogos** e instale suas extensões em Fontes online. Não há instalação automática de fontes de terceiros.

## Populares, Atualizados e Filtro

- **Populares** usa a lista de popularidade fornecida pela fonte. Algumas fontes classificam por visualizações totais; o Selene não apresenta isso como ranking diário próprio.
- **Atualizados** usa a lista de obras com capítulos recentes. No seletor ao lado, **Novas obras** usa a ordenação de lançamentos quando disponível. Fontes sem essas opções mostram o controle desabilitado.
- **Filtro** abre o seletor de gênero obtido da extensão. A seleção é enviada ao servidor para pesquisar o catálogo da fonte, não aplicada apenas às capas já carregadas. Busca e paginação preservam o gênero e a categoria; mudar categoria volta à primeira página e limpa o texto de pesquisa. Trocar de fonte limpa categoria/gênero e preserva o texto de busca.

As combinações de gênero com atualizações dependem das ordenações oferecidas pela fonte. Quando não suportadas, o seletor é desabilitado e o aplicativo explica a limitação. É possível limpar o gênero ou usá-lo em Populares.

A extensão atual da ToonLivre oferece Mais Visualizados, Lançamentos e Última Atualização, mas não expõe gêneros. O Selene informa essa ausência. Fontes compatíveis, como as que fornecem grupos de gêneros, apresentam suas opções reais. A consulta pode ser recarregada manualmente se falhar.

Referências técnicas da integração:

- https://github.com/Suwayomi/Suwayomi-Server/blob/v2.4.2366/server/src/main/kotlin/suwayomi/tachidesk/graphql/types/SourceType.kt
- https://github.com/Suwayomi/Suwayomi-Server/blob/v2.4.2366/server/src/main/kotlin/suwayomi/tachidesk/graphql/mutations/SourceMutation.kt
- https://github.com/keiyoushi/extensions-source/blob/main/src/pt/mangalivre/src/eu/kanade/tachiyomi/extension/pt/mangalivre/MangaLivre.kt
## Favoritar um mangá

Clique no coração sobre a capa, ou em **Favoritar** nos detalhes do mangá. O coração preenchido indica que está salvo. Em **Favoritos**, os mangás das fontes aparecem com sua fonte e idioma; clique na capa para abrir seus capítulos.

O favorito guarda a origem correta e permanece salvo após fechar o aplicativo. Um mesmo ID em fontes diferentes corresponde a favoritos distintos. Clique no coração novamente para remover apenas esse favorito; arquivos e histórico não são apagados.

Favoritar não baixa capítulos nem importa o catálogo inteiro. A busca e a leitura dependem da fonte instalada, do servidor e do site. Um favorito de servidor externo pode exigir reconexão em Fontes online. Se a fonte tiver sido removida, ela precisa ser reinstalada para buscar capítulos.

Os favoritos online ficam no SQLite do aplicativo, separados dos favoritos de volumes locais. O backup JSON de leitura local ainda não inclui os favoritos online. O leitor integrado da ToonLivre mantém as limitações descritas em HISTORICO-ONLINE.md.
## Capítulos · 0.17.0

Use Número do capítulo para localizar um número exato (10 não inclui 100). Zeros à esquerda e decimais como 10,5 são aceitos. Ordem alterna do menor para o maior e do maior para o menor, e é lembrada. Selecionar até 50 usa os resultados visíveis; alterar a busca limpa a seleção.

