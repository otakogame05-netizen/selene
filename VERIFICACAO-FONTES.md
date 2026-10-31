# Verificação manual de fontes · Yomi 0.12.2

O erro registrado na fonte MangaLivre foi `Cloudflare bypass currently disabled`. O site solicitou uma verificação e o motor estava configurado sem um caminho interativo disponível no Yomi. Um 403 comum não prova que seja uma verificação; as mensagens agora distinguem essas situações.

A versão 0.12.0 tinha um erro na consulta do endereço da fonte e podia mostrar apenas uma mensagem genérica ao clicar no botão. Use 0.12.1 ou posterior.

## Como tentar o acesso

1. Instale a edição 0.12.2 e abra o Yomi.
2. Entre no catálogo e selecione a fonte que falhou.
3. Na lista de capítulos, clique em **Verificar capítulo** no capítulo que falhou. Isso abre a página exata, como no fluxo mostrado no vídeo. O botão **Verificar acesso à fonte** continua abrindo apenas o início do site. A primeira ativação baixa o navegador adicional do motor, aproximadamente 270 MB. Aguarde: a preparação pode levar alguns minutos.
4. Na janela aberta, confira o endereço e conclua a verificação solicitada pelo site. Os cliques e desafios ficam por sua conta; o Yomi não os resolve automaticamente.
5. Feche a janela de verificação e tente abrir o capítulo novamente.

Há uma janela de verificação por vez. Se ela já estiver aberta, o botão troca sua navegação para o novo capítulo e a traz para frente.

A janela usa o navegador oficial do motor e compartilha a sessão com as extensões. Abrir o site no Chrome ou Edge comum não compartilha automaticamente essa sessão. O componente baixado fica nos dados do motor e é reutilizado; não precisa baixar novamente em cada abertura.

## Limites

Isso adiciona o caminho interativo que faltava ao aplicativo. **Não garante que MangaLivre ou qualquer outro site aceite esse navegador, o endereço de rede ou a sessão.** Um site pode continuar recusando acesso, exigir recursos incompatíveis ou ter mudado sua integração. Nesse caso, a fonte ainda precisa ser investigada; a atualização não deve ser apresentada como desbloqueio garantido.

A verificação integrada atende somente ao motor iniciado pelo Yomi. Servidores externos precisam do próprio recurso de navegador. Fontes locais ou sem endereço de site não oferecem verificação.

Fechar a janela principal do Yomi também fecha a janela de verificação. Sair do Suwayomi fecha essa janela e remove a conexão local que a atendia. A sessão de navegação do site é mantida pelo próprio motor, não pelo backup JSON de leitura.

## Implementação e validação

O navegador adicional fica em `engine/bin/kcef`, com seu cache em `engine/cache/kcef`. A ativação é lembrada pelo marcador `engine/browser-enabled`. Não há serviço extra do Windows ou instalação global de Java.

Uma conexão local privada fornece a página e os eventos do navegador do motor. As credenciais internas ficam no Rust, sem entrar no endereço da janela ou no HTML. A janela remota não recebe as permissões da janela principal do Yomi. O transporte é limitado ao motor em 127.0.0.1 e protegido por um endereço aleatório por sessão.

O teste real usa apenas uma página local controlada: valida HTML, autenticação, conexão interativa e renderização pelo navegador oficial. Nenhuma verificação Cloudflare ou CAPTCHA externo foi automatizado. A aceitação do site real depende de validação manual.
