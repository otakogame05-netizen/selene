# Ambiente de compilação Windows

Preparado em 25/10/2026. O disco C: tinha cerca de 8 GB livres no início; por isso, os arquivos pesados foram colocados em `D:/YomiBuildTools`.

## Instalado e verificado

| Requisito | Resultado |
| --- | --- |
| Node | 24.22.1, já disponível |
| pnpm | 11.25.0, já disponível |
| Rust/Cargo | 1.99.1, alvo `x86_64-pc-windows-msvc` |
| Visual Studio Build Tools | 2022, versão 17.14.42, componentes C++ x64/x86 |
| Windows SDK | 10.0.26100.0 |
| WebView2 | 155.0.4283.62, já disponível |

Rust foi instalado pelo instalador oficial com SHA256 conferido. Os Build Tools foram instalados pelo WinGet com componentes individuais de MSVC e Windows SDK. Componentes compartilhados do Visual Studio e o SDK continuam usando pastas padrão do Windows no C:.

## Caminhos locais

```text
D:/YomiBuildTools/cargo             Cargo, rustup e bibliotecas baixadas
D:/YomiBuildTools/rustup            Toolchain Rust
D:/YomiBuildTools/VisualStudio      Compilador C++
D:/YomiBuildTools/target-yomi        Testes, executável e instalador compilados
D:/YomiBuildTools/Temp              Temporários de compilação
```

`local-build.json` está configurado para esses caminhos e é ignorado pelo Git. O arquivo `local-build.example.json` serve de exemplo para outros computadores. `scripts/BuildEnv.ps1` carrega os caminhos apenas no processo atual, sem alterar globalmente PATH, TEMP ou as variáveis Rust do usuário.

Os comandos `pnpm desktop`, `pnpm desktop:build`, `pnpm test:rust`, `pnpm test:smoke`, `pnpm deliver` e `pnpm run doctor` carregam a configuração local. Para usar Cargo manualmente em um terminal deste projeto:

```powershell
. ./scripts/BuildEnv.ps1
cargo --version
rustc --version
```

Sem `local-build.json`, os scripts usam as ferramentas e os caminhos padrão do terminal. Em outro computador, instale os requisitos normalmente ou copie/ajuste o exemplo. `src-tauri/Cargo.lock` agora fixa as versões Rust usadas neste build.

## Comandos verificados

```powershell
pnpm run doctor
pnpm test:rust
pnpm desktop:build
pnpm test:smoke
pnpm deliver
```

O instalador foi copiado para `entrega/Yomi Reader_0.1.0_x64-setup.exe`. Seu SHA256 está em `entrega/manifesto.json`.

O smoke test usa temporariamente um canal de depuração local do WebView2, restrito ao processo de teste. Ele encerra esse processo e restaura a variável de ambiente ao final; a execução normal do programa não depende desse canal.

A localização das ferramentas no D: não altera a pasta padrão dos dados do leitor, que continua em `%APPDATA%/com.yomi.reader/`.
