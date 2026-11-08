const fs = require('node:fs');
const os = require('node:os');
const { caminho, exigirNode, executarSincrono, iniciar } = require('./comum');

exigirNode();

const modo = process.argv[2] || 'web';
const PORTA_API = Number(process.env.PORT || 3333);
const URL_API = `http://localhost:${PORTA_API}`;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiNoAr() {
  try {
    const r = await fetch(`${URL_API}/api/saude`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

function enderecosRede() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

async function iniciarApiESimulador() {
  if (await apiNoAr()) {
    console.log(`[bac] API já está rodando em ${URL_API}`);
    return;
  }
  iniciar(process.execPath, ['--disable-warning=ExperimentalWarning', caminho('backend', 'src', 'servidor.js')]);
  for (let i = 0; i < 40 && !(await apiNoAr()); i++) await dormir(500);
  if (!(await apiNoAr())) {
    console.error('[bac] A API não iniciou. Veja as mensagens acima.');
    process.exit(1);
  }
  iniciar(process.execPath, [caminho('simulador', 'index.js')], { env: { ...process.env, BAC_API: URL_API } });
}

function garantirDependencias(pasta, marcador) {
  if (fs.existsSync(caminho(pasta, 'node_modules', marcador))) return;
  console.log(`[bac] Instalando dependências de "${pasta}" (primeira execução)...`);
  executarSincrono('node scripts/instalar.js', caminho());
}

function iniciarWeb() {
  garantirDependencias('web', 'vite');
  iniciar(process.execPath, [caminho('web', 'node_modules', 'vite', 'bin', 'vite.js')], { cwd: caminho('web') });
  console.log('\n[bac] Site:           http://localhost:5173');
  console.log(`[bac] Documentação:   ${URL_API}/api/docs`);
  console.log('[bac] Contas de teste: user@gmail.com / user123  |  savegnago@market.com / market123  |  admin@bac.com / admin123\n');
}

function iniciarMobile() {
  garantirDependencias('mobile', 'expo');
  const ips = enderecosRede();
  console.log(`\n[bac] API para o celular: ${ips.length ? ips.map((ip) => `http://${ip}:${PORTA_API}`).join(' ou ') : URL_API}`);
  console.log('[bac] Abra o app Expo Go no celular (mesma rede Wi-Fi) e leia o QR Code abaixo.');
  console.log('[bac] Se o Windows perguntar sobre o Firewall, clique em "Permitir acesso" (rede privada).\n');
  iniciar('npx expo start', [], { cwd: caminho('mobile'), shell: true });
}

(async () => {
  await iniciarApiESimulador();
  if (modo === 'web' || modo === 'tudo') iniciarWeb();
  if (modo === 'mobile' || modo === 'tudo') iniciarMobile();
  if (modo === 'api') console.log(`\n[bac] API: ${URL_API}/api  |  Documentação: ${URL_API}/api/docs\n`);
  setInterval(() => {}, 1 << 30);
})();
