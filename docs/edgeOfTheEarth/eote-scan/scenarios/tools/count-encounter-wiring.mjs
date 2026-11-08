import fs from 'node:fs';
const root = 'src/cards/encounter-entries/edgeOfTheEarth';
for (const dir of fs.readdirSync(root)) {
  const full = `${root}/${dir}`;
  if (!fs.statSync(full).isDirectory()) continue;
  let encounterResolve = 0, resolveKind = 0, testRule = 0, total = 0;
  const subdirs = [full, ...fs.readdirSync(full).filter(n=>fs.statSync(`${full}/${n}`).isDirectory()).map(n=>`${full}/${n}`)];
  for (const sd of subdirs) {
    for (const f of fs.readdirSync(sd).filter(n=>n.endsWith('.js'))) {
      const t = fs.readFileSync(`${sd}/${f}`, 'utf8');
      total++;
      if (/encounterResolve/.test(t)) encounterResolve++;
      if (/resolveKind/.test(t)) resolveKind++;
      if (/treacheryRule:\s*\{[^}]*test|treacheryTest|test:/.test(t)) testRule++;
    }
  }
  console.log(dir.padEnd(28), 'files', String(total).padStart(3), '| encounterResolve', encounterResolve, '| resolveKind', resolveKind);
}
