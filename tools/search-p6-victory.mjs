// Offline witness search. It only clones states and submits validated commands;
// every winning command stream is replayed from a normal campaignHub creation.
import { createGameState, applyMove, legalMoves, validateMove, decisionSeat, getMaxSanity } from '../src/engine/engine.js'
import { settings, policy } from './p6-playthrough.mjs'
import { writeFileSync } from 'node:fs'

const seed = process.argv[2] || 'p6-0'
const init = { ...settings, seed }, players = [{ seat: 0 }]
let start = createGameState(init, players), prefix = []
function step(s, m, commands) {
  const seat = decisionSeat(s), error = validateMove(s, seat, m)
  if (error) throw new Error(error)
  commands.push({ seat, move: structuredClone(m) }); applyMove(s, seat, m)
}
for (let i = 0; i < 800 && start.scenario?.id !== 'theDevourerBelow'; i++) step(start, policy(start, 'r2', 'rush') || legalMoves(start).find(m => m.action === 'endTurn'), prefix)
function settle(s, commands) {
  for (let i = 0; s.pendingChoice && i < 120; i++) step(s, policy(s, 'r2', 'rush'), commands)
}
settle(start, prefix)
function score(s) {
  if (s.resolution === 'r1' || s.resolution === 'r2') return 10000
  if (s.status !== 'playing' || s.investigators[0].defeated) return -10000
  const i = s.investigators[0], loc = s.locations.find(l => l.id === i.location)
  const danger = s.enemies.filter(e => e.location === i.location && !e.exhausted).reduce((n,e) => n + e.damage + 2 * e.horror, 0)
  const assetHealth = i.assets.reduce((n,a) => n + (a.code === '01095' ? 4 - (a.horror || 0) : ['01018','01021','01033','01117'].includes(a.code) ? 3 : 0), 0)
  const targets = s.locations.filter(l => s.actIndex === 1 ? l.id === 'ritualSite' : l.clues > 0 || (!l.revealed && l.cluesPerInvestigator > 0)).map(l => l.id)
  const queue = [[i.location, 0]], visited = new Set(); let distance = 0
  while (queue.length) {
    const [id, d] = queue.shift(); if (visited.has(id)) continue; visited.add(id)
    if (targets.includes(id)) { distance = d; break }
    for (const n of s.locations.find(l => l.id === id)?.connections || []) if (s.locations.some(l => l.id === n)) queue.push([n, d + 1])
  }
  const blockers = s.enemies.filter(e => e.location === 'mainPath').reduce((n,e) => n + Math.max(0, e.health - e.damageTaken), 0)
  return s.actIndex * 350 + (s.actClues || 0) * 100 + Math.min(i.clues, 3) * 55
    + (i.maxHealth - i.damage) * 2 + (getMaxSanity(i) - i.horror + assetHealth) * 3
    + i.actionsLeft * 1.5 + Math.min(i.resources, 8) * 1.5 + i.hand.length * .6
    + i.assets.reduce((n,a) => n + (['01020','01016','01006'].includes(a.code) && (a.uses == null || a.uses > 0) ? 12 : a.code === '01030' ? 6 : 1), 0)
    + (loc?.clues > 0 ? 4 : 0) + (s.actIndex > 0 && i.location === 'ritualSite' ? 25 : 0)
    - (s.actIndex > 0 ? blockers * 4 : 0) - distance * 25 - danger * 2 - s.round * 1.5 - (s.agendaIndex * 5 + s.doom) * 2
}
let beam = [{ s: start, commands: prefix, score: score(start) }]
for (let depth = 0; depth < 90; depth++) {
  const next = [], seen = new Set()
  for (const node of beam) {
    const legal = legalMoves(node.s).filter(m => !['resign','sacrificeLita','engage','parleyLita'].includes(m.action))
    for (const move of legal) {
      const s = structuredClone(node.s), commands = [...node.commands]
      step(s, move, commands); settle(s, commands)
      if (s.resolution === 'r1' || s.resolution === 'r2') {
        let replay = createGameState(init, players)
        for (const entry of commands) step(replay, entry.move, [])
        if (JSON.stringify(replay) !== JSON.stringify(s)) throw new Error('Replay mismatch')
        writeFileSync(new URL('../audit/p6-campaign-victory.json', import.meta.url), JSON.stringify({ settings: init, players, commands, result: { uiState: s.uiState, resolution: s.resolution, campaign: s.campaign.result, records: s.campaign.records } }, null, 2) + '\n')
        console.log('WIN', seed, commands.length, s.uiState, s.resolution, s.campaign.result); process.exit(0)
      }
      if (s.status !== 'playing' || s.investigators[0].defeated) continue
      const i = s.investigators[0]
      const key = JSON.stringify([s.rngState,s.round,s.actIndex,s.actClues,s.doom,s.agendaIndex,i.location,i.actionsLeft,i.clues,i.resources,i.damage,i.horror,i.assets,i.hand,s.enemies,s.locations.map(l=>[l.id,l.clues])])
      if (seen.has(key)) continue
      seen.add(key); next.push({ s, commands, score: score(s) })
    }
  }
  next.sort((a,b) => b.score - a.score)
  beam = next.slice(0, 48)
  console.log(depth, beam.length, beam[0]?.score, beam[0]?.s.round, beam[0]?.s.actIndex, beam[0]?.s.investigators[0].location, beam[0]?.s.investigators[0].clues)
  if (!beam.length) break
}
process.exitCode = 1
