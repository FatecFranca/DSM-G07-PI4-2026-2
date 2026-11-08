# Dispositivos IoT simulados

Cada supermercado possui 9 dispositivos:

| Código | Tipo | Natureza | Função | Limites |
|---|---|---|---|---|
| camara_temp | Sensor de temperatura | Analógico (°C) | Câmara fria de laticínios | 0 a 8 °C |
| freezer_temp | Sensor de temperatura | Analógico (°C) | Freezer de congelados | −26 a −12 °C |
| gondola_arroz / gondola_leite | Balança (célula de carga) | Analógico (kg) | Estoque da gôndola → atualiza a disponibilidade do produto | alerta de reposição abaixo de 20% |
| camara_porta | Sensor de porta | Digital (0/1) | Porta da câmara aberta aquece a câmara | – |
| presenca | Sensor de presença (PIR) | Digital (0/1) | Cliente no corredor → consumo da gôndola | – |
| camara_compressor / freezer_compressor | Atuador | Digital | Liga/desliga a refrigeração | AUTO (termostato) ou MANUAL |
| led_reposicao | Atuador | Digital | Sinaliza gôndola com pouco estoque | AUTO ou MANUAL |

## O que o simulador faz (`simulador/index.js`)

- A cada 3 s envia as leituras de todos os dispositivos de cada mercado (HTTP POST + chave do mercado).
- Física simplificada: com o compressor ligado a temperatura cai, desligado sobe; porta aberta aquece mais rápido; o termostato liga/desliga com histerese (gera o serrote dos gráficos).
- **Falhas aleatórias** do compressor (25 a 45 ciclos) fazem a temperatura passar do limite e gerar alerta.
- Clientes (presença) retiram unidades da gôndola; ao baixar de 20% o alerta de reposição abre e, após alguns ciclos, a gôndola é reabastecida.
- Respeita os comandos manuais enviados pelo dashboard (ex.: desligar o compressor).

Configuração opcional (variáveis de ambiente): `SIM_INTERVALO_MS`, `BAC_API`, `BAC_LOG=1`.

## Conectar um dispositivo real

Aba **Conectar dispositivos** do painel do mercado mostra a chave e um exemplo:

```
POST /api/iot/leituras
X-Chave-Iot: <chave do mercado>
{ "leituras": [ { "dispositivo_id": 1, "valor": 4.3 } ] }
```

A resposta contém `comandos` (estado e modo desejados de cada atuador) para o dispositivo aplicar.

## Estatística aplicada

- **Dispositivos** (`GET /api/estatisticas/dispositivos/{id}?minutos=120`): descritiva, histograma, probabilidades, IC 95%, regressão leitura × tempo.
- **Produtos** (`GET /api/estatisticas/produtos/{id}`): dispersão dos preços entre mercados e regressão do histórico de 30 dias por mercado (tendência em R$/dia, R², direção, previsão em 7 dias).
- **Mercados** (`GET /api/estatisticas/mercados`): índice de preços = média de (preço ÷ menor preço do produto); 1,00 significa "sempre o mais barato".

Fórmulas: assimetria g1 = m3/m2^1,5; curtose de excesso g2 = m4/m2² − 3; regressão por mínimos quadrados; IC = x̄ ± t(0,975; n−1)·s/√n; teste da inclinação com t = b/EP(b).
