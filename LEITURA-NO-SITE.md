# Leitura da ToonLivre no Yomi 0.13.0

## Como usar

1. Instale a versão 0.13.0 e abra o Yomi.
2. Entre em Biblioteca → Catálogos das fontes e selecione ToonLivre.
3. Escolha o mangá no catálogo e, na lista de capítulos, clique em **Ler online**. Para ToonLivre/Manga Livre, esse botão abre a página do capítulo dentro da janela principal.
4. **Ler no site** também usa a área integrada e está disponível para as outras fontes. **Abrir site no Yomi** abre a página inicial na mesma área, quando precisar.
5. Se aparecer **Verificação de segurança**, conclua-a manualmente na própria página e continue lendo ali. Não é necessário fechar uma janela para tentar novamente.
6. Use **← Voltar ao catálogo**, na barra superior do Yomi. O mangá, a lista de capítulos e a pesquisa são preservados.

Essa opção usa WebView2, o navegador nativo do Windows, como uma área filha na janela principal do Yomi. Não cria outra janela e não requer o download do componente KCEF de aproximadamente 270 MB. A área acompanha o tamanho e a escala da janela, abaixo da barra do leitor. A sessão do site pertence ao perfil de navegação do aplicativo, separado da sessão HTTP da extensão. Desafios, quando houver, precisam ser concluídos pelo usuário.

## Histórico e conforto

Veja [HISTORICO-ONLINE.md](./HISTORICO-ONLINE.md): capítulos abertos agora aparecem em Lidos recentemente, com reabertura, largura confortável ou toda a tela e zoom persistente.

## Limitações

A leitura é a oferecida pelo próprio site: os modos único/duplo/webtoon do leitor local, progresso SQLite, marcadores e download do Yomi não se aplicam a essa janela. Login e eventual progresso no site dependem do serviço. Isso não corrige nem substitui o protocolo de verificação Android da extensão. Os botões Ler online e Baixar e ler continuam usando o motor e podem falhar independentemente da navegação direta.

A página remota não recebe permissões de acesso à biblioteca. Ao voltar ao catálogo, a área é ocultada e mantida para reutilização. O catálogo recupera tamanho, visibilidade e foco. A área fecha ao sair do aplicativo ou encerrar a sessão do motor. Não são copiados cookies para a extensão nem credenciais internas para o site.

## Diagnóstico corrigido

Os testes HTTP simples retornaram redirecionamento para um domínio sem resolução, mas um navegador real abriu a ToonLivre com HTTP 200. Portanto, não se deve concluir indisponibilidade geral com base no curl. O usuário confirmou acesso pelo celular no mesmo Wi-Fi. Veja DIAGNOSTICO-TOONLIVRE.md para os resultados e limites.
