import { buscar, consultar, executar, transacao } from '../banco.js';
import { conferirSenha, gerarToken, hashSenha } from '../auth.js';
import { agora, erro, exigirTexto, inteiro } from '../util.js';
import { criado, semConteudo } from '../http.js';
import { compararItens } from './catalogo.js';

const publico = (u) => ({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, mercado_id: u.mercado_id });

function lista(listaId, usuario) {
  const l = buscar('SELECT id, usuario_id, nome, criada_em FROM listas WHERE id = ?', Number(listaId));
  if (!l || (l.usuario_id !== usuario.id && usuario.papel !== 'ADMIN')) throw erro(404, 'Lista não encontrada');
  const itens = consultar(
    `SELECT li.produto_id, p.nome, li.quantidade FROM lista_itens li JOIN produtos p ON p.id = li.produto_id WHERE li.lista_id = ? ORDER BY p.nome`, l.id,
  );
  return { ...l, itens };
}

export const rotasUsuarios = [
  {
    metodo: 'POST', caminho: '/api/auth/registro', tag: 'Autenticação', resumo: 'Cadastra um novo consumidor',
    corpo: { nome: ['string', 'Maria Silva'], email: ['string', 'maria@email.com'], senha: ['string', 'minhasenha'] },
    handler: ({ corpo }) => {
      const nome = exigirTexto(corpo.nome, 'nome', 2, 80);
      const email = exigirTexto(corpo.email, 'email', 5, 120).toLowerCase();
      const senha = exigirTexto(corpo.senha, 'senha', 6, 100);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw erro(400, 'E-mail inválido');
      if (buscar('SELECT 1 AS x FROM usuarios WHERE email = ?', email)) throw erro(409, 'E-mail já cadastrado');
      const r = executar('INSERT INTO usuarios (nome,email,senha_hash,papel,criado_em) VALUES (?,?,?,?,?)', nome, email, hashSenha(senha), 'USUARIO', agora());
      const usuario = buscar('SELECT id, nome, email, papel, mercado_id FROM usuarios WHERE id = ?', r.id);
      return criado({ token: gerarToken(usuario), usuario: publico(usuario) });
    },
  },
  {
    metodo: 'POST', caminho: '/api/auth/login', tag: 'Autenticação', resumo: 'Autentica e devolve o token JWT',
    corpo: { email: ['string', 'user@gmail.com'], senha: ['string', 'user123'] },
    handler: ({ corpo }) => {
      const email = exigirTexto(corpo.email, 'email', 3, 120).toLowerCase();
      const senha = exigirTexto(corpo.senha, 'senha', 1, 100);
      const u = buscar('SELECT * FROM usuarios WHERE email = ?', email);
      if (!u || !conferirSenha(senha, u.senha_hash)) throw erro(401, 'E-mail ou senha incorretos');
      return { token: gerarToken(u), usuario: publico(u) };
    },
  },
  {
    metodo: 'GET', caminho: '/api/auth/perfil', tag: 'Autenticação', papeis: [], resumo: 'Dados do usuário autenticado',
    handler: ({ usuario }) => publico(usuario),
  },
  {
    metodo: 'GET', caminho: '/api/listas', tag: 'Listas', papeis: [], resumo: 'Listas de compras do usuário',
    handler: ({ usuario }) =>
      consultar('SELECT id FROM listas WHERE usuario_id = ? ORDER BY id DESC', usuario.id).map((l) => lista(l.id, usuario)),
  },
  {
    metodo: 'POST', caminho: '/api/listas', tag: 'Listas', papeis: [], resumo: 'Cria uma lista de compras',
    corpo: { nome: ['string', 'Compras do mês'], itens: ['array', [{ produto_id: 1, quantidade: 2 }]] },
    handler: ({ corpo, usuario }) => {
      const nome = exigirTexto(corpo.nome, 'nome', 1, 80);
      if (!Array.isArray(corpo.itens) || !corpo.itens.length) throw erro(400, 'A lista precisa ter ao menos um item');
      return transacao(() => {
        const l = executar('INSERT INTO listas (usuario_id, nome, criada_em) VALUES (?,?,?)', usuario.id, nome, agora());
        for (const it of corpo.itens) {
          const produtoId = Number(it.produto_id);
          const qtd = inteiro(it.quantidade, 1);
          if (!buscar('SELECT 1 AS x FROM produtos WHERE id = ?', produtoId) || qtd < 1) throw erro(400, 'Item inválido na lista');
          executar(
            'INSERT INTO lista_itens (lista_id, produto_id, quantidade) VALUES (?,?,?) ON CONFLICT(lista_id, produto_id) DO UPDATE SET quantidade = quantidade + excluded.quantidade',
            l.id, produtoId, qtd,
          );
        }
        return criado(lista(l.id, usuario));
      });
    },
  },
  {
    metodo: 'GET', caminho: '/api/listas/:id', tag: 'Listas', papeis: [], resumo: 'Detalhes de uma lista',
    handler: ({ params, usuario }) => lista(params.id, usuario),
  },
  {
    metodo: 'DELETE', caminho: '/api/listas/:id', tag: 'Listas', papeis: [], resumo: 'Exclui uma lista',
    handler: ({ params, usuario }) => {
      const l = lista(params.id, usuario);
      executar('DELETE FROM listas WHERE id = ?', l.id);
      return semConteudo();
    },
  },
  {
    metodo: 'GET', caminho: '/api/listas/:id/otimizar', tag: 'Comparação', papeis: [], resumo: 'Descobre em qual mercado a lista fica mais barata',
    handler: ({ params, usuario }) => {
      const l = lista(params.id, usuario);
      if (!l.itens.length) throw erro(400, 'A lista está vazia');
      return { lista: l, ...compararItens(l.itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade }))) };
    },
  },
  {
    metodo: 'GET', caminho: '/api/favoritos', tag: 'Favoritos', papeis: [], resumo: 'Produtos favoritos do usuário',
    handler: ({ usuario }) =>
      consultar(
        `SELECT p.id, p.nome, p.imagem_url, (SELECT MIN(preco) FROM precos WHERE produto_id = p.id) AS menor_preco
         FROM favoritos f JOIN produtos p ON p.id = f.produto_id WHERE f.usuario_id = ? ORDER BY p.nome`, usuario.id,
      ),
  },
  {
    metodo: 'PUT', caminho: '/api/favoritos/:produtoId', tag: 'Favoritos', papeis: [], resumo: 'Marca um produto como favorito (recebe alerta de queda de preço)',
    handler: ({ params, usuario }) => {
      const id = Number(params.produtoId);
      if (!buscar('SELECT 1 AS x FROM produtos WHERE id = ?', id)) throw erro(404, 'Produto não encontrado');
      executar('INSERT OR IGNORE INTO favoritos (usuario_id, produto_id) VALUES (?,?)', usuario.id, id);
      return { produto_id: id, favorito: true };
    },
  },
  {
    metodo: 'DELETE', caminho: '/api/favoritos/:produtoId', tag: 'Favoritos', papeis: [], resumo: 'Remove dos favoritos',
    handler: ({ params, usuario }) => {
      executar('DELETE FROM favoritos WHERE usuario_id = ? AND produto_id = ?', usuario.id, Number(params.produtoId));
      return semConteudo();
    },
  },
  {
    metodo: 'GET', caminho: '/api/notificacoes', tag: 'Notificações', papeis: [], resumo: 'Notificações do usuário (queda de preço, alertas IoT)',
    handler: ({ usuario }) => consultar('SELECT id, tipo, mensagem, lida, criada_em FROM notificacoes WHERE usuario_id = ? ORDER BY id DESC LIMIT 50', usuario.id),
  },
  {
    metodo: 'POST', caminho: '/api/notificacoes/lidas', tag: 'Notificações', papeis: [], resumo: 'Marca todas as notificações como lidas',
    handler: ({ usuario }) => ({ atualizadas: executar('UPDATE notificacoes SET lida = 1 WHERE usuario_id = ? AND lida = 0', usuario.id).alteradas }),
  },
  {
    metodo: 'GET', caminho: '/api/admin/metricas', tag: 'Administração', papeis: ['ADMIN'], resumo: 'Indicadores gerais do sistema',
    handler: () => ({
      usuarios: buscar('SELECT COUNT(*) AS n FROM usuarios').n,
      mercados: buscar('SELECT COUNT(*) AS n FROM mercados').n,
      produtos: buscar('SELECT COUNT(*) AS n FROM produtos').n,
      ofertas: buscar('SELECT COUNT(*) AS n FROM precos').n,
      dispositivos: buscar('SELECT COUNT(*) AS n FROM dispositivos').n,
      leituras: buscar('SELECT COUNT(*) AS n FROM leituras').n,
      alertas_abertos: buscar('SELECT COUNT(*) AS n FROM alertas WHERE resolvido_em IS NULL').n,
      produtos_por_categoria: consultar('SELECT c.nome AS categoria, COUNT(p.id) AS total FROM categorias c LEFT JOIN produtos p ON p.categoria_id = c.id GROUP BY c.id ORDER BY total DESC'),
    }),
  },
  {
    metodo: 'GET', caminho: '/api/admin/usuarios', tag: 'Administração', papeis: ['ADMIN'], resumo: 'Lista usuários',
    handler: () => consultar('SELECT id, nome, email, papel, mercado_id, criado_em FROM usuarios ORDER BY id'),
  },
  {
    metodo: 'PUT', caminho: '/api/admin/usuarios/:id', tag: 'Administração', papeis: ['ADMIN'], resumo: 'Altera o papel de um usuário (e o mercado que ele gerencia)',
    corpo: { papel: ['string', 'MERCADO', 'USUARIO | MERCADO | ADMIN'], 'mercado_id?': ['integer', 1] },
    handler: ({ params, corpo }) => {
      const papel = String(corpo.papel);
      if (!['USUARIO', 'MERCADO', 'ADMIN'].includes(papel)) throw erro(400, 'Papel inválido');
      let mercadoId = null;
      if (papel === 'MERCADO') {
        mercadoId = Number(corpo.mercado_id);
        if (!buscar('SELECT 1 AS x FROM mercados WHERE id = ?', mercadoId)) throw erro(400, 'Informe um mercado_id válido para o papel MERCADO');
      }
      const r = executar('UPDATE usuarios SET papel = ?, mercado_id = ? WHERE id = ?', papel, mercadoId, Number(params.id));
      if (!r.alteradas) throw erro(404, 'Usuário não encontrado');
      return buscar('SELECT id, nome, email, papel, mercado_id FROM usuarios WHERE id = ?', Number(params.id));
    },
  },
  {
    metodo: 'DELETE', caminho: '/api/admin/usuarios/:id', tag: 'Administração', papeis: ['ADMIN'], resumo: 'Exclui um usuário',
    handler: ({ params, usuario }) => {
      if (Number(params.id) === usuario.id) throw erro(400, 'Você não pode excluir a si mesmo');
      const r = executar('DELETE FROM usuarios WHERE id = ?', Number(params.id));
      if (!r.alteradas) throw erro(404, 'Usuário não encontrado');
      return semConteudo();
    },
  },
  {
    metodo: 'POST', caminho: '/api/admin/categorias', tag: 'Administração', papeis: ['ADMIN'], resumo: 'Cria uma categoria',
    corpo: { nome: ['string', 'Adega'], 'icone?': ['string', '🍷'] },
    handler: ({ corpo }) => {
      const nome = exigirTexto(corpo.nome, 'nome', 2, 40);
      if (buscar('SELECT 1 AS x FROM categorias WHERE nome = ?', nome)) throw erro(409, 'Categoria já existe');
      const r = executar('INSERT INTO categorias (nome, icone) VALUES (?,?)', nome, corpo.icone || '📦');
      return criado({ id: r.id, nome, icone: corpo.icone || '📦' });
    },
  },
];
