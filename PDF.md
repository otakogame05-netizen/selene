# PDF no Yomi Reader 0.8

Na biblioteca, escolha **Importar mangá → Arquivo PDF** e selecione um arquivo sem senha. Aguarde a conversão antes de fechar o aplicativo. O volume aparece com a primeira página como capa.

O Yomi usa o conversor PDF do próprio Windows, por meio do Windows PowerShell, em um processo oculto. Não precisa de Adobe Reader, servidor, conexão com a internet ou instalação adicional de um motor de PDF. Se uma política do computador bloquear o PowerShell ou o recurso PDF do Windows estiver indisponível, a importação falhará com uma mensagem.

Cada página é convertida em PNG, mantendo a proporção, com 2.000 pixels no lado maior. As cópias ficam na biblioteca interna: depois da importação você pode ler sem o original. Os modos único, duplo, vertical e webtoon, favoritos, progresso e marcadores funcionam como nos volumes CBZ. Não há seleção de texto, pesquisa dentro do PDF, OCR, links interativos ou tradução. A ampliação fica limitada à resolução convertida.

Limites desta versão:

- Um PDF por seleção, com até 512 MiB no original e entre 1 e 1.000 páginas.
- Até 64 MiB por página convertida e 1 GiB por volume.
- Até cinco minutos para converter. Para arquivos maiores ou demorados, divida o PDF antes de importar.
- Arquivos com senha não são suportados. Não há barra de percentual nem cancelamento de conversão nesta versão.

Falhas removem a pasta parcial e não adicionam um volume incompleto. O original não é alterado. Reimportar o mesmo caminho preserva o volume e seus dados de leitura; não reconverte o conteúdo. Para atualizar páginas, remova o volume da biblioteca e importe novamente, sabendo que a remoção também apaga seu progresso e marcadores locais.

O backup JSON inclui os dados de leitura do volume PDF, mas não inclui o arquivo original nem as páginas PNG. Guarde os originais separadamente.

Implementação baseada na [API PDF do Windows](https://learn.microsoft.com/en-us/uwp/api/windows.data.pdf.pdfpage.rendertostreamasync).
