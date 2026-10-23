#!/usr/bin/env node
/**
 * Comprobación de límites entre unidades del monorepo (sin dependencias externas).
 *
 * Reglas:
 *  web-sin-servidor        apps/web no importa código del backend ni paquetes de servidor.
 *  web-contratos-solo-tipo apps/web importa @social-unsch/contracts solo con `import type`.
 *  contratos-puros         packages/contracts solo depende de zod y de sí mismo.
 *  api-sin-web             apps/api no importa código del frontend.
 *  modulos-aislados        un módulo de apps/api/src/modules no importa archivos de otro módulo.
 *  radar-sin-conexiones    el módulo radar no crea conexiones ni usa PostgreSQL: recibe Redis inyectado
 *                          (ioredis solo como `import type`).
 *
 * Uso: node scripts/check-boundaries.js [raíz]   (código de salida 1 si hay infracciones)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', 'coverage', 'tests']);
const SERVER_ONLY = ['pg', 'ioredis', 'express', 'jsonwebtoken', 'bcrypt', 'dotenv', 'helmet', 'cors'];

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...listFiles(path.join(dir, entry.name)));
    } else if (SOURCE_EXT.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

/** Devuelve los imports de un archivo con su especificador y si son solo de tipos. */
function parseImports(source) {
  const imports = [];
  const patterns = [
    /^\s*(import|export)\s+(type\s+)?[^'";]*?\sfrom\s+['"]([^'"]+)['"]/gm,
    /^\s*import\s+['"]([^'"]+)['"]/gm,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  let m;
  while ((m = patterns[0].exec(source))) imports.push({ spec: m[3], typeOnly: Boolean(m[2]) });
  for (const re of patterns.slice(1)) {
    while ((m = re.exec(source))) imports.push({ spec: m[1], typeOnly: false });
  }
  return imports;
}

const isRelative = (spec) => spec.startsWith('.');
const packageName = (spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
const isInside = (file, dir) => {
  const rel = path.relative(dir, file);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

function checkBoundaries(root) {
  const violations = [];
  const web = path.join(root, 'apps', 'web');
  const api = path.join(root, 'apps', 'api');
  const apiSrc = path.join(api, 'src');
  const modulesDir = path.join(apiSrc, 'modules');
  const radarDir = path.join(modulesDir, 'radar');
  const contracts = path.join(root, 'packages', 'contracts', 'src');

  const report = (rule, file, spec, detail) =>
    violations.push({ rule, file: path.relative(root, file).split(path.sep).join('/'), spec, detail });

  const radarApp = path.join(root, 'apps', 'radar');
  const radarAppSrc = path.join(radarApp, 'src');

  for (const file of listFiles(web)) {
    for (const { spec, typeOnly } of parseImports(fs.readFileSync(file, 'utf8'))) {
      if (isRelative(spec)) {
        if (!isInside(path.resolve(path.dirname(file), spec), web)) {
          report('web-sin-servidor', file, spec, 'import relativo fuera de apps/web');
        }
        continue;
      }
      const pkg = packageName(spec);
      if (SERVER_ONLY.includes(pkg) || pkg === '@social-unsch/api' || pkg === '@social-unsch/radar') {
        report('web-sin-servidor', file, spec, 'paquete de servidor importado desde el frontend');
      }
      if (pkg === '@social-unsch/contracts' && !typeOnly) {
        report('web-contratos-solo-tipo', file, spec, 'usar `import type` para no incluir código del contrato en el navegador');
      }
    }
  }

  for (const file of listFiles(contracts)) {
    for (const { spec } of parseImports(fs.readFileSync(file, 'utf8'))) {
      if (isRelative(spec)) {
        if (!isInside(path.resolve(path.dirname(file), spec), contracts)) {
          report('contratos-puros', file, spec, 'import relativo fuera de packages/contracts/src');
        }
      } else if (packageName(spec) !== 'zod') {
        report('contratos-puros', file, spec, 'dependencia no permitida en el contrato (solo zod)');
      }
    }
  }

  for (const file of listFiles(apiSrc)) {
    const moduleOf = (p) => (isInside(p, modulesDir) ? path.relative(modulesDir, p).split(path.sep)[0] : null);
    const ownModule = moduleOf(file);
    for (const { spec, typeOnly } of parseImports(fs.readFileSync(file, 'utf8'))) {
      if (!isRelative(spec)) {
        if (packageName(spec) === '@social-unsch/web') report('api-sin-web', file, spec, 'el backend no importa el frontend');
        if (packageName(spec) === '@social-unsch/radar') report('api-sin-radar-interno', file, spec, 'la API no debe importar el paquete interno de apps/radar');
        if (isInside(file, radarDir)) {
          if (spec === 'pg') report('radar-sin-conexiones', file, spec, 'el radar no usa PostgreSQL');
          if (spec === 'ioredis' && !typeOnly) {
            report('radar-sin-conexiones', file, spec, 'el radar recibe el cliente inyectado; ioredis solo como tipo');
          }
        }
        continue;
      }
      const target = path.resolve(path.dirname(file), spec);
      if (!isInside(target, api)) report('api-sin-web', file, spec, 'import relativo fuera de apps/api');
      if (isInside(target, radarApp)) report('api-sin-radar-interno', file, spec, 'import relativo a apps/radar desde apps/api');
      const targetModule = moduleOf(target);
      if (ownModule && targetModule && targetModule !== ownModule) {
        report('modulos-aislados', file, spec, `el módulo ${ownModule} importa un archivo del módulo ${targetModule}`);
      }
      if (isInside(file, radarDir)) {
        const rel = path.relative(apiSrc, target).split(path.sep).join('/').replace(/\.(ts|js)$/, '');
        if (rel === 'config/database' || rel === 'config/redis') {
          report('radar-sin-conexiones', file, spec, 'el radar no abre conexiones; las recibe de la composición');
        }
      }
    }
  }

  for (const file of listFiles(radarAppSrc)) {
    for (const { spec } of parseImports(fs.readFileSync(file, 'utf8'))) {
      if (isRelative(spec)) {
        if (!isInside(path.resolve(path.dirname(file), spec), radarApp)) {
          report('radar-sin-api', file, spec, 'import relativo fuera de apps/radar');
        }
        continue;
      }
      const pkg = packageName(spec);
      if (pkg === '@social-unsch/api') report('radar-sin-api', file, spec, 'el servicio radar no importa apps/api');
      if (pkg === '@social-unsch/web') report('radar-sin-web', file, spec, 'el servicio radar no importa apps/web');
      if (pkg === 'pg') report('radar-sin-pg', file, spec, 'el servicio radar no usa PostgreSQL');
    }
  }

  return violations;
}

module.exports = { checkBoundaries, parseImports };

if (require.main === module) {
  const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
  const violations = checkBoundaries(root);
  if (violations.length === 0) {
    console.log('[limites]: sin infracciones (web, contratos, api, módulos, radar).');
  } else {
    for (const v of violations) console.error(`[limites]: ${v.rule}: ${v.file} → '${v.spec}' (${v.detail})`);
    console.error(`[limites]: ${violations.length} infracción(es).`);
    process.exit(1);
  }
}
