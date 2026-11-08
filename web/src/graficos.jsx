import { numero } from './formatos.js';

export const CORES = ['#16a34a', '#2563eb', '#d97706', '#9333ea', '#dc2626', '#0891b2'];

function escala(min, max, tamanho, invertido = false) {
  const amplitude = max - min || 1;
  return (v) => (invertido ? tamanho - ((v - min) / amplitude) * tamanho : ((v - min) / amplitude) * tamanho);
}

function limites(valores) {
  let min = Math.min(...valores);
  let max = Math.max(...valores);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const folga = (max - min) * 0.08;
  return [min - folga, max + folga];
}

export function GraficoLinha({ series, linhas = [], formatoX = (x) => x, formatoY = (y) => numero(y, 1), altura = 220, legenda = true }) {
  const todos = series.flatMap((s) => s.pontos);
  if (!todos.length) return <div className="vazio">Sem dados para exibir.</div>;
  const L = 640;
  const m = { e: 52, d: 12, t: 10, b: 26 };
  const larguraUtil = L - m.e - m.d;
  const alturaUtil = altura - m.t - m.b;
  const [xmin, xmax] = [Math.min(...todos.map((p) => p.x)), Math.max(...todos.map((p) => p.x))];
  const [ymin, ymax] = limites([...todos.map((p) => p.y), ...linhas.map((l) => l.y)]);
  const sx = escala(xmin, xmax === xmin ? xmin + 1 : xmax, larguraUtil);
  const sy = escala(ymin, ymax, alturaUtil, true);
  const ticksY = [0, 1, 2, 3].map((i) => ymin + ((ymax - ymin) * i) / 3);
  const ticksX = [0, 1, 2, 3].map((i) => xmin + ((xmax - xmin) * i) / 3);

  return (
    <div className="grafico">
      <svg viewBox={`0 0 ${L} ${altura}`} role="img" preserveAspectRatio="xMidYMid meet">
        <g transform={`translate(${m.e},${m.t})`}>
          {ticksY.map((t, i) => (
            <g key={i}>
              <line x1="0" x2={larguraUtil} y1={sy(t)} y2={sy(t)} className="grade" />
              <text x="-8" y={sy(t) + 4} textAnchor="end" className="eixo">
                {formatoY(t)}
              </text>
            </g>
          ))}
          {ticksX.map((t, i) => (
            <text key={i} x={sx(t)} y={alturaUtil + 18} textAnchor={i === 0 ? 'start' : i === 3 ? 'end' : 'middle'} className="eixo">
              {formatoX(t)}
            </text>
          ))}
          {linhas.map((l, i) => (
            <g key={i}>
              <line x1="0" x2={larguraUtil} y1={sy(l.y)} y2={sy(l.y)} stroke={l.cor || '#dc2626'} strokeDasharray="5 4" strokeWidth="1.4" />
              <text x={larguraUtil - 2} y={sy(l.y) - 4} textAnchor="end" className="eixo" fill={l.cor || '#dc2626'}>
                {l.rotulo}
              </text>
            </g>
          ))}
          {series.map((s, i) => (
            <path
              key={s.nome}
              d={s.pontos.map((p, j) => `${j ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')}
              fill="none"
              stroke={s.cor || CORES[i % CORES.length]}
              strokeWidth={s.tracejado ? 2 : 2.2}
              strokeDasharray={s.tracejado ? '6 4' : undefined}
              strokeLinejoin="round"
            />
          ))}
        </g>
      </svg>
      {legenda && series.length > 1 && (
        <div className="legenda">
          {series.map((s, i) => (
            <span key={s.nome}>
              <i style={{ background: s.cor || CORES[i % CORES.length] }} />
              {s.nome}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Histograma({ bins, marcadores = [], altura = 200, formatoX = (x) => numero(x, 1) }) {
  if (!bins.length) return <div className="vazio">Sem dados para exibir.</div>;
  const L = 640;
  const m = { e: 40, d: 12, t: 14, b: 28 };
  const larguraUtil = L - m.e - m.d;
  const alturaUtil = altura - m.t - m.b;
  const xmin = bins[0].de;
  const xmax = bins[bins.length - 1].ate === xmin ? xmin + 1 : bins[bins.length - 1].ate;
  const fmax = Math.max(...bins.map((b) => b.frequencia));
  const sx = escala(xmin, xmax, larguraUtil);
  return (
    <div className="grafico">
      <svg viewBox={`0 0 ${L} ${altura}`} role="img">
        <g transform={`translate(${m.e},${m.t})`}>
          <line x1="0" x2={larguraUtil} y1={alturaUtil} y2={alturaUtil} className="grade" />
          {bins.map((b, i) => {
            const h = (b.frequencia / fmax) * alturaUtil;
            const x = sx(b.de);
            const w = Math.max(2, sx(b.ate === b.de ? b.de + 1 : b.ate) - x - 2);
            return <rect key={i} x={x + 1} y={alturaUtil - h} width={w} height={h} rx="2" fill="#16a34a" opacity="0.85" />;
          })}
          {[0, 1, 2, 3].map((i) => {
            const v = xmin + ((xmax - xmin) * i) / 3;
            return (
              <text key={i} x={sx(v)} y={alturaUtil + 18} textAnchor={i === 0 ? 'start' : i === 3 ? 'end' : 'middle'} className="eixo">
                {formatoX(v)}
              </text>
            );
          })}
          <text x="-8" y="10" textAnchor="end" className="eixo">
            {fmax}
          </text>
          <text x="-8" y={alturaUtil} textAnchor="end" className="eixo">
            0
          </text>
          {marcadores
            .filter((mk) => mk.x >= xmin && mk.x <= xmax)
            .map((mk, i) => (
              <g key={i}>
                <line x1={sx(mk.x)} x2={sx(mk.x)} y1="-4" y2={alturaUtil} stroke={mk.cor} strokeWidth="2" strokeDasharray="4 3" />
                <text x={sx(mk.x) + 4} y={8 + i * 12} className="eixo" fill={mk.cor}>
                  {mk.rotulo}
                </text>
              </g>
            ))}
        </g>
      </svg>
    </div>
  );
}

export function Barras({ itens, formato, destaqueMenor = true }) {
  if (!itens.length) return <div className="vazio">Sem dados.</div>;
  const max = Math.max(...itens.map((i) => i.valor));
  const menor = Math.min(...itens.map((i) => i.valor));
  return (
    <div className="barras">
      {itens.map((i) => (
        <div key={i.rotulo} className="barra-linha">
          <span className="barra-rotulo">{i.rotulo}</span>
          <div className="barra-trilho">
            <div className={`barra-preenche ${destaqueMenor && i.valor === menor ? 'melhor' : ''}`} style={{ width: `${Math.max(4, (i.valor / max) * 100)}%` }} />
          </div>
          <span className="barra-valor">{formato(i.valor)}</span>
        </div>
      ))}
    </div>
  );
}

export function Spark({ valores, cor = '#16a34a', largura = 160, altura = 36 }) {
  if (!valores || valores.length < 2) return <svg width={largura} height={altura} />;
  const [min, max] = limites(valores);
  const sx = escala(0, valores.length - 1, largura);
  const sy = escala(min, max, altura - 4, true);
  const d = valores.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${(sy(v) + 2).toFixed(1)}`).join(' ');
  return (
    <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} className="spark">
      <path d={d} fill="none" stroke={cor} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
