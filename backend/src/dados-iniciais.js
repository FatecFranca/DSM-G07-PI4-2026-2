import fs from 'node:fs';
import { buscar, consultar, executar, transacao } from './banco.js';
import { hashSenha, gerarChaveIot } from './auth.js';
import { ARQUIVO_CHAVES } from './config.js';
import { normaliza } from './util.js';

function gerador(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const IMG = {
  Mercearia: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400',
  Laticínios: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400',
  Padaria: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400',
  Hortifruti: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400',
  Açougue: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400',
  Bebidas: 'https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400',
  Limpeza: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=400',
  Higiene: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400',
  Pet: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
  Congelados: 'https://images.unsplash.com/photo-1624811533744-f85d5325b49c?w=400',
};

const ICONES = {
  Mercearia: '🛒', Laticínios: '🥛', Padaria: '🍞', Hortifruti: '🥬', Açougue: '🍖',
  Bebidas: '🥤', Limpeza: '🧼', Higiene: '🪥', Pet: '🐶', Congelados: '❄️',
};

const CATALOGO = {
  Mercearia: [
    ['Arroz Tio João Tipo 1 5kg', 28.5], ['Arroz Camil Integral 5kg', 27.9], ['Arroz Prato Fino 5kg', 31.2],
    ['Feijão Carioca Kicaldo 1kg', 6.8], ['Feijão Preto Camil 1kg', 7.4], ['Macarrão Renata Espaguete 500g', 4.2],
    ['Açúcar União Refinado 1kg', 5.1], ['Sal Cisne Refinado 1kg', 3.2], ['Farinha de Trigo Dona Benta 1kg', 5.8],
    ['Óleo de Soja Liza 900ml', 6.2], ['Café Pilão Tradicional 500g', 16.9], ['Molho de Tomate Pomarola 300g', 3.4],
  ],
  Laticínios: [
    ['Leite Italac Integral 1L', 4.8], ['Leite Piracanjuba Semidesnatado 1L', 5.1], ['Manteiga Aviação com Sal 200g', 11.5],
    ['Requeijão Cremoso Vigor 200g', 7.8], ['Queijo Mussarela Fatiado 500g', 24], ['Iogurte Grego Vigor Tradicional 400g', 6.5],
    ['Creme de Leite Nestlé 200g', 3.9], ['Leite Condensado Moça 395g', 6.2],
  ],
  Bebidas: [
    ['Coca-Cola Original 2L', 11.5], ['Guaraná Antarctica 2L', 8.9], ['Suco Del Valle Uva 1L', 6.9],
    ['Cerveja Heineken Long Neck 330ml', 6.2], ['Cerveja Skol Latão 473ml', 4.1], ['Água Mineral Crystal Sem Gás 500ml', 2.2],
    ['Refrigerante Fanta Laranja 2L', 8.5],
  ],
  Açougue: [
    ['Picanha Bovina Resfriada kg', 69.9], ['Alcatra Bovina kg', 42.5], ['Acém Bovino Moído kg', 28.9],
    ['Filé de Peito de Frango Sadia 1kg', 18.9], ['Linguiça Toscana Perdigão kg', 21.9],
  ],
  Hortifruti: [
    ['Banana Prata kg', 6.5], ['Tomate Italiano kg', 8.9], ['Cebola Nacional kg', 5.2], ['Batata Lavada kg', 6.4],
    ['Maçã Gala Fuji kg', 9.8], ['Laranja Pera kg', 4.9], ['Cenoura kg', 4.2],
  ],
  Limpeza: [
    ['Lava Roupas em Pó OMO Protetor 1.6kg', 24.9], ['Detergente Líquido Ypê Neutro 500ml', 2.4],
    ['Desinfetante Pinho Sol Original 1L', 9.8], ['Amaciante Concentrado Downy Brisa 500ml', 14.5],
    ['Água Sanitária Ypê 2L', 6.9], ['Esponja de Aço Bombril 8un', 3.5],
  ],
  Higiene: [
    ['Creme Dental Colgate Total 12 90g', 6.5], ['Sabonete Dove Hidratação 90g', 3.9], ['Shampoo Pantene Restauração 400ml', 19.9],
    ['Papel Higiênico Neve Folha Dupla 12un', 18.5], ['Desodorante Rexona Men 150ml', 14.9],
  ],
  Padaria: [
    ['Pão de Forma Visconti Tradicional 500g', 6.9], ['Bisnaguinha Panco 300g', 7.5], ['Pão Francês kg', 14.9], ['Bolo Pullman Chocolate 250g', 8.9],
  ],
  Pet: [
    ['Ração Pedigree Adulto Raças Médias 1kg', 17.9], ['Ração Whiskas Gatos Adultos 1kg', 19.5],
    ['Sachê Dog Chow Carne 100g', 3.2], ['Areia Higiênica Pipicat 4kg', 24.9],
  ],
  Congelados: [
    ['Lasanha à Bolonhesa Sadia 600g', 13.9], ['Batata Frita Congelada McCain 720g', 19.8], ['Pão de Queijo Forno de Minas 400g', 12.5],
    ['Pizza Sadia Mussarela 460g', 22.9], ['Hambúrguer Bovino Seara 672g', 28.9],
  ],
};

const MERCADOS = [
  ['Savegnago', '12345678000101', 'Av. Presidente Vargas, 100 - Franca/SP'],
  ['Tonin', '12345678000102', 'Rua do Comércio, 200 - Franca/SP'],
  ['Assaí', '12345678000103', 'Av. Champagnat, 300 - Franca/SP'],
  ['Atacadão', '12345678000104', 'Rod. Cândido Portinari, 400 - Franca/SP'],
  ['Carrefour', '12345678000105', 'Av. Brasil, 500 - Franca/SP'],
];

const PRODUTOS_GONDOLA = {
  arroz: { nome: 'Arroz Tio João Tipo 1 5kg', pesoUnitario: 5, capacidade: 100 },
  leite: { nome: 'Leite Italac Integral 1L', pesoUnitario: 1, capacidade: 48 },
};

export const DISPOSITIVOS_PADRAO = (produtoArrozId, produtoLeiteId) => [
  { codigo: 'camara_temp', nome: 'Temperatura da câmara fria', local: 'Câmara fria – Laticínios', papel: 'SENSOR', natureza: 'ANALOGICO', tipo: 'TEMPERATURA', unidade: '°C', limite_min: 0, limite_max: 8 },
  { codigo: 'freezer_temp', nome: 'Temperatura do freezer', local: 'Freezer – Congelados', papel: 'SENSOR', natureza: 'ANALOGICO', tipo: 'TEMPERATURA', unidade: '°C', limite_min: -26, limite_max: -12 },
  { codigo: 'gondola_arroz', nome: 'Balança da gôndola de arroz', local: 'Corredor 1 – Mercearia', papel: 'SENSOR', natureza: 'ANALOGICO', tipo: 'PESO', unidade: 'kg', produto_id: produtoArrozId, peso_unitario: PRODUTOS_GONDOLA.arroz.pesoUnitario, capacidade: PRODUTOS_GONDOLA.arroz.capacidade, limite_min: PRODUTOS_GONDOLA.arroz.capacidade * 0.2 },
  { codigo: 'gondola_leite', nome: 'Balança da gôndola de leite', local: 'Corredor 4 – Laticínios', papel: 'SENSOR', natureza: 'ANALOGICO', tipo: 'PESO', unidade: 'kg', produto_id: produtoLeiteId, peso_unitario: PRODUTOS_GONDOLA.leite.pesoUnitario, capacidade: PRODUTOS_GONDOLA.leite.capacidade, limite_min: PRODUTOS_GONDOLA.leite.capacidade * 0.2 },
  { codigo: 'camara_porta', nome: 'Porta da câmara fria', local: 'Câmara fria – Laticínios', papel: 'SENSOR', natureza: 'DIGITAL', tipo: 'PORTA', unidade: '0/1' },
  { codigo: 'presenca', nome: 'Presença no corredor', local: 'Corredor 1 – Mercearia', papel: 'SENSOR', natureza: 'DIGITAL', tipo: 'PRESENCA', unidade: '0/1' },
  { codigo: 'camara_compressor', nome: 'Compressor da câmara fria', local: 'Câmara fria – Laticínios', papel: 'ATUADOR', natureza: 'DIGITAL', tipo: 'COMPRESSOR', unidade: '0/1', estado: 1 },
  { codigo: 'freezer_compressor', nome: 'Compressor do freezer', local: 'Freezer – Congelados', papel: 'ATUADOR', natureza: 'DIGITAL', tipo: 'COMPRESSOR', unidade: '0/1', estado: 1 },
  { codigo: 'led_reposicao', nome: 'Sinalizador LED de reposição', local: 'Corredor 1 – Mercearia', papel: 'ATUADOR', natureza: 'DIGITAL', tipo: 'LED', unidade: '0/1', estado: 0 },
];

const COLUNAS_DISP = ['mercado_id', 'codigo', 'nome', 'local', 'papel', 'natureza', 'tipo', 'unidade', 'limite_min', 'limite_max', 'produto_id', 'peso_unitario', 'capacidade', 'estado'];

function criarDispositivos(mercadoId, produtoArrozId, produtoLeiteId) {
  const ids = {};
  for (const d of DISPOSITIVOS_PADRAO(produtoArrozId, produtoLeiteId)) {
    const linha = { mercado_id: mercadoId, limite_min: null, limite_max: null, produto_id: null, peso_unitario: null, capacidade: null, estado: 0, ...d };
    const r = executar(
      `INSERT INTO dispositivos (${COLUNAS_DISP.join(',')}) VALUES (${COLUNAS_DISP.map(() => '?').join(',')})`,
      ...COLUNAS_DISP.map((c) => linha[c]),
    );
    ids[d.codigo] = r.id;
  }
  return ids;
}

function historicoLeituras(ids, rnd, ajuste) {
  const agora = Date.now();
  const passos = 180;
  const intervalo = 60000;
  const inserir = (dispositivoId, ts, valor) =>
    executar('INSERT INTO leituras (dispositivo_id, valor, registrada_em) VALUES (?,?,?)', dispositivoId, Number(valor.toFixed(3)), new Date(ts).toISOString());
  let camara = 4 + ajuste;
  let freezer = -18;
  let compCamara = 1;
  let compFreezer = 1;
  let arroz = 80 + rnd() * 20;
  let leite = 38 + rnd() * 10;
  for (let i = passos; i >= 1; i--) {
    const ts = agora - i * intervalo;
    camara += (compCamara ? -0.45 : 0.3) + (rnd() - 0.5) * 0.2;
    if (camara > 5.5 + ajuste) compCamara = 1;
    if (camara < 2.5 + ajuste) compCamara = 0;
    freezer += (compFreezer ? -0.35 : 0.25) + (rnd() - 0.5) * 0.15;
    if (freezer > -16.5) compFreezer = 1;
    if (freezer < -19.5) compFreezer = 0;
    arroz = arroz - (rnd() < 0.4 ? 5 : 0) + (rnd() - 0.5) * 0.1;
    if (arroz < 15) arroz = 100;
    leite = leite - (rnd() < 0.4 ? 1 : 0) + (rnd() - 0.5) * 0.05;
    if (leite < 8) leite = 48;
    inserir(ids.camara_temp, ts, camara);
    inserir(ids.freezer_temp, ts, freezer);
    inserir(ids.gondola_arroz, ts, Math.max(0, arroz));
    inserir(ids.gondola_leite, ts, Math.max(0, leite));
    inserir(ids.camara_porta, ts, rnd() < 0.08 ? 1 : 0);
    inserir(ids.presenca, ts, rnd() < 0.5 ? 1 : 0);
    inserir(ids.camara_compressor, ts, compCamara);
    inserir(ids.freezer_compressor, ts, compFreezer);
    inserir(ids.led_reposicao, ts, 0);
  }
}

export function semear() {
  if (buscar('SELECT COUNT(*) AS n FROM usuarios').n > 0) return false;
  const rnd = gerador(20264);
  const agora = new Date().toISOString();

  transacao(() => {
    const chaves = {};
    const mercadoIds = [];
    for (const [nome, cnpj, endereco] of MERCADOS) {
      const chave = gerarChaveIot();
      const m = executar('INSERT INTO mercados (nome, endereco, cnpj, chave_iot) VALUES (?,?,?,?)', nome, endereco, cnpj, chave);
      mercadoIds.push(m.id);
      chaves[m.id] = { mercado: nome, chave };
    }

    executar('INSERT INTO usuarios (nome,email,senha_hash,papel,criado_em) VALUES (?,?,?,?,?)', 'Administrador BAC', 'admin@bac.com', hashSenha('admin123'), 'ADMIN', agora);
    executar('INSERT INTO usuarios (nome,email,senha_hash,papel,criado_em) VALUES (?,?,?,?,?)', 'Consumidor Teste', 'user@gmail.com', hashSenha('user123'), 'USUARIO', agora);
    MERCADOS.forEach(([nome], i) => {
      const email = `${normaliza(nome)}@market.com`;
      executar('INSERT INTO usuarios (nome,email,senha_hash,papel,mercado_id,criado_em) VALUES (?,?,?,?,?,?)', nome, email, hashSenha('market123'), 'MERCADO', mercadoIds[i], agora);
    });

    const produtosGondola = {};
    for (const [nomeCategoria, itens] of Object.entries(CATALOGO)) {
      const cat = executar('INSERT INTO categorias (nome, icone) VALUES (?,?)', nomeCategoria, ICONES[nomeCategoria]);
      for (const [nome, base] of itens) {
        const p = executar('INSERT INTO produtos (nome, nome_busca, categoria_id, imagem_url) VALUES (?,?,?,?)', nome, normaliza(nome), cat.id, IMG[nomeCategoria]);
        if (nome === PRODUTOS_GONDOLA.arroz.nome) produtosGondola.arroz = p.id;
        if (nome === PRODUTOS_GONDOLA.leite.nome) produtosGondola.leite = p.id;
        const fixo = p.id === produtosGondola.arroz || p.id === produtosGondola.leite;
        for (const mercadoId of mercadoIds) {
          if (!fixo && rnd() < 0.07) continue;
          const atual = Number((base * (0.88 + 0.24 * rnd())).toFixed(2));
          const estoque = 8 + Math.floor(rnd() * 120);
          executar('INSERT INTO precos (produto_id, mercado_id, preco, estoque, atualizado_em) VALUES (?,?,?,?,?)', p.id, mercadoId, atual, estoque, agora);
          let preco = atual;
          const dias = [];
          for (let d = 0; d < 30; d++) {
            dias.push(preco);
            preco = Math.max(0.5, preco * (1 + (rnd() - 0.47) * 0.03));
          }
          dias.reverse().forEach((valor, d) => {
            const quando = new Date(Date.now() - (30 - d) * 86400000).toISOString();
            executar('INSERT INTO historico_precos (produto_id, mercado_id, preco, registrado_em) VALUES (?,?,?,?)', p.id, mercadoId, Number(valor.toFixed(2)), quando);
          });
        }
      }
    }

    mercadoIds.forEach((mercadoId, i) => {
      const ids = criarDispositivos(mercadoId, produtosGondola.arroz, produtosGondola.leite);
      historicoLeituras(ids, rnd, (i - 2) * 0.3);
      executar(
        `UPDATE dispositivos SET
           ultimo_valor = (SELECT valor FROM leituras WHERE dispositivo_id = dispositivos.id ORDER BY id DESC LIMIT 1),
           ultima_leitura_em = (SELECT registrada_em FROM leituras WHERE dispositivo_id = dispositivos.id ORDER BY id DESC LIMIT 1)
         WHERE mercado_id = ?`,
        mercadoId,
      );
      executar("UPDATE dispositivos SET estado = CAST(ultimo_valor AS INTEGER) WHERE mercado_id = ? AND papel = 'ATUADOR'", mercadoId);
      const pesoArroz = buscar('SELECT valor FROM leituras WHERE dispositivo_id=? ORDER BY id DESC LIMIT 1', ids.gondola_arroz).valor;
      const pesoLeite = buscar('SELECT valor FROM leituras WHERE dispositivo_id=? ORDER BY id DESC LIMIT 1', ids.gondola_leite).valor;
      executar('UPDATE precos SET estoque=? WHERE produto_id=? AND mercado_id=?', Math.floor(pesoArroz / PRODUTOS_GONDOLA.arroz.pesoUnitario), produtosGondola.arroz, mercadoId);
      executar('UPDATE precos SET estoque=? WHERE produto_id=? AND mercado_id=?', Math.floor(pesoLeite / PRODUTOS_GONDOLA.leite.pesoUnitario), produtosGondola.leite, mercadoId);
    });

    fs.writeFileSync(ARQUIVO_CHAVES, JSON.stringify(chaves, null, 2));
  });
  return true;
}

export function garantirArquivoChaves() {
  if (fs.existsSync(ARQUIVO_CHAVES)) return;
  const chaves = {};
  for (const m of consultar('SELECT id, nome, chave_iot FROM mercados')) chaves[m.id] = { mercado: m.nome, chave: m.chave_iot };
  fs.writeFileSync(ARQUIVO_CHAVES, JSON.stringify(chaves, null, 2));
}
