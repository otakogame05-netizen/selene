# Importação de vários CBZ

## Como usar

1. No aplicativo desktop, abra **Importar mangá → Vários arquivos CBZ**.
2. Selecione até **50 arquivos `.cbz`** na mesma janela.
3. Aguarde o processamento. Cada arquivo é importado individualmente, em ordem natural pelo nome.
4. Confira o resultado: **Adicionado**, **Já existente** ou **Falhou**.

O relatório pode ser filtrado para mostrar somente falhas, adicionados ou existentes. Depois de fechar, use **Ver resultado do último lote** abaixo da biblioteca para reabri-lo. O relatório fica apenas na sessão atual; não é mantido ao reiniciar o aplicativo nem incluído no backup de leitura.

## O que acontece em cada caso

- **Adicionado:** o CBZ foi copiado para a biblioteca interna e cadastrado como um volume.
- **Já existente:** o caminho canônico de origem já estava cadastrado. O volume existente, seu progresso, favoritos, marcadores e organização são preservados.
- **Falhou:** o arquivo não foi importado. O relatório mostra o motivo. Os outros arquivos continuam sendo processados.

Uma falha não desfaz as importações que já deram certo. Ao tentar novamente um lote misto, os caminhos já importados aparecem como existentes, sem criar uma nova cópia. Arquivos iguais em caminhos diferentes ainda podem ser importados como volumes distintos; não há deduplicação pelo conteúdo.

Uma seleção acima de 50 arquivos é recusada antes de importar qualquer arquivo. Cancelar o seletor também não altera a biblioteca. Durante o processamento, aguarde o resultado: não há cancelamento de um lote já iniciado. O botão X aguarda a operação antes do encerramento normal.

## Limites e organização

O lote processa um arquivo de cada vez e usa os limites da importação individual: 10.000 páginas, 64 MiB por imagem, 1 GiB de conteúdo descomprimido por volume e 50.000 entradas ZIP. Os limites são por volume; o conjunto selecionado pode ocupar mais espaço no disco. CBZ com ZIP Stored/Deflate é suportado; formatos ZIP não suportados e arquivos danificados produzem erro por arquivo.

Os arquivos originais são preservados. Falhas controladas limpam a cópia parcial daquele volume. Interromper o processo à força pode deixar arquivos órfãos, como na importação individual.

Cada CBZ corresponde a um volume. Série e capítulo continuam sendo definidos manualmente pelo ícone de lápis; não há descoberta automática pelo nome. A importação de pastas permanece individual e concatena subpastas no mesmo volume.

Durante a importação, os cartões e a navegação de seções ficam temporariamente indisponíveis. Ao concluir um lote, a biblioteca é atualizada, os filtros são limpos e a ordenação passa a **Adicionados** para mostrar a coleção importada. O resumo mostra somente o resultado final, sem uma porcentagem simulada de progresso.

## Estado da validação

A interface foi testada com transporte Tauri simulado: cancelamento, seleção recusada, relatório misto, filtro de falhas, reabertura do resultado, nova tentativa com duplicados, lote com todas as falhas e espera no fechamento.

Os três testes nativos de `src-tauri/src/batch.rs` foram executados e passaram no Windows com CBZ/arquivos reais. Cobrem lote misto, preservação dos dados existentes, ordem natural, limite de seleção, caminhos repetidos e arquivos ausentes/não suportados. O seletor múltiplo do aplicativo instalado e a revisão manual do relatório continuam pendentes. A decodificação real de um PNG pelo protocolo local foi validada separadamente no smoke test do executável.


## PDF no Windows

Desde a versão 0.8, use **Importar mangá → Arquivo PDF** para um PDF sem senha por vez. A importação em lote continua exclusiva de CBZ. Veja resolução, limites e requisitos em [PDF.md](./PDF.md).
