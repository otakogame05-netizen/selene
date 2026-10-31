# Histórico e conforto de leitura · Yomi 0.13.0

## Lidos recentemente

Ao abrir um capítulo pelo catálogo da ToonLivre, o Yomi salva título, capítulo, endereço, data e capa já disponível em cache. Em **Lidos recentemente → Capítulos online**, clique no cartão para **Reabrir capítulo** na leitura integrada. A retomada usa o endereço salvo, sem exigir consulta ao motor de extensões.

O histórico fica no SQLite do aplicativo, sobrevive ao reinício e não duplica um capítulo reaberto. Mostra até 200 registros recentes. Quando a navegação do próprio site muda para outro capítulo numérico da mesma obra e domínio, o endereço também é registrado. Links de outros domínios não herdam a identificação da obra.

É um histórico de capítulos abertos. Não marca a obra como concluída nem prova que o desafio de segurança foi concluído. Não registra a posição exata de rolagem. Capítulos lidos antes desta versão não podem ser reconstruídos: aparecerão ao serem abertos novamente.

Este histórico está separado dos livros locais; não cria páginas fictícias, arquivos offline ou progresso percentual artificial. O backup JSON existente do leitor local ainda não inclui a tabela `site_readings`.

## Ajustar ao monitor

Na barra superior da leitura integrada:

- **Confortável:** centraliza a página e limita a área do site a 1120 pixels lógicos. A largura diminui automaticamente se a janela for menor.
- **Toda a tela:** usa toda a largura disponível da janela.
- **− / +:** ajusta o zoom de 70% a 160%. A altura sempre acompanha a janela, reservando 72 pixels lógicos para a barra do Yomi.

Os ajustes são lembrados no perfil do aplicativo e reaplicados nas próximas leituras. O cálculo considera a escala do Windows para monitores de alta resolução. O conteúdo continua sendo o leitor do site, com suas imagens, seus controles e a confirmação manual quando exigida.

O histórico de capítulos é local. O login e a confirmação do site continuam pertencendo ao perfil de navegação; não são copiados para a extensão.

## Selene 0.17.0

Os capítulos online usam cartões com capa no mesmo tamanho de Últimas leituras. A lixeira de cada cartão apaga somente aquele registro do histórico, inclusive após reiniciar. Não apaga arquivos, favoritos, capas compartilhadas ou outros capítulos. Abrir o capítulo novamente cria um novo registro.

