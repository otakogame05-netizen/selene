# Backup dos dados de leitura

## O que está incluído

O arquivo JSON guarda progresso, estado de conclusão, favoritos, marcadores de páginas e configurações existentes. Na versão 2, inclui também títulos, séries e capítulos para restaurar a organização. Identificadores, caminhos de origem, formato e quantidade de páginas permitem reconhecer os volumes.

**Não inclui imagens, capas, pastas originais ou arquivos CBZ. Não é uma cópia completa da biblioteca.** Se os arquivos dos mangás forem perdidos, o backup de leitura sozinho não os recupera. Os caminhos locais e o endereço Suwayomi configurado ficam no JSON; considere isso ao compartilhar o arquivo.

## Como exportar

1. Abra **Configurações → Backup dos dados de leitura** no aplicativo desktop.
2. Clique em **Exportar dados de leitura**.
3. Escolha uma pasta fora dos dados internos do Yomi e salve com extensão `.json`.

Nenhum arquivo é enviado para serviços externos. Cancelar a janela de arquivos não altera a biblioteca. A gravação usa um arquivo temporário na pasta escolhida e troca o destino após concluir a escrita. Uma falha de permissão ou escrita é apresentada na interface.

## Como restaurar

1. Importe os mangás que deverão receber o progresso, se eles ainda não estiverem na biblioteca.
2. Em Configurações, clique em **Selecionar backup para restaurar**.
3. Confira a prévia: volumes compatíveis serão restaurados; os demais serão ignorados.
4. Escolha se deseja restaurar também as configurações.
5. Clique em **Confirmar restauração**. Para desistir sem modificar dados, use **Cancelar restauração**.

A prévia não aplica alterações. A restauração substitui progresso, conclusão, favoritos e **a lista completa de marcadores** dos volumes compatíveis; não combina marcadores antigos e novos. Backups da versão 2 substituem também título, série e capítulo na biblioteca, como avisado na prévia. Backups da versão 1 preservam a organização atual. Volumes fora do backup não são alterados. Arquivos e caminhos de origem nunca são renomeados, criados ou apagados pela restauração.

## Como os volumes são reconhecidos

O Yomi procura primeiro o mesmo identificador interno. Se ele não existir, procura o mesmo caminho de origem. O formato e a quantidade de páginas também precisam coincidir. Não há correspondência automática apenas pelo título e não há comparação do conteúdo das imagens.

Assim, remover e reimportar o mesmo caminho pode manter a compatibilidade, mesmo que o identificador interno mude. Mover os mangás para outro caminho ou outro computador pode impedir a correspondência. Vinculação manual entre volumes será uma melhoria futura.

## Cópia anterior e recuperação

Antes de alterar o banco, o Yomi cria um backup de leitura do estado atual em:

```text
%APPDATA%/com.yomi.reader/backups/antes-de-restaurar-<uuid>.json
```

O caminho da cópia é mostrado após a restauração. Para voltar ao estado anterior, selecione essa cópia pelo mesmo fluxo de restauração. Ela também contém apenas dados de leitura, não os mangás.

Se a cópia anterior não puder ser gravada, as alterações no banco não são aplicadas. As alterações de leitura, organização e configurações são agrupadas em uma transação SQLite: uma falha antes do commit cancela a aplicação. Uma cópia anterior pode permanecer no disco mesmo que uma tentativa posterior falhe; ela ainda corresponde ao estado capturado antes da tentativa. Não há remoção automática dessas cópias neste MVP.

Se a biblioteca ou suas configurações mudarem depois da prévia, a confirmação é recusada. Cancele e selecione o arquivo novamente para gerar uma prévia atualizada. Tokens de prévia são temporários e só podem ser usados uma vez após sucesso.

## Validação do arquivo

- Tipo `yomi-reading-backup`. Novos arquivos usam versão 2; a versão 1 continua aceita e preserva a organização atual.
- Até 8 MiB e 10.000 volumes.
- Páginas e marcadores dentro dos limites de cada volume.
- Rejeição de volumes/marcadores duplicados e correspondências que afetariam o mesmo volume mais de uma vez.
- Rejeição de versões futuras e estruturas inválidas antes de modificar dados.

O botão X aguarda operações de backup/restauração em andamento antes do encerramento normal. Encerrar o processo à força ou desligar o computador abruptamente não faz parte dessa proteção.

## Estado da validação

Os fluxos da interface foram testados com transporte Tauri simulado: exportação, cancelamento da seleção, arquivo inválido, prévia, cancelamento da restauração, configurações opcionais e falha com nova tentativa.

**Os dez testes nativos de `src-tauri/src/backup.rs` foram executados e passaram no Windows**, com arquivos/SQLite reais. Incluem rollback após falha forçada, bloqueio quando a cópia anterior não pode ser criada, restauração de organização v2 e compatibilidade v1. O executável também passou na abertura e no IPC real. A execução manual do fluxo completo com os seletores de arquivo do aplicativo instalado continua pendente.

A fila persistente da versão 0.5 fica em downloads.sqlite3 e não faz parte do backup JSON de leitura. Descartar a fila não remove os capítulos já salvos.

