import { arredonda } from './util.js';

export const soma = (a) => a.reduce((s, x) => s + x, 0);
export const media = (a) => (a.length ? soma(a) / a.length : NaN);

export function mediana(a) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function moda(a, casas = 1) {
  if (!a.length) return null;
  const f = 10 ** casas;
  const cont = new Map();
  for (const v of a) {
    const k = Math.round(v * f) / f;
    cont.set(k, (cont.get(k) || 0) + 1);
  }
  let melhor = null;
  for (const [valor, frequencia] of cont) {
    if (!melhor || frequencia > melhor.frequencia || (frequencia === melhor.frequencia && valor < melhor.valor)) {
      melhor = { valor, frequencia };
    }
  }
  return melhor.frequencia > 1 || a.length === 1 ? melhor : null;
}

export function variancia(a, amostral = true) {
  const n = a.length;
  if (n < (amostral ? 2 : 1)) return NaN;
  const m = media(a);
  return soma(a.map((x) => (x - m) ** 2)) / (amostral ? n - 1 : n);
}

export const desvioPadrao = (a, amostral = true) => Math.sqrt(variancia(a, amostral));

function momento(a, k) {
  const m = media(a);
  return soma(a.map((x) => (x - m) ** k)) / a.length;
}

export function assimetria(a) {
  if (a.length < 3) return NaN;
  const m2 = momento(a, 2);
  return m2 === 0 ? 0 : momento(a, 3) / m2 ** 1.5;
}

export function curtose(a) {
  if (a.length < 4) return NaN;
  const m2 = momento(a, 2);
  return m2 === 0 ? 0 : momento(a, 4) / m2 ** 2 - 3;
}

export function quantil(a, p) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const pos = (s.length - 1) * p;
  const base = Math.floor(pos);
  const resto = pos - base;
  return s[base + 1] !== undefined ? s[base] + resto * (s[base + 1] - s[base]) : s[base];
}

function erf(x) {
  const sinal = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sinal * y;
}

export const cdfNormal = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

export function invNormal(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const baixo = 0.02425;
  if (p < baixo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - baixo) return -invNormal(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export function tCritico(gl, confianca = 0.95) {
  const z = invNormal(1 - (1 - confianca) / 2);
  return (
    z +
    (z ** 3 + z) / (4 * gl) +
    (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * gl ** 2) +
    (3 * z ** 7 + 19 * z ** 5 + 17 * z ** 3 - 15 * z) / (384 * gl ** 3)
  );
}

export function intervaloConfianca(a, confianca = 0.95) {
  const n = a.length;
  if (n < 2) return null;
  const m = media(a);
  const erroPadrao = desvioPadrao(a) / Math.sqrt(n);
  const margem = tCritico(n - 1, confianca) * erroPadrao;
  return { inferior: m - margem, superior: m + margem, margem, confianca };
}

export function regressaoLinear(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = media(xs);
  const my = media(ys);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
  }
  if (sxx === 0) return null;
  const inclinacao = sxy / sxx;
  const intercepto = my - inclinacao * mx;
  const r = syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
  const r2 = r * r;
  const erroInclinacao = syy === 0 ? 0 : Math.sqrt(((1 - r2) * syy) / (n - 2) / sxx);
  const t = erroInclinacao === 0 ? (inclinacao === 0 ? 0 : Infinity) : inclinacao / erroInclinacao;
  const significativa = Math.abs(t) > tCritico(n - 2);
  return {
    n,
    inclinacao,
    intercepto,
    r,
    r2,
    erro_inclinacao: erroInclinacao,
    estatistica_t: t,
    significativa,
    prever: (x) => intercepto + inclinacao * x,
  };
}

export function histograma(a, classes) {
  if (!a.length) return [];
  const min = Math.min(...a);
  const max = Math.max(...a);
  const k = classes || Math.min(20, Math.max(5, Math.ceil(Math.sqrt(a.length))));
  if (min === max) return [{ de: min, ate: max, frequencia: a.length }];
  const largura = (max - min) / k;
  const bins = Array.from({ length: k }, (_, i) => ({ de: min + i * largura, ate: min + (i + 1) * largura, frequencia: 0 }));
  for (const v of a) {
    const i = Math.min(k - 1, Math.floor((v - min) / largura));
    bins[i].frequencia++;
  }
  return bins;
}

export function descritiva(a, casasModa = 1) {
  const n = a.length;
  const m = media(a);
  const dp = n > 1 ? desvioPadrao(a) : NaN;
  const md = moda(a, casasModa);
  const q1 = quantil(a, 0.25);
  const q3 = quantil(a, 0.75);
  return {
    n,
    media: arredonda(m),
    mediana: arredonda(mediana(a)),
    moda: md ? arredonda(md.valor) : null,
    frequencia_moda: md ? md.frequencia : null,
    minimo: n ? arredonda(Math.min(...a)) : null,
    maximo: n ? arredonda(Math.max(...a)) : null,
    amplitude: n ? arredonda(Math.max(...a) - Math.min(...a)) : null,
    variancia: arredonda(n > 1 ? variancia(a) : NaN),
    desvio_padrao: arredonda(dp),
    coeficiente_variacao: arredonda(m !== 0 ? dp / Math.abs(m) : NaN),
    assimetria: arredonda(assimetria(a)),
    curtose: arredonda(curtose(a)),
    q1: arredonda(q1),
    q3: arredonda(q3),
  };
}

export function probabilidadeAcima(a, limite) {
  if (!a.length) return null;
  const m = media(a);
  const dp = a.length > 1 ? desvioPadrao(a) : 0;
  const normal = dp === 0 ? (m > limite ? 1 : 0) : 1 - cdfNormal((limite - m) / dp);
  const empirica = a.filter((v) => v > limite).length / a.length;
  return { limite, normal: arredonda(normal), empirica: arredonda(empirica) };
}

export function probabilidadeAbaixo(a, limite) {
  if (!a.length) return null;
  const m = media(a);
  const dp = a.length > 1 ? desvioPadrao(a) : 0;
  const normal = dp === 0 ? (m < limite ? 1 : 0) : cdfNormal((limite - m) / dp);
  const empirica = a.filter((v) => v < limite).length / a.length;
  return { limite, normal: arredonda(normal), empirica: arredonda(empirica) };
}

export function resumoRegressao(reg, xs, ys, passosPrevisao = [], unidadeX = 1) {
  if (!reg) return null;
  const ultimoX = xs[xs.length - 1];
  return {
    n: reg.n,
    inclinacao: arredonda(reg.inclinacao, 6),
    inclinacao_por_unidade: arredonda(reg.inclinacao * unidadeX, 6),
    intercepto: arredonda(reg.intercepto, 6),
    r: arredonda(reg.r),
    r2: arredonda(reg.r2),
    erro_inclinacao: arredonda(reg.erro_inclinacao, 6),
    estatistica_t: arredonda(reg.estatistica_t),
    significativa: reg.significativa,
    linha: [xs[0], ultimoX].map((x) => ({ x, y: arredonda(reg.prever(x), 6) })),
    previsoes: passosPrevisao.map((p) => ({ x: ultimoX + p, y: arredonda(reg.prever(ultimoX + p), 4) })),
    pontos: xs.length,
    ultimo_y: ys[ys.length - 1],
  };
}
