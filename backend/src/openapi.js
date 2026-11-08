const TIPOS = { string: 'string', integer: 'integer', number: 'number', boolean: 'boolean', array: 'array' };

function esquemaCampo([tipo, exemplo, descricao]) {
  const esquema = { type: TIPOS[tipo] || 'string', example: exemplo };
  if (tipo === 'array') esquema.items = { type: 'object' };
  if (descricao) esquema.description = descricao;
  return esquema;
}

export function gerarOpenApi(rotas) {
  const paths = {};
  const tags = new Set();

  for (const r of rotas) {
    const caminho = r.caminho.replace(/:([a-zA-Z_]+)/g, '{$1}');
    paths[caminho] ||= {};
    tags.add(r.tag);

    const parametros = [...r.caminho.matchAll(/:([a-zA-Z_]+)/g)].map((m) => ({
      name: m[1], in: 'path', required: true, schema: { type: m[1].toLowerCase().includes('id') ? 'integer' : 'string' },
    }));
    for (const [nome, tipo, descricao] of r.query || []) {
      parametros.push({ name: nome, in: 'query', required: false, description: descricao, schema: { type: TIPOS[tipo] || 'string' } });
    }

    const operacao = {
      tags: [r.tag],
      summary: r.resumo,
      parameters: parametros,
      responses: {
        [r.metodo === 'POST' && !r.caminho.includes('login') && !r.caminho.includes('leituras') && !r.caminho.includes('comparar') && !r.caminho.includes('lidas') ? '201' : r.metodo === 'DELETE' ? '204' : '200']: { description: 'Sucesso' },
        400: { description: 'Requisição inválida' },
        404: { description: 'Recurso não encontrado' },
      },
    };

    if (r.corpo) {
      const propriedades = {};
      const obrigatorios = [];
      for (const [chave, def] of Object.entries(r.corpo)) {
        const opcional = chave.endsWith('?');
        const nome = opcional ? chave.slice(0, -1) : chave;
        propriedades[nome] = esquemaCampo(def);
        if (!opcional) obrigatorios.push(nome);
      }
      operacao.requestBody = {
        required: true,
        content: { 'application/json': { schema: { type: 'object', properties: propriedades, required: obrigatorios } } },
      };
    }

    if (r.papeis) {
      operacao.security = [{ bearerAuth: [] }];
      operacao.responses[401] = { description: 'Token ausente ou inválido' };
      if (r.papeis.length) {
        operacao.description = `Perfis autorizados: ${r.papeis.join(', ')}`;
        operacao.responses[403] = { description: 'Sem permissão' };
      }
    } else if (r.seguranca === 'chaveIot') {
      operacao.security = [{ chaveIot: [] }];
      operacao.responses[401] = { description: 'Chave IoT inválida' };
    }

    paths[caminho][r.metodo.toLowerCase()] = operacao;
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'BAC – API de Comparação de Preços de Supermercados com IoT',
      version: '4.0.0',
      description:
        'API RESTful do projeto BAC (PI – 4º semestre DSM, FATEC Franca). Compara preços entre supermercados e recebe dados de sensores/atuadores IoT (câmaras frias, freezers, balanças de gôndola) que alimentam dashboards web e mobile.\n\n' +
        '**Como testar:** faça login em `POST /api/auth/login` (ex.: `admin@bac.com` / `admin123`), copie o token e clique em **Authorize**.',
    },
    servers: [{ url: '/' }],
    tags: [...tags].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        chaveIot: { type: 'apiKey', in: 'header', name: 'X-Chave-Iot', description: 'Chave do supermercado (GET /api/iot/mercados/{id}/chave)' },
      },
    },
  };
}

export const paginaSwagger = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>BAC – Documentação da API</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css">
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>
window.onload = () => SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger-ui', persistAuthorization: true });
</script>
</body>
</html>`;
