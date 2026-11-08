# Atendimento aos requisitos do 4º semestre (Manual de PI v4)

**Tema:** solução IoT contendo visualização de dados (dashboard) multiplataforma.

## Objetivos do semestre

| Requisito do manual | Onde está no projeto |
|---|---|
| Linguagens de programação para aplicações Web e Mobile | JavaScript: Node.js (API), React (web), React Native/Expo (mobile) |
| Coleta e envio de dados IoT (simulados ou reais) para Web e Mobile | `simulador/index.js` envia leituras por HTTP/JSON a `POST /api/iot/leituras`; dispositivos reais (ESP32 etc.) usam o mesmo endpoint (aba "Conectar dispositivos") |
| Front-end para visualização dos dados coletados | `web/src/paginas/PainelMercado.jsx` e `mobile/src/telas/Painel.js` (gráficos SVG, KPIs, alertas) |
| Back-end para recebimento e processamento de dados | `backend/src/rotas/iot.js` (validação, regras de alerta, estoque pela balança, comandos de atuadores) |
| Integração da solução com banco de dados | SQLite relacional (`backend/src/banco.js`), 14 tabelas |
| Controle de versionamento | Git/GitHub (todos os integrantes devem fazer commits – exigência do manual) |

## Disciplina-chave: Laboratório de Desenvolvimento Web

| Critério | Atendimento |
|---|---|
| API RESTful | Recursos e verbos HTTP: `GET/POST/PUT/DELETE /api/...`, códigos 200/201/204/400/401/403/404/409, JSON, autenticação JWT por perfil |
| Documentação OpenAPI | Especificação OpenAPI 3.0 gerada das próprias rotas (`/api/openapi.json`) + Swagger UI em `/api/docs` |
| Integração da API com banco | SQLite (relacional) com chaves estrangeiras, índices e transações |
| Front-end em React integrado à API | `web/` (React 18 + Vite), consumo via `fetch` |

## Disciplina-satélite: Internet das Coisas e Aplicações

| Critério | Atendimento |
|---|---|
| Acionamento de sensores e atuadores | Atuadores: compressores (câmara/freezer) e LED de reposição. `PUT /api/iot/dispositivos/{id}/atuador`; modos AUTO e MANUAL; histórico de acionamentos |
| Persistência e protocolos de comunicação | Leituras persistidas (`leituras`, retenção de 6 h); protocolo HTTP/JSON (REST) com chave por mercado. O dispositivo recebe os comandos na resposta do envio (padrão telemetria + comando) |
| Dashboard para consolidação de dados | Painel em tempo real (atualização a cada 3 s) na web e no celular |
| Sensores analógicos e digitais | Analógicos: temperatura (câmara, freezer) e peso (balanças). Digitais: porta e presença (0/1). Atuadores digitais (0/1) |

## Disciplina-satélite: Estatística

Implementada em `backend/src/estatistica.js` (sem bibliotecas, validada contra SciPy/NumPy em `backend/test/estatistica.test.js`) e exibida no dashboard (aba **Estatísticas**) e na página de produto:

- média, mediana, **moda**, variância, **desvio padrão**, coeficiente de variação, quartis, amplitude;
- **assimetria** e **curtose** (Fisher);
- **histograma** das leituras com marcadores de média e mediana;
- **probabilidades**: P(leitura > limite máximo) e P(leitura < limite mínimo) pelo modelo normal e pela frequência observada; proporção de tempo em nível alto (sensores digitais);
- **inferência**: intervalo de confiança de 95% (t de Student) e teste de significância da tendência (α = 5%);
- **regressão linear** simples (leitura × tempo; preço × dia), com R², erro-padrão, estatística t e previsão.

## Disciplina-satélite: Programação para Dispositivos Móveis I

| Critério | Atendimento |
|---|---|
| Consumir dados da API com os dados dos sensores | `mobile/src/api.js` e `mobile/src/telas/Painel.js` |
| Widgets para mudar estado de atuadores | `Switch` nativo por atuador + botão "Voltar ao automático" |
| Processamentos nos dados recebidos | Estoque estimado, status por limites, estatísticas, comparação de listas |
| Apresentação gráfica | Gráfico de linha, histograma, barras e sparklines com `react-native-svg` |

## Itens gerais do manual

- **Portfólio no GitHub:** repositório versionado com README e `docs/`.
- **Vídeo de até 5 min com todos os integrantes falando:** roteiro em `docs/roteiro-video.md`; o link deve ser adicionado ao README.
- **Grupo de 2 a 4 integrantes**, todos com commits.
