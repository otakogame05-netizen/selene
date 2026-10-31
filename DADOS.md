# Pasta de dados e recuperação · Yomi 0.6

Por padrão, os dados continuam em `%APPDATA%/com.yomi.reader/`. A versão 0.6 também aceita uma pasta absoluta ao iniciar:

```powershell
& 'D:/Yomi Reader/yomi-reader.exe' --data-dir 'D:/Minha biblioteca Yomi'
```

Ajuste o caminho do executável à instalação. O exemplo abre outra biblioteca nessa pasta, com banco, imagens, configurações e fila próprios. **Não copia nem migra automaticamente a biblioteca atual.** Use o mesmo parâmetro sempre que quiser essa biblioteca; iniciar sem ele usa a pasta padrão. Uma pasta inexistente é criada se houver permissão.

Não é necessário usar esse parâmetro para a leitura normal. A escolha/migração por uma tela do programa continua planejada. O backup JSON continua contendo somente os dados de leitura previstos em BACKUP.md, sem imagens ou fila.

## Recuperação após interrupção

A fila salva é recuperada manualmente em Fontes online → Retomar fila salva. Capítulos já gravados são ignorados; o incompleto recomeça do início.

Os downloads criados pela versão 0.6 mantêm uma identificação interna e um arquivo aberto com exclusividade no Windows. Ao tentar novamente o mesmo capítulo, o Yomi pode remover seu diretório parcial se o processo antigo já terminou e não há livro registrado para aquele diretório. Um download ativo continua protegido. Capítulos registrados, pastas de outra origem, pastas sem identificação e dados de versões anteriores sem esse marcador não são apagados por essa limpeza.

A limpeza não é uma varredura geral do computador e não remove mangás originais importados. Ela atua nos diretórios internos identificados do capítulo que está sendo retomado. Descartar a fila remove a tarefa; não é um comando de limpeza geral do cache.

## Teste real isolado

```powershell
pnpm test:recovery
```

Esse teste inicia o executável release com `--data-dir` em uma pasta temporária do projeto e perfil próprio do WebView2. Não utiliza a biblioteca pessoal. Um servidor HTTP local controlado fornece a API e PNGs já existentes do Playwright; não é um site externo nem uma extensão real.

O teste baixa o primeiro de três capítulos, interrompe o processo durante o segundo, reabre e retoma somente os pendentes. Depois lê uma página, fecha e abre novamente, verificando o progresso. Também confere ausência de duplicados e diretórios órfãos. Somente o processo de teste é encerrado à força.

Em caso de sucesso, a pasta temporária é removida e o resumo fica em `.test-results/latest-recovery.json`. Se falhar, os dados e logs isolados são preservados para diagnóstico. A pasta é ignorada pelo Git. São necessários o executável compilado, Node e Playwright já presentes no ambiente de desenvolvimento.
