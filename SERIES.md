# Organização por séries e capítulos

## Como organizar

1. Importe uma pasta de imagens ou um CBZ no aplicativo desktop.
2. Clique no lápis **Editar** no cartão do volume.
3. Ajuste o título e informe a série. O campo sugere nomes já usados na biblioteca.
4. Informe o capítulo ou volume: por exemplo `2`, `2.5`, `Especial` ou `Vol. 1`.
5. Salve. Os nomes dos arquivos e pastas originais não mudam.

Para manter um volume avulso, deixe **série e capítulo em branco**. Um capítulo preenchido exige uma série. Salvar mantém progresso, favoritos e marcadores.

Limites: 512 caracteres no título, 256 na série e 80 no capítulo. Título obrigatório; espaços extras são normalizados. Uma falha ao salvar mantém o formulário aberto para nova tentativa.

## Como encontrar e ordenar

- A busca considera título, série e capítulo, ignorando diferenças entre maiúsculas/minúsculas e acentos.
- **Filtrar por série** permite ver todas as séries, uma série específica ou somente avulsos.
- Os filtros de favoritos e estado de leitura podem ser combinados com série e busca.
- **Série e capítulo** usa ordem natural nos rótulos: `2` antes de `10`.
- Volumes sem capítulo ficam depois dos capítulos identificados da mesma série. Avulsos ficam depois das séries nessa ordenação.
- Clicar no nome da série em um cartão abre os volumes dessa série, limpa os outros filtros e ordena por capítulo.

Nomes com diferenças apenas de maiúsculas e espaços são agrupados. Acentos diferentes continuam sendo nomes de série diferentes para agrupamento, embora a busca encontre ambos. Rótulos especiais e números compostos usam ordem textual natural, sem interpretação editorial.

## Limites atuais

Cada arquivo CBZ ou pasta importada continua correspondendo a um volume. É possível selecionar até 50 CBZ de uma vez pelo menu **Vários arquivos CBZ**; veja [IMPORTACAO.md](./IMPORTACAO.md). Subpastas ainda são concatenadas, sem separar capítulos automaticamente. Não há detecção de série pelo nome do arquivo, edição coletiva ou passagem automática para o próximo capítulo.

Capítulos com o mesmo rótulo são permitidos; os empates são ordenados por título. Corrigir o nome de uma série em vários volumes exige editar cada volume nesta versão.

## Banco e backup

O esquema SQLite é a versão 3. A migração cria `book_details`, preservando os dados das versões 1 e 2. Ao remover um volume, sua organização é apagada em cascata.

Novos backups JSON usam versão 2 e restauram título, série e capítulo, como avisado na prévia. A cópia anterior automática permite recuperar a organização anterior.

Backups JSON da versão 1 continuam aceitos e preservam os títulos, as séries e os capítulos atuais. Uma edição de organização após gerar uma prévia invalida essa prévia.

## Validação

Os testes de interface usam backend simulado. Foram verificados edição, validação, falha e nova tentativa, cancelamento, busca, filtros, opção de ordenação e avisos das versões de backup. Os testes unitários verificam agrupamento, ordem natural e combinação dos filtros.

Os testes nativos de migração, persistência e restauração foram executados e passaram no Windows. O executável e o instalador foram gerados, e o smoke test confirmou a abertura e o IPC real. A revisão manual completa dos controles de organização no aplicativo instalado continua pendente.
