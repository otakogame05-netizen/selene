# Login Suwayomi · Yomi 0.7

A versão 0.7 aceita servidores sem login e **Basic Auth**. O usuário e a senha são os configurados no Suwayomi, não os de um site de mangás. Os modos `simple_login` (cookies) e `ui_login` (JWT) ainda não estão implementados.

## Conectar

1. Configure seu Suwayomi para Basic (`basic_auth`) e defina o usuário e a senha nele. Se o servidor não usa autenticação, escolha Sem login no Yomi.
2. No Yomi, abra **Fontes online** e informe o endereço do servidor, sem usuário ou senha na URL.
3. Em **Autenticação**, selecione **Usuário e senha · Basic**.
4. Preencha usuário e senha e clique em **Conectar**. O campo da senha é esvaziado ao enviar a tentativa.
5. Depois use fontes, busca, capas, capítulos e downloads normalmente. Para alterar o endereço, use essa tela; Configurações apenas exibe o endereço em uso.

A sessão pode ser reaproveitada ao voltar à tela enquanto o processo estiver aberto. Para trocar de conta, preencha novamente usuário e senha. **Sair do Suwayomi** remove as sessões ativas desse processo; capítulos locais e fila salva são preservados.

## Ao reiniciar e retomar filas

O Yomi não grava os campos de login nas configurações, no banco de leitura, na fila ou nos backups. A credencial Basic fica somente nas sessões em memória, vinculada ao endereço normalizado do servidor. Fechar/reiniciar o processo exige entrar novamente. Não há opção Lembrar senha ou integração com um cofre de senhas nesta versão.

Se uma fila salva precisa de autenticação, conecte primeiro com Basic e depois clique em **Retomar fila salva**. Uma recusa HTTP 401/403 pausa o processamento no primeiro capítulo afetado e preserva os seguintes como Não iniciado. Após entrar novamente, retome os pendentes; capítulos já salvos são ignorados.

A biblioteca local pode ser lida sem login ou conexão, inclusive depois de sair da sessão.

## Endereço e transporte

- Para login fora deste computador, use HTTPS. HTTP com senha só é aceito para endereços de loopback, como `127.0.0.1`, `localhost` e `[::1]`.
- Certificados HTTPS precisam ser confiáveis para o Windows. Não há opção de ignorar certificados.
- A sessão não é compartilhada automaticamente com outro endereço, origem ou caminho-base. Trocar o endereço limpa os campos da tela.
- Redirecionamentos HTTP não são seguidos. As páginas de capítulos continuam limitadas às rotas permitidas do mesmo servidor.
- Para evitar que diagnósticos remotos reflitam credenciais, erros GraphQL em operações autenticadas usam uma mensagem genérica. Confira a fonte na interface do próprio Suwayomi quando necessário.

Referência: [configuração oficial de autenticação do Suwayomi](https://github.com/Suwayomi/Suwayomi-Server/blob/master/docs/Configuring-Suwayomi%E2%80%90Server.md).

## Validação

`pnpm test:auth` executa o aplicativo real com dados e WebView2 isolados. Um servidor HTTP local controlado exige Basic também nas imagens. O teste verifica senha incorreta/repetição, reaproveitamento da sessão, perda da sessão ao encerrar o processo, pausa da fila sem autenticação, novo login, retomada, saída e leitura local. Também confere que a senha e o cabeçalho Basic de teste não aparecem nos arquivos SQLite do Yomi.

O teste opcional Rust `real_basic_server_catalog_and_images` também foi executado com Suwayomi Server v2.4.2366 real, configurado em uma porta/pasta isoladas com Basic. Conexão, fonte local, busca, capítulos, capa e download passaram. Esse teste requer as variáveis `YOMI_SUWAYOMI_BASIC_URL`, `YOMI_SUWAYOMI_BASIC_USER` e `YOMI_SUWAYOMI_BASIC_PASSWORD`, além da fixture local Yomi Test com duas páginas; não é executado pelo conjunto padrão.

Sites/extensões externos e servidores HTTPS remotos não foram validados individualmente. A sessão em memória não substitui a configuração de segurança do servidor.
