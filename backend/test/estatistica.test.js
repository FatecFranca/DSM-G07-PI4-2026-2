import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assimetria, cdfNormal, curtose, desvioPadrao, intervaloConfianca, invNormal, media, mediana, moda, quantil, regressaoLinear, tCritico, variancia,
} from '../src/estatistica.js';

const dados = [4.1, 4.5, 3.9, 4.8, 5.2, 4.5, 4.0, 6.1, 4.5, 3.8, 5.0, 4.7];
const perto = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test('medidas de tendência central e dispersão batem com o SciPy/NumPy', () => {
  perto(media(dados), 4.591666666666666);
  perto(mediana(dados), 4.5);
  assert.deepEqual(moda(dados, 1), { valor: 4.5, frequencia: 3 });
  perto(variancia(dados), 0.41719696969696957);
  perto(desvioPadrao(dados), 0.6459078647121195);
  perto(quantil(dados, 0.25), 4.075);
  perto(quantil(dados, 0.75), 4.85);
});

test('assimetria e curtose (Fisher) batem com o SciPy', () => {
  perto(assimetria(dados), 0.9090026730605222);
  perto(curtose(dados), 0.5016794743201065);
});

test('distribuição normal e t de Student', () => {
  perto(cdfNormal(0), 0.5, 1e-6);
  perto(cdfNormal(1.96), 0.9750021, 1e-5);
  perto(invNormal(0.975), 1.959963984540054, 1e-6);
  perto(invNormal(0.01), -2.3263478740408408, 1e-6);
  perto(tCritico(10), 2.228138851986274, 5e-3);
  perto(tCritico(29), 2.045229642132703, 1e-3);
});

test('intervalo de confiança de 95% para a média', () => {
  const ic = intervaloConfianca(dados);
  perto(ic.inferior, 4.181276388620125, 1e-2);
  perto(ic.superior, 5.002056944713207, 1e-2);
});

test('regressão linear simples', () => {
  const x = dados.map((_, i) => i);
  const r = regressaoLinear(x, dados);
  perto(r.inclinacao, 0.03881118881118882);
  perto(r.intercepto, 4.378205128205128);
  perto(r.r2, 0.046937083254497476);
  perto(r.erro_inclinacao, 0.0553043996578363);
  assert.equal(r.significativa, false);
  const tendencia = regressaoLinear([0, 1, 2, 3, 4, 5, 6, 7], [1, 2.1, 2.9, 4.2, 5.1, 5.9, 7.2, 8]);
  assert.equal(tendencia.significativa, true);
});
