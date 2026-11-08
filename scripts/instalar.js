const fs = require('node:fs');
const { caminho, exigirNode, executarSincrono } = require('./comum');

if (process.env.BAC_PULAR_INSTALACAO) process.exit(0);
exigirNode();

function instalarWeb() {
  console.log('\n[1/2] Instalando dependências do site (web)...\n');
  executarSincrono('npm install --no-fund --no-audit', caminho('web'));
}

function instalarMobile() {
  console.log('\n[2/2] Instalando dependências do aplicativo (mobile / Expo)...\n');
  executarSincrono('npm install --no-fund --no-audit', caminho('mobile'));
  const pacote = JSON.parse(fs.readFileSync(caminho('mobile', 'package.json'), 'utf8'));
  const necessarios = ['react', 'react-native', 'react-native-svg', '@react-native-async-storage/async-storage', 'expo-constants', 'expo-status-bar'];
  const faltando = necessarios.filter((n) => !(pacote.dependencies || {})[n]);
  if (faltando.length) executarSincrono(`npx --yes expo install ${faltando.join(' ')}`, caminho('mobile'));
}

let falhas = 0;
for (const [nome, fn] of [['web', instalarWeb], ['mobile', instalarMobile]]) {
  try {
    fn();
  } catch {
    falhas++;
    console.error(`\nAviso: a instalação de "${nome}" falhou. Verifique sua internet e rode "npm install" novamente.\n`);
  }
}

if (!falhas) console.log('\nTudo instalado! Para iniciar:  npm start   (site)   |   npm run mobile   (celular)\n');
