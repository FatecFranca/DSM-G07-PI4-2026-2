import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { numero } from './formatos';

export const cores = {
  verde: '#16a34a',
  verdeEscuro: '#15803d',
  verdeClaro: '#dcfce7',
  fundo: '#f1f5f9',
  card: '#ffffff',
  texto: '#0f172a',
  suave: '#64748b',
  borda: '#e2e8f0',
  erro: '#dc2626',
  alerta: '#d97706',
};

export const CORES_SERIES = ['#16a34a', '#2563eb', '#d97706', '#9333ea', '#dc2626', '#0891b2'];

export const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: 16, paddingBottom: 32 },
  titulo: { fontSize: 24, fontWeight: '800', color: cores.texto, marginBottom: 4 },
  subtitulo: { fontSize: 18, fontWeight: '800', color: cores.texto, marginTop: 18, marginBottom: 8 },
  suave: { color: cores.suave, fontSize: 13 },
  card: { backgroundColor: cores.card, borderRadius: 14, borderWidth: 1, borderColor: cores.borda, padding: 12, marginBottom: 10 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: cores.borda, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: cores.texto },
  rotulo: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 4, marginTop: 10 },
});

export function Botao({ titulo, aoPressionar, tipo = 'primario', desabilitado, pequeno }) {
  const claro = tipo === 'claro';
  return (
    <Pressable
      onPress={aoPressionar}
      disabled={desabilitado}
      style={({ pressed }) => [
        { backgroundColor: claro ? '#fff' : cores.verde, borderWidth: 1, borderColor: claro ? cores.borda : cores.verde, borderRadius: 10, paddingVertical: pequeno ? 7 : 12, paddingHorizontal: pequeno ? 12 : 16, alignItems: 'center', opacity: desabilitado ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={{ color: claro ? cores.texto : '#fff', fontWeight: '700', fontSize: pequeno ? 13 : 15 }}>{titulo}</Text>
    </Pressable>
  );
}

export function Selo({ tipo = 'neutro', children }) {
  const mapa = { neutro: ['#e2e8f0', '#334155'], ok: ['#dcfce7', '#166534'], alerta: ['#fef3c7', '#92400e'], erro: ['#fee2e2', '#991b1b'] };
  const [fundo, texto] = mapa[tipo];
  return (
    <View style={{ backgroundColor: fundo, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: texto, fontSize: 11, fontWeight: '800' }}>{children}</Text>
    </View>
  );
}

export function Aviso({ texto, tipo = 'erro' }) {
  if (!texto) return null;
  const ok = tipo === 'ok';
  return (
    <View style={{ backgroundColor: ok ? '#dcfce7' : '#fee2e2', borderRadius: 10, padding: 10, marginBottom: 10 }}>
      <Text style={{ color: ok ? '#166534' : '#991b1b' }}>{texto}</Text>
    </View>
  );
}

export function KPI({ titulo, valor, detalhe, cor }) {
  return (
    <View style={[estilos.card, { width: '48%', marginBottom: 8 }]}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: cores.suave, textTransform: 'uppercase' }}>{titulo}</Text>
      <Text style={{ fontSize: 20, fontWeight: '900', color: cor || cores.texto }}>{valor}</Text>
      {detalhe ? <Text style={estilos.suave}>{detalhe}</Text> : null}
    </View>
  );
}

export function Imagem({ uri, icone = '📦', tamanho = 56 }) {
  const [falhou, setFalhou] = useState(false);
  if (!uri || falhou) {
    return (
      <View style={{ width: tamanho, height: tamanho, borderRadius: 10, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: tamanho * 0.5 }}>{icone}</Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={{ width: tamanho, height: tamanho, borderRadius: 10 }} onError={() => setFalhou(true)} />;
}

export function Barras({ itens, formato, destaqueMenor = true }) {
  if (!itens.length) return null;
  const max = Math.max(...itens.map((i) => i.valor));
  const menor = Math.min(...itens.map((i) => i.valor));
  return (
    <View style={{ gap: 6, marginVertical: 6 }}>
      {itens.map((i) => (
        <View key={i.rotulo} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ width: 78, fontSize: 12, color: cores.texto }} numberOfLines={1}>{i.rotulo}</Text>
          <View style={{ flex: 1, height: 14, backgroundColor: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            <View style={{ width: `${Math.max(4, (i.valor / max) * 100)}%`, height: '100%', backgroundColor: destaqueMenor && i.valor === menor ? cores.verde : '#94a3b8' }} />
          </View>
          <Text style={{ width: 70, textAlign: 'right', fontWeight: '700', fontSize: 12 }}>{formato(i.valor)}</Text>
        </View>
      ))}
    </View>
  );
}

function intervalo(valores) {
  let min = Math.min(...valores);
  let max = Math.max(...valores);
  if (min === max) { min -= 1; max += 1; }
  const folga = (max - min) * 0.08;
  return [min - folga, max + folga];
}

export function GraficoLinha({ series, linhas = [], formatoX = (x) => String(x), formatoY = (y) => numero(y, 1), altura = 200 }) {
  const [largura, setLargura] = useState(320);
  const todos = series.flatMap((s) => s.pontos);
  if (!todos.length) return <Text style={estilos.suave}>Sem dados para exibir.</Text>;
  const m = { e: 44, d: 8, t: 8, b: 22 };
  const w = largura - m.e - m.d;
  const h = altura - m.t - m.b;
  const xmin = Math.min(...todos.map((p) => p.x));
  const xmax = Math.max(...todos.map((p) => p.x));
  const [ymin, ymax] = intervalo([...todos.map((p) => p.y), ...linhas.map((l) => l.y)]);
  const sx = (x) => ((x - xmin) / (xmax - xmin || 1)) * w;
  const sy = (y) => h - ((y - ymin) / (ymax - ymin || 1)) * h;
  const ticksY = [0, 1, 2, 3].map((i) => ymin + ((ymax - ymin) * i) / 3);
  const ticksX = [0, 1, 2].map((i) => xmin + ((xmax - xmin) * i) / 2);
  return (
    <View style={[estilos.card, { padding: 6 }]} onLayout={(e) => setLargura(e.nativeEvent.layout.width - 12)}>
      <Svg width={largura} height={altura}>
        {ticksY.map((t, i) => (
          <React.Fragment key={i}>
            <Line x1={m.e} x2={m.e + w} y1={m.t + sy(t)} y2={m.t + sy(t)} stroke="#e2e8f0" strokeWidth="1" />
            <SvgText x={m.e - 4} y={m.t + sy(t) + 4} fontSize="10" fill="#64748b" textAnchor="end">{formatoY(t)}</SvgText>
          </React.Fragment>
        ))}
        {ticksX.map((t, i) => (
          <SvgText key={i} x={m.e + sx(t)} y={altura - 6} fontSize="10" fill="#64748b" textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>{formatoX(t)}</SvgText>
        ))}
        {linhas.map((l, i) => (
          <React.Fragment key={i}>
            <Line x1={m.e} x2={m.e + w} y1={m.t + sy(l.y)} y2={m.t + sy(l.y)} stroke={l.cor || cores.erro} strokeWidth="1.4" strokeDasharray="5,4" />
            <SvgText x={m.e + w - 2} y={m.t + sy(l.y) - 3} fontSize="10" fill={l.cor || cores.erro} textAnchor="end">{l.rotulo}</SvgText>
          </React.Fragment>
        ))}
        {series.map((s, i) => (
          <Path
            key={s.nome}
            d={s.pontos.map((p, j) => `${j ? 'L' : 'M'}${(m.e + sx(p.x)).toFixed(1)},${(m.t + sy(p.y)).toFixed(1)}`).join(' ')}
            stroke={s.cor || CORES_SERIES[i % CORES_SERIES.length]}
            strokeWidth={2}
            strokeDasharray={s.tracejado ? '6,4' : undefined}
            fill="none"
          />
        ))}
      </Svg>
      {series.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 6 }}>
          {series.map((s, i) => (
            <View key={s.nome} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: s.cor || CORES_SERIES[i % CORES_SERIES.length] }} />
              <Text style={{ fontSize: 11, color: cores.suave }}>{s.nome}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function Histograma({ bins, altura = 150 }) {
  const [largura, setLargura] = useState(320);
  if (!bins.length) return null;
  const m = { e: 28, t: 8, b: 22 };
  const w = largura - m.e - 8;
  const h = altura - m.t - m.b;
  const fmax = Math.max(...bins.map((b) => b.frequencia));
  const larg = w / bins.length;
  return (
    <View style={[estilos.card, { padding: 6 }]} onLayout={(e) => setLargura(e.nativeEvent.layout.width - 12)}>
      <Svg width={largura} height={altura}>
        {bins.map((b, i) => {
          const alt = (b.frequencia / fmax) * h;
          return <Rect key={i} x={m.e + i * larg + 1} y={m.t + h - alt} width={Math.max(2, larg - 2)} height={alt} rx="2" fill="#16a34a" opacity="0.85" />;
        })}
        <SvgText x={m.e} y={altura - 6} fontSize="10" fill="#64748b">{numero(bins[0].de, 1)}</SvgText>
        <SvgText x={m.e + w} y={altura - 6} fontSize="10" fill="#64748b" textAnchor="end">{numero(bins[bins.length - 1].ate, 1)}</SvgText>
        <SvgText x={m.e - 4} y={m.t + 8} fontSize="10" fill="#64748b" textAnchor="end">{fmax}</SvgText>
      </Svg>
    </View>
  );
}

export function Spark({ valores, cor = cores.verde, largura = 140, altura = 34 }) {
  if (!valores || valores.length < 2) return <View style={{ width: largura, height: altura }} />;
  const [min, max] = intervalo(valores);
  const d = valores.map((v, i) => `${i ? 'L' : 'M'}${((i / (valores.length - 1)) * largura).toFixed(1)},${(altura - 3 - ((v - min) / (max - min || 1)) * (altura - 6)).toFixed(1)}`).join(' ');
  return (
    <Svg width={largura} height={altura}>
      <Path d={d} stroke={cor} strokeWidth="2" fill="none" />
    </Svg>
  );
}
