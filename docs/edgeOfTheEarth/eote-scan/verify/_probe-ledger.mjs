// Verifier probe: ledger "verified" vs executable entry behavior for the 75 fatalMirage codes.
import fs from 'node:fs'
const ROOT = 'G:/boardgame-hall-ai'
const entriesDir = `${ROOT}/games/arkhamhorror/src/cards/encounter-entries/edgeOfTheEarth/fatalMirage`
const findings = JSON.parse(fs.readFileSync(`${ROOT}/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/findings.json`, 'utf8'))
const ledger = JSON.parse(fs.readFileSync(`${ROOT}/games/arkhamhorror/audit/eote-all-card-acceptance.json`, 'utf8'))
const byCode = Object.fromEntries(ledger.records.filter(r => findings.scope.codes.includes(r.code)).map(r => [r.code, r]))

const rows = []
for (const code of findings.scope.codes) {
  const mod = await import(`file:///${entriesDir}/${code}.js`)
  const e = mod.default
  const abilities = (e.abilities || []).length
  const ruleKeys = ['agendaRule', 'actRule', 'enemyRule', 'treacheryRule', 'locationRule', 'storyRule']
    .filter(k => e[k] && (typeof e[k] === 'function' || Object.keys(e[k]).length))
  const hooks = ['encounterResolve', 'afterTest', 'resolveEncounter', 'preAction', 'reaction'].filter(k => typeof e[k] === 'function')
  rows.push({ code, status: byCode[code]?.status, abilities, ruleKeys, hooks })
}
const sum = (list, fn) => list.reduce((n, x) => n + (fn(x) ? 1 : 0), 0)
console.log('total', rows.length)
console.log('with abilities>0', sum(rows, r => r.abilities > 0), rows.filter(r => r.abilities > 0).map(r => `${r.code}:${r.status}:${r.abilities}`).join(','))
console.log('with executable hook', sum(rows, r => r.hooks.length > 0))
console.log('with non-empty *Rule', sum(rows, r => r.ruleKeys.length > 0), rows.filter(r => r.ruleKeys.length > 0).map(r => r.code).join(','))
const verified = rows.filter(r => r.status === 'verified')
console.log('verified', verified.length)
console.log('verified with abilities>0', sum(verified, r => r.abilities > 0))
console.log('verified with only flags (no abilities, no hooks)', sum(verified, r => r.abilities === 0 && r.hooks.length === 0))
console.log('simplified', rows.filter(r => r.status === 'simplified').length)
