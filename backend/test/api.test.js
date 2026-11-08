import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bac-test-'));
process.env.BAC_DADOS = dir;
process.env.PORT = '3398';
const { servidor } = await import('../src/servidor.js');
const base = 'http://localhost:3398/api';

async function chamar(metodo, caminho, corpo, token, cabecalhos = {}) {
  const r = await fetch(base + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...cabecalhos },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
}

const login = async (email, senha) => (await chamar('POST', '/auth/login', { email, senha })).corpo;

before(() => new Promise((r) => (servidor.listening ? r() : servidor.once('listening', r))));
after(() => {
  servidor.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('saúde, documentação OpenAPI e catálogo', async () => {
  assert.equal((await chamar('GET', '/saude')).corpo.status, 'ok');
  const spec = (await chamar('GET', '/openapi.json')).corpo;
  assert.equal(spec.openapi, '3.0.3');
  assert.ok(spec.paths['/api/produtos/{id}'].get);
  assert.ok(spec.paths['/api/iot/leituras'].post.security);
  const mercados = (await chamar('GET', '/mercados')).corpo;
  assert.equal(mercados.length, 5);
  const busca = (await chamar('GET', '/produtos?q=acucar')).corpo;
  assert.equal(busca.total, 1);
  assert.ok(busca.produtos[0].ofertas.length >= 4);
  const precos = busca.produtos[0].ofertas.map((o) => o.preco);
  assert.deepEqual(precos, [...precos].sort((a, b) => a - b));
  assert.equal(busca.produtos[0].ofertas[0].melhor, true);
});

test('cadastro, login e controle de acesso por perfil', async () => {
  const reg = await chamar('POST', '/auth/registro', { nome: 'Teste', email: 'teste@bac.com', senha: 'abc12345' });
  assert.equal(reg.status, 201);
  assert.equal((await chamar('POST', '/auth/registro', { nome: 'Teste', email: 'teste@bac.com', senha: 'abc12345' })).status, 409);
  assert.equal((await chamar('POST', '/auth/login', { email: 'teste@bac.com', senha: 'errada' })).status, 401);
  assert.equal((await chamar('GET', '/auth/perfil')).status, 401);
  assert.equal((await chamar('GET', '/admin/metricas', null, reg.corpo.token)).status, 403);
  const admin = await login('admin@bac.com', 'admin123');
  const metricas = await chamar('GET', '/admin/metricas', null, admin.token);
  assert.equal(metricas.status, 200);
  assert.equal(metricas.corpo.mercados, 5);
});

test('comparação de lista entre mercados e lista salva', async () => {
  const itens = [{ produto_id: 1, quantidade: 2 }, { produto_id: 4, quantidade: 1 }, { produto_id: 13, quantidade: 3 }];
  const r = (await chamar('POST', '/comparar', { itens })).corpo;
  assert.ok(r.ranking.length > 0);
  const completos = r.ranking.filter((x) => x.completo);
  assert.deepEqual(completos.map((x) => x.total), completos.map((x) => x.total).sort((a, b) => a - b));
  assert.ok(r.combinacao_otima.total <= r.melhor_mercado.total + 0.001);
  assert.equal((await chamar('POST', '/comparar', { itens: [] })).status, 400);

  const user = await login('user@gmail.com', 'user123');
  const criada = await chamar('POST', '/listas', { nome: 'Teste', itens }, user.token);
  assert.equal(criada.status, 201);
  const otimizada = await chamar('GET', `/listas/${criada.corpo.id}/otimizar`, null, user.token);
  assert.equal(otimizada.status, 200);
  assert.equal(otimizada.corpo.melhor_mercado.mercado, r.melhor_mercado.mercado);
  const outro = await login('admin@bac.com', 'admin123');
  assert.equal((await chamar('GET', `/listas/${criada.corpo.id}`, null, outro.token)).status, 200);
  const reg = await chamar('POST', '/auth/registro', { nome: 'Outro', email: 'outro@bac.com', senha: 'abc12345' });
  assert.equal((await chamar('GET', `/listas/${criada.corpo.id}`, null, reg.corpo.token)).status, 404);
});

test('mercado altera preço, gera histórico e notifica favoritos; outro mercado é bloqueado', async () => {
  const user = await login('user@gmail.com', 'user123');
  await chamar('PUT', '/favoritos/4', null, user.token);
  const m1 = await login('savegnago@market.com', 'market123');
  const m2 = await login('tonin@market.com', 'market123');
  const atual = (await chamar('GET', '/produtos/4')).corpo.ofertas.find((o) => o.mercado_id === m1.usuario.mercado_id);
  assert.equal((await chamar('PUT', `/mercados/${m1.usuario.mercado_id}/precos/4`, { preco: 1.11 }, m2.token)).status, 403);
  const ok = await chamar('PUT', `/mercados/${m1.usuario.mercado_id}/precos/4`, { preco: Number((atual.preco - 0.5).toFixed(2)) }, m1.token);
  assert.equal(ok.status, 200);
  const notificacoes = (await chamar('GET', '/notificacoes', null, user.token)).corpo;
  assert.ok(notificacoes.some((n) => n.tipo === 'PRECO' && n.mensagem.includes('baixou')));
  const detalhe = (await chamar('GET', '/produtos/4')).corpo;
  assert.ok(detalhe.historico.length > 30);
});

test('IoT: ingestão por chave, alerta, estoque pela balança, atuador manual e estatísticas', async () => {
  const m = await login('savegnago@market.com', 'market123');
  const mercadoId = m.usuario.mercado_id;
  const chave = (await chamar('GET', `/iot/mercados/${mercadoId}/chave`, null, m.token)).corpo.chave;
  assert.equal((await chamar('POST', '/iot/leituras', { leituras: [{ dispositivo_id: 1, valor: 1 }] })).status, 401);

  const dispositivos = (await chamar('GET', '/iot/dispositivos', null, null, { 'X-Chave-Iot': chave })).corpo;
  const porCodigo = Object.fromEntries(dispositivos.map((d) => [d.codigo, d]));
  assert.equal(dispositivos.length, 9);

  const envio = await chamar('POST', '/iot/leituras', {
    leituras: [
      { dispositivo_id: porCodigo.camara_temp.id, valor: 11.5 },
      { dispositivo_id: porCodigo.gondola_arroz.id, valor: 10 },
      { dispositivo_id: 99999, valor: 1 },
    ],
  }, null, { 'X-Chave-Iot': chave });
  assert.equal(envio.corpo.aceitas, 2);
  assert.equal(envio.corpo.rejeitadas.length, 1);
  assert.equal(envio.corpo.comandos.length, 3);

  const painel = (await chamar('GET', `/iot/mercados/${mercadoId}/painel`, null, m.token)).corpo;
  assert.ok(painel.resumo.alertas_abertos >= 2);
  assert.ok(painel.alertas.some((a) => a.tipo === 'TEMPERATURA_ALTA'));
  assert.ok(painel.alertas.some((a) => a.tipo === 'REPOSICAO'));
  assert.ok((await chamar('GET', '/notificacoes', null, m.token)).corpo.some((n) => n.tipo === 'ALERTA_IOT'));

  const arroz = (await chamar('GET', '/produtos/1')).corpo.ofertas.find((o) => o.mercado_id === mercadoId);
  assert.equal(arroz.estoque, 2);

  await chamar('POST', '/iot/leituras', { leituras: [{ dispositivo_id: porCodigo.camara_temp.id, valor: 4 }] }, null, { 'X-Chave-Iot': chave });
  const depois = (await chamar('GET', `/iot/mercados/${mercadoId}/painel`, null, m.token)).corpo;
  assert.ok(!depois.alertas.find((a) => a.tipo === 'TEMPERATURA_ALTA' && !a.resolvido_em));

  const desligar = await chamar('PUT', `/iot/dispositivos/${porCodigo.camara_compressor.id}/atuador`, { estado: false }, m.token);
  assert.equal(desligar.corpo.estado, 0);
  assert.equal(desligar.corpo.modo, 'MANUAL');
  const ignorado = await chamar('POST', '/iot/leituras', { leituras: [{ dispositivo_id: porCodigo.camara_compressor.id, valor: 1 }] }, null, { 'X-Chave-Iot': chave });
  assert.equal(ignorado.corpo.comandos.find((c) => c.dispositivo_id === porCodigo.camara_compressor.id).estado, 0);
  const auto = await chamar('PUT', `/iot/dispositivos/${porCodigo.camara_compressor.id}/atuador`, { modo: 'AUTO' }, m.token);
  assert.equal(auto.corpo.modo, 'AUTO');
  assert.equal((await chamar('PUT', `/iot/dispositivos/${porCodigo.camara_temp.id}/atuador`, { estado: true }, m.token)).status, 400);

  const outro = await login('tonin@market.com', 'market123');
  assert.equal((await chamar('GET', `/iot/mercados/${mercadoId}/painel`, null, outro.token)).status, 403);
  assert.equal((await chamar('PUT', `/iot/dispositivos/${porCodigo.camara_compressor.id}/atuador`, { estado: true }, outro.token)).status, 403);

  const est = (await chamar('GET', `/estatisticas/dispositivos/${porCodigo.camara_temp.id}?minutos=240`, null, m.token)).corpo;
  assert.ok(est.descritiva.n > 100);
  for (const k of ['media', 'mediana', 'moda', 'desvio_padrao', 'assimetria', 'curtose']) assert.ok(k in est.descritiva);
  assert.ok(est.regressao && 'r2' in est.regressao);
  assert.ok(est.probabilidades.acima_do_limite_maximo.normal >= 0);
  assert.ok(est.intervalo_confianca_95.inferior < est.intervalo_confianca_95.superior);
  assert.ok(est.histograma.length >= 5);
});

test('estatísticas de preços (públicas)', async () => {
  const prod = (await chamar('GET', '/estatisticas/produtos/1')).corpo;
  assert.ok(prod.comparacao_atual.descritiva.n >= 4);
  assert.ok(prod.por_mercado[0].tendencia);
  const indice = (await chamar('GET', '/estatisticas/mercados')).corpo;
  assert.equal(indice.length, 5);
  assert.ok(indice[0].indice_medio >= 1);
});
