# Próximos passos do Selene

## Para começar a usar

O instalador Windows x64 já foi gerado:

```text
entrega/Selene_0.20.0_x64-setup.exe
```

Execute o arquivo e siga o assistente. Depois abra **Selene**. Para usar o aplicativo, os compiladores e o Node não são necessários; o WebView2 já está disponível neste computador.

## Primeiro teste com seus arquivos

1. Importe uma pasta pequena de imagens, um CBZ e um PDF sem senha pelo menu da biblioteca.
2. Confira capa, ordem das páginas, os quatro modos, zoom e direção.
3. Marque uma página, avance, feche o aplicativo e abra novamente.
4. Confira retomada, marcadores, tema e favoritos.
5. Edite uma série/capítulo e teste os filtros.
6. Exporte dados de leitura e revise a prévia antes de restaurar.
7. Experimente um lote pequeno de CBZ e confira o relatório.

Os testes Rust, o build Windows e o smoke real já passaram. O roteiro acima e a execução do assistente de instalação ainda não foram feitos automaticamente. Resultados detalhados: [VALIDACAO.md](./VALIDACAO.md).

## Recompilar neste computador

As ferramentas foram instaladas e configuradas no D:. O projeto carrega `local-build.json` automaticamente nos seus comandos:

```powershell
pnpm run doctor
pnpm test
pnpm test:rust
pnpm desktop:build
pnpm test:smoke
pnpm deliver
```

`pnpm deliver` copia o instalador compilado para `entrega/`. Use `pnpm desktop` para abrir em desenvolvimento. Detalhes dos caminhos e instruções para outros computadores: [AMBIENTE.md](./AMBIENTE.md).

## Prioridades sugeridas

| Ordem | Próximo trabalho | Motivo |
| --- | --- | --- |
| 1 | Aprimorar leitura online | Cache por demanda já disponível; faltam gestão de espaço global, pré-carregamento configurável e preferências avançadas de fontes |
| 2 | Seleção/migração guiada da pasta de dados e backup completo | A opção --data-dir já permite outro disco; ainda não há migração pela interface e o JSON não inclui mangás |
| 3 | Miniaturas e leitura contínua virtualizada | Reduzir memória e acelerar coleções grandes |
| 4 | Descoberta de capítulos e edição coletiva | Complementar a organização manual e o lote de CBZ já implementados |
| 5 | Aprimorar fontes integradas | Preferências e login de fontes, múltiplas filas e sincronização; motor, Java e gerenciador de extensões agora incluídos |
| 6 | Aprimorar PDF | Importação já disponível no Windows; faltam percentual, cancelamento e escolha de resolução |
| 7 | Tradução e plugins | Definir provedores, permissões, processamento local/online e custos |

O Guardião atual oferece lembretes de pausa. Outras funções do planejamento antigo ainda precisam de especificação.

Guias: [séries e capítulos](./SERIES.md), [importação em lote](./IMPORTACAO.md) e [backup de leitura](./BACKUP.md).
Fontes e extensões: [SUWAYOMI.md](./SUWAYOMI.md). Comece por **Fontes online → Ativar fontes integradas** na edição completa. Não precisa configurar Suwayomi externo. Veja [FONTES-INTEGRADAS.md](./FONTES-INTEGRADAS.md).






