import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pasta = path.dirname(fileURLToPath(import.meta.url));
const API = (process.env.BAC_API || 'http://localhost:3333').replace(/\/$/, '');
const INTERVALO = Number(process.env.SIM_INTERVALO_MS || 3000);
const ARQUIVO_CHAVES = process.env.SIM_CHAVES || path.join(pasta, '..', 'backend', 'data', 'chaves-iot.json');
const DETALHADO = process.env.BAC_LOG === '1';

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const aleatorio = (a, b) => a + Math.random() * (b - a);
const ruido = (amp) => (Math.random() - 0.5) * 2 * amp;

async function http(caminho, { metodo = 'GET', chave, corpo } = {}) {
  const resposta = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(chave ? { 'X-Chave-Iot': chave } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  if (!resposta.ok) throw new Error(`${metodo} ${caminho} -> HTTP ${resposta.status}`);
  return resposta.json();
}

async function aguardarApi() {
  let avisou = false;
  for (;;) {
    try {
      await http('/api/saude');
      if (fs.existsSync(ARQUIVO_CHAVES)) return;
    } catch {
      if (!avisou) console.log('[simulador] aguardando a API ficar disponível...');
      avisou = true;
    }
    await dormir(1000);
  }
}

const CONFIG_ZONAS = {
  camara: { liga: 5.5, desliga: 2.5, resfria: 0.35, aquece: 0.22, porta: 0.35, inicial: 4, probFalha: 0.004 },
  freezer: { liga: -16.5, desliga: -19.5, resfria: 0.3, aquece: 0.18, porta: 0, inicial: -18, probFalha: 0.002 },
};

function criarZona(tipo, dispositivo) {
  const cfg = CONFIG_ZONAS[tipo];
  return { cfg, temp: dispositivo?.ultimo_valor ?? cfg.inicial, comp: 1, falha: 0 };
}

function passoZona(zona, modo, estadoManual, portaAberta) {
  const { cfg } = zona;
  if (modo === 'MANUAL') {
    zona.comp = estadoManual;
  } else {
    if (zona.falha === 0 && Math.random() < cfg.probFalha) zona.falha = Math.round(aleatorio(25, 45));
    if (zona.falha > 0) {
      zona.falha--;
      zona.comp = 0;
    } else if (zona.temp > cfg.liga) zona.comp = 1;
    else if (zona.temp < cfg.desliga) zona.comp = 0;
  }
  zona.temp += (zona.comp ? -cfg.resfria : cfg.aquece) + (portaAberta ? cfg.porta : 0) + ruido(0.08);
}

function criarGondola(dispositivo) {
  const capacidade = dispositivo.capacidade;
  return { capacidade, unidade: dispositivo.peso_unitario, peso: dispositivo.ultimo_valor ?? capacidade * 0.9, reposicao: 0, limite: dispositivo.limite_min ?? capacidade * 0.2 };
}

function passoGondola(g, presente) {
  if (presente && Math.random() < 0.28 && g.peso >= g.unidade) g.peso -= g.unidade;
  if (g.peso < g.limite && g.reposicao === 0) g.reposicao = Math.round(aleatorio(8, 14));
  if (g.reposicao > 0 && --g.reposicao === 0) g.peso = g.capacidade * aleatorio(0.9, 1);
}

async function prepararMercado(id, info) {
  const dispositivos = await http('/api/iot/dispositivos', { chave: info.chave });
  const porCodigo = Object.fromEntries(dispositivos.map((d) => [d.codigo, d]));
  return {
    id: Number(id),
    nome: info.mercado,
    chave: info.chave,
    dispositivos: porCodigo,
    camara: criarZona('camara', porCodigo.camara_temp),
    freezer: criarZona('freezer', porCodigo.freezer_temp),
    arroz: criarGondola(porCodigo.gondola_arroz),
    leite: criarGondola(porCodigo.gondola_leite),
    porta: 0,
    portaRestante: 0,
    presenca: 0,
    comandos: Object.fromEntries(dispositivos.filter((d) => d.papel === 'ATUADOR').map((d) => [d.codigo, { estado: d.estado, modo: d.modo }])),
    led: 0,
    errosSeguidos: 0,
  };
}

function avancar(m) {
  if (m.portaRestante > 0) {
    m.portaRestante--;
    m.porta = m.portaRestante > 0 ? 1 : 0;
  } else if (Math.random() < 0.04) {
    m.portaRestante = Math.round(aleatorio(2, 4));
    m.porta = 1;
  }
  m.presenca = m.presenca ? (Math.random() < 0.6 ? 1 : 0) : Math.random() < 0.35 ? 1 : 0;

  const cmd = m.comandos;
  passoZona(m.camara, cmd.camara_compressor.modo, cmd.camara_compressor.estado, m.porta);
  passoZona(m.freezer, cmd.freezer_compressor.modo, cmd.freezer_compressor.estado, 0);
  passoGondola(m.arroz, m.presenca);
  passoGondola(m.leite, m.presenca);

  if (cmd.led_reposicao.modo === 'MANUAL') m.led = cmd.led_reposicao.estado;
  else m.led = m.arroz.peso < m.arroz.capacidade * 0.3 || m.leite.peso < m.leite.capacidade * 0.3 ? 1 : 0;

  const d = m.dispositivos;
  const valores = {
    camara_temp: m.camara.temp,
    freezer_temp: m.freezer.temp,
    gondola_arroz: m.arroz.peso + ruido(0.05),
    gondola_leite: m.leite.peso + ruido(0.03),
    camara_porta: m.porta,
    presenca: m.presenca,
    camara_compressor: m.camara.comp,
    freezer_compressor: m.freezer.comp,
    led_reposicao: m.led,
  };
  return Object.entries(valores)
    .filter(([codigo]) => d[codigo])
    .map(([codigo, valor]) => ({ dispositivo_id: d[codigo].id, valor: Number(valor.toFixed(3)) }));
}

async function ciclo(mercados) {
  for (const m of mercados) {
    try {
      const resposta = await http('/api/iot/leituras', { metodo: 'POST', chave: m.chave, corpo: { leituras: avancar(m) } });
      for (const c of resposta.comandos) {
        const codigo = Object.keys(m.dispositivos).find((k) => m.dispositivos[k].id === c.dispositivo_id);
        if (codigo) m.comandos[codigo] = { estado: c.estado, modo: c.modo };
      }
      if (m.errosSeguidos) console.log(`[simulador] ${m.nome}: conexão restabelecida`);
      m.errosSeguidos = 0;
      if (DETALHADO) console.log(`[simulador] ${m.nome}: câmara ${m.camara.temp.toFixed(1)}°C | freezer ${m.freezer.temp.toFixed(1)}°C | arroz ${m.arroz.peso.toFixed(1)}kg`);
    } catch (e) {
      if (m.errosSeguidos++ === 0) console.log(`[simulador] ${m.nome}: falha ao enviar leituras (${e.message}). Tentando novamente...`);
    }
  }
}

async function principal() {
  await aguardarApi();
  const chaves = JSON.parse(fs.readFileSync(ARQUIVO_CHAVES, 'utf8'));
  const mercados = [];
  for (const [id, info] of Object.entries(chaves)) mercados.push(await prepararMercado(id, info));
  console.log(`[simulador] ${mercados.length} supermercados simulados, enviando leituras a cada ${INTERVALO / 1000}s para ${API}`);

  let ocupado = false;
  setInterval(async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await ciclo(mercados);
    } finally {
      ocupado = false;
    }
  }, INTERVALO);
  await ciclo(mercados);
}

principal().catch((e) => {
  console.error('[simulador] erro fatal:', e.message);
  process.exit(1);
});
