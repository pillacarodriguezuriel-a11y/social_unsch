import crypto from 'crypto';

function generateKeyPair() {
  console.log('[Keys Generator]: Generando par de llaves RSA de 2048 bits para firma RS256...');

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  // Reemplazar saltos de línea para codificar en una sola línea de .env
  const formattedPrivateKey = privateKey.replace(/\r?\n/g, '\\n');
  const formattedPublicKey = publicKey.replace(/\r?\n/g, '\\n');

  console.log('\n--- COPIAR Y PEGAR EN TU ARCHIVO .env ---\n');
  console.log(`JWT_PRIVATE_KEY="${formattedPrivateKey}"`);
  console.log(`JWT_PUBLIC_KEY="${formattedPublicKey}"`);
  console.log('\n----------------------------------------\n');
}

generateKeyPair();
