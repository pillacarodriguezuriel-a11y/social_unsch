'use strict';
/**
 * Pruebas de la comprobación de límites (node --test).
 * Construye un repositorio ficticio con una infracción por regla y verifica que se detecta.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkBoundaries, parseImports } = require('./check-boundaries');

function write(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limites-'));
  for (const [rel, content] of Object.entries(files)) write(root, rel, content);
  return root;
}

test('el repositorio actual no tiene infracciones', () => {
  assert.deepEqual(checkBoundaries(path.join(__dirname, '..')), []);
});

test('parseImports distingue imports de tipos', () => {
  const found = parseImports(
    "import type { A } from '@social-unsch/contracts';\nimport { B } from 'zod';\nimport './side';\nconst c = require('pg');"
  );
  assert.deepEqual(found, [
    { spec: '@social-unsch/contracts', typeOnly: true },
    { spec: 'zod', typeOnly: false },
    { spec: './side', typeOnly: false },
    { spec: 'pg', typeOnly: false },
  ]);
});

test('detecta una infracción por cada regla', () => {
  const root = fixture({
    'apps/web/app/a.tsx': "import { pool } from '../../api/src/config/database';\nimport Redis from 'ioredis';",
    'apps/web/app/b.ts': "import { RADAR_NODES } from '@social-unsch/contracts';",
    'apps/web/app/ok.ts': "import type { RadarStatusResponse } from '@social-unsch/contracts';",
    'packages/contracts/src/index.ts': "import { Pool } from 'pg';\nimport { z } from 'zod';",
    'apps/api/src/app.ts': "import x from '../../web/app/a';",
    'apps/api/src/modules/feed/feed.service.ts': "import { AuthRepository } from '../auth/auth.repository';",
    'apps/api/src/modules/auth/auth.repository.ts': "export class AuthRepository {}",
    'apps/api/src/modules/radar/radar.repository.ts':
      "import Redis from 'ioredis';\nimport { pool } from '../../config/database';\nimport type R from 'ioredis';",
    'apps/api/src/config/database.ts': 'export const pool = {};',
    'apps/web/tests/x.test.ts': "import { RADAR_NODES } from '@social-unsch/contracts';",
    'apps/radar/src/a.ts': "import { createApp } from '@social-unsch/api';",
    'apps/radar/src/b.ts': "import { something } from '@social-unsch/web';",
    'apps/radar/src/c.ts': "import { Pool } from 'pg';",
    'apps/api/src/server.ts': "import { createRadarApp } from '@social-unsch/radar';",
  });

  const rules = checkBoundaries(root).map((v) => `${v.rule}:${v.file}`);
  assert.deepEqual(rules.sort(), [
    'api-sin-radar-interno:apps/api/src/server.ts',
    'api-sin-web:apps/api/src/app.ts',
    'contratos-puros:packages/contracts/src/index.ts',
    'modulos-aislados:apps/api/src/modules/feed/feed.service.ts',
    'radar-sin-api:apps/radar/src/a.ts',
    'radar-sin-conexiones:apps/api/src/modules/radar/radar.repository.ts',
    'radar-sin-conexiones:apps/api/src/modules/radar/radar.repository.ts',
    'radar-sin-pg:apps/radar/src/c.ts',
    'radar-sin-web:apps/radar/src/b.ts',
    'web-contratos-solo-tipo:apps/web/app/b.ts',
    'web-sin-servidor:apps/web/app/a.tsx',
    'web-sin-servidor:apps/web/app/a.tsx',
  ]);
});
