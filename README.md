# BAC – Comparador de preços de supermercados com IoT

Projeto Interdisciplinar do **4º semestre – Desenvolvimento de Software Multiplataforma (FATEC Franca)**.
Tema: *solução IoT com visualização de dados (dashboard) multiplataforma*.

**Problema:** o consumidor perde tempo e dinheiro porque não sabe qual supermercado está mais barato nem se o produto realmente está na prateleira. O supermercado, por sua vez, precisa garantir a cadeia fria e repor gôndolas a tempo.

**Solução:** o BAC compara preços entre supermercados e usa **sensores e atuadores IoT** (câmara fria, freezer, balanças de gôndola, porta, presença, compressores, LED de reposição) para:

- mostrar ao consumidor o **estoque real** (a balança da gôndola atualiza a disponibilidade do produto) e o status da **cadeia fria** de cada mercado;
- dar ao supermercado um **dashboard em tempo real** (web e celular) com alertas, gráficos, **estatística** e **acionamento remoto de atuadores**.

## Como rodar (Windows, Linux ou Mac)

Requisito único: **Node.js 22.13 ou mais novo** (https://nodejs.org – versão LTS). Não é preciso instalar banco de dados, Java nem Docker.

```cmd
npm install
npm start
```

Pronto: o site abre em **http://localhost:5173** e a documentação da API em **http://localhost:3333/api/docs**.
O `npm start` sobe sozinho a API, o banco (SQLite, criado e populado automaticamente) e o simulador dos sensores IoT.

### Aplicativo mobile (Expo Go)

1. Instale o app **Expo Go** no celular (Android ou iPhone) – o celular precisa estar na **mesma rede Wi-Fi** do computador.
2. Em um segundo terminal, na pasta do projeto:

```cmd
npm run mobile
```

3. Leia o QR Code com o Expo Go (Android) ou com a câmera (iPhone).

O app descobre sozinho o endereço da API (mesmo IP do computador). Se o Windows perguntar sobre o Firewall, permita o acesso em rede privada. Caso a conexão falhe, a aba **Conta** tem o campo "Servidor da API" para ajustar sem mexer em código.
Se o Expo Go reclamar de versão do SDK, atualize o app Expo Go na loja.

### Contas de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Consumidor | user@gmail.com | user123 |
| Supermercado (Savegnago) | savegnago@market.com | market123 |
| Administrador | admin@bac.com | admin123 |

Os outros mercados seguem o padrão `tonin@market.com`, `assai@market.com`, `atacadao@market.com`, `carrefour@market.com` (senha `market123`).

## Comandos

| Comando | O que faz |
|---|---|
| `npm install` | instala tudo (site e app) |
| `npm start` | API + banco + simulador IoT + site |
| `npm run mobile` | API + simulador (se ainda não estiverem rodando) + Expo para o celular |
| `npm run tudo` | tudo ao mesmo tempo |
| `npm run api` | só API + simulador |
| `npm test` | testes automatizados do backend |
| `npm run build` | gera o site otimizado (depois a API passa a servi-lo em http://localhost:3333) |

Para zerar os dados, apague a pasta `backend/data` e inicie de novo.

## Demonstração sugerida (vídeo)

Veja `docs/roteiro-video.md`. Em resumo: buscar produto → comparar mercados → carrinho/lista otimizada → login como supermercado → painel em tempo real → desligar o compressor (atuador) e ver a temperatura subir até gerar alerta → estatísticas (regressão, histograma) → mesmo painel no celular → documentação OpenAPI.

## Estrutura

```
backend/    API REST (Node.js puro + SQLite), OpenAPI, estatística, testes
simulador/  simula os dispositivos IoT enviando leituras por HTTP/JSON
web/        site e dashboard em React (Vite)
mobile/     app Expo / React Native (Expo Go)
scripts/    instalação e inicialização multiplataforma
docs/       requisitos, arquitetura, IoT/estatística, roteiro do vídeo
```

Documentação detalhada: [`docs/atendimento-requisitos.md`](docs/atendimento-requisitos.md), [`docs/arquitetura.md`](docs/arquitetura.md), [`docs/iot-e-estatistica.md`](docs/iot-e-estatistica.md).

## Segurança

- Senhas com *scrypt* + sal; autenticação por token JWT (HS256) com segredo gerado automaticamente em `backend/data`.
- Dispositivos IoT autenticam por **chave por supermercado** (`X-Chave-Iot`); um mercado só enxerga e aciona os próprios dispositivos.
- Nenhuma credencial fica no repositório. (Na versão anterior, a string de conexão do MongoDB Atlas estava no `docker-compose.yml`: troque a senha desse usuário no Atlas.)
