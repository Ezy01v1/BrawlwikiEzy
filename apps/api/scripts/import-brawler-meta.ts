import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { convertBrawlifyBrawlers } from '../src/assets/brawler-meta';

const input = process.argv[2];
if (!input) {
  console.error('Uso: npm run meta:import -w @brawlwiki/api -- <ruta ABSOLUTA a brawlers.json de Brawlify>');
  process.exit(1);
}

const meta = convertBrawlifyBrawlers(JSON.parse(readFileSync(resolve(input), 'utf8')));
const out = new URL('../src/assets/brawler-meta.json', import.meta.url);
writeFileSync(out, `${JSON.stringify(meta, null, 2)}\n`);
console.log(`brawler-meta.json actualizado: ${Object.keys(meta).length} brawlers`);
