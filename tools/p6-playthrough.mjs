import { createGameState, legalMoves, validateMove, applyMove, decisionSeat } from '../src/engine/engine.js'
import { EFFECTS } from '../src/cards/card-effects.js'
import { registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { abilityShim } from '../src/engine/ability.js'

export const settings = { campaignHub: true, playerInvestigator: '01001', difficulty: 'easy' }
const deck = ['01016','01017','01018','01020','01021','01022','01023','01030','01033','01037','01039','01087','01088','01089','01090'].flatMap(code => [code, code])
const byAction = (moves, action) => moves.find(m => m.action === action)
function path(s, from, goal) {
  const queue = [[from]], seen = new Set([from])
  while (queue.length) {
    const p = queue.shift()
    if (p.at(-1) === goal) return p[1]
    for (const next of s.locations.find(l => l.id === p.at(-1))?.connections || []) {
      if (!seen.has(next) && s.locations.some(l => l.id === next)) { seen.add(next); queue.push([...p, next]) }
    }
  }
}
export function policy(s, branch = 'r1', mode = 'victory') {
  const moves = legalMoves(s), inv = s.investigators[decisionSeat(s)]
  const action = a => byAction(moves, a)
  if (s.pendingChoice) {
    const c = s.pendingChoice, option = id => moves.find(m => m.optionId === id)
    if (c.kind === 'story') return option(branch) || moves[0]
    if (c.kind === 'storyCard') return option('0') || moves[0]
    if (c.kind === 'target' && c.source === 'deal-damage-all') {
      const target = [...s.locations].sort((a,b) => s.enemies.filter(e => e.location === b.id).length - s.enemies.filter(e => e.location === a.id).length)[0]
      if (option(target?.id)) return option(target.id)
    }
    if (c.kind === 'mulligan' && s.scenario.id !== 'theGathering') {
      const unwanted = inv.hand.findIndex((code, index) => !['01020','01016','01006','01030','01095','01033','01018','01024'].includes(code) || inv.hand.indexOf(code) !== index)
      if (unwanted >= 0) return option(String(unwanted))
    }
    if (['mulligan', 'playerWindow'].includes(c.kind)) return option('done') || option('skip') || moves[0]
    if (c.kind === 'commit') {
      const skill = s.skillTest?.skill
      const usable = moves.filter(m => /^\d+$/.test(m.optionId)).find(m => {
        const code = inv.hand[Number(m.optionId)], card = ALL_CARDS[code]
        return card?.type === 'skill' || ['01017','01087'].includes(code)
      })
      return usable || option('done') || moves[0]
    }
    if (c.kind === 'boost') return inv.resources > 1 && option('pay') || option('skip') || moves[0]
    if (c.kind === 'reaction') return moves.find(m => m.optionId !== 'skip') || moves[0]
    if (c.kind === 'discard') return moves.find(m => /^\d+$/.test(m.optionId) && !['01024','01020','01095','01006'].includes(inv.hand[Number(m.optionId)])) || moves[0]
    if (c.kind === 'assign-damage' || c.kind === 'assign-horror') return moves.find(m => m.optionId !== 'self') || moves[0]
    if (option('advance')) return option('advance')
    return option('done') || option('skip') || option('self') || moves[0]
  }
  if (s.uiState !== 'inScenario') {
    if (action('hubSetDifficulty') && s.difficulty !== 'easy') return moves.find(m => m.action === 'hubSetDifficulty' && m.difficulty === 'easy')
    if (action('hubGoSetup')) return action('hubGoSetup')
    if (action('hubSelectInvestigator') && !s.hubSeatSelected?.[0]) return moves.find(m => m.action === 'hubSelectInvestigator' && m.code === inv.code)
    if (action('hubSetDeck') && !s.campaign.investigators[0]) return { ...action('hubSetDeck'), codes: inv.code === '01001' ? deck : buildDeck(ALL_CARDS[inv.code], { seed: 'p6-deck' }).playerCards }
    if (action('hubConfirmUpgrades')) return action('hubConfirmUpgrades')
    const record = s.campaign.investigators[0]
    for (const code of ['01095', '01024', '01094']) {
      if ((record?.deck.filter(c => c === code).length || 0) >= (code === '01024' ? 2 : 1)) continue
      const purchase = moves.find(m => m.action === 'hubPurchase' && m.added === code && ['01087','01022','01017'].includes(m.removed))
      if (purchase) return purchase
    }
    for (const a of ['hubDoneSeat','hubBeginScenario','hubContinue','hubFinishUpgrade','hubFinishUpgrades','hubNextScenario','hubStartNext']) if (action(a)) return action(a)
    return moves.find(m => /确认|下一关|继续|完成/.test(m.label)) || moves[0]
  }
  if (mode === 'failure') return action('endTurn')
  const sc = s.scenario.id, loc = s.locations.find(l => l.id === inv.location)
  const moveTo = target => moves.find(m => m.action === 'move' && m.locationId === path(s, inv.location, target))
  if (mode === 'resign' && action('resign')) return action('resign')
  if (mode === 'resign' && sc === 'theGathering' && s.actIndex === 2) return moveTo('parlor') || action('endTurn')
  if (inv.code !== '01001' && sc === 'theGathering' && s.actIndex === 2) return action('resign') || moveTo('parlor') || action('endTurn')
  if (sc === 'theMidnightMasks' && action('resign') && (mode === 'rush' || s.cultistsInVictory.length >= 3 || s.round >= 8 || inv.horror >= inv.maxSanity - 2)) return action('resign')
  if (action('advanceAct')) return action('advanceAct')
  const engaged = s.enemies.filter(e => e.location === inv.location && (e.engagedSeat === inv.seat || e.massive))
  // 能力效果可能来自旧 DSL（EFFECTS）或能力层描述子：索引与引擎的 assetEffect 同序
  // （旧式 abilities 在前，action/free 描述子在后），因此按同一条规则折叠。
  const abilityEffect = m => {
    const code = inv.assets.find(a => a.id === m.assetId)?.code
    const legacy = EFFECTS[code]?.abilities?.[m.abilityIndex]
    if (legacy) return legacy.effect
    const shim = abilityShim(code)
    return shim[m.abilityIndex - (EFFECTS[code]?.abilities?.length || 0)]?.effect ?? undefined
  }
  if (sc === 'theDevourerBelow' && s.actIndex === 1 && s.enemies.filter(e => e.location === 'mainPath').length >= 2) {
    const blast = moves.find(m => m.action === 'play' && m.cardId === '01024')
    if (blast) return blast
    if (inv.hand.includes('01024') && inv.resources < 5 && !engaged.length) return action('resource')
    if (inv.hand.includes('01024') && !engaged.length) return action('endTurn')
  }
  if (action('parleyCultist')) return action('parleyCultist')
  if (engaged.length) {
    if (inv.agility > inv.combat && action('evade')) return action('evade')
    const weapon = moves.find(m => m.action === 'ability' && abilityEffect(m)?.type === 'fight')
    if (weapon) return weapon
    const replace = moves.find(m => m.action === 'play' && ['01020','01016','01006'].includes(m.cardId))
    if (replace) return replace
    const fight = moves.find(m => m.action === 'fight' && engaged.some(e => e.id === m.enemyId))
    if (fight) return fight
  }
  const played = code => inv.assets.some(a => a.code === code)
  for (const code of ['01095','01094','01030','01020','01016','01006','01048','01033','01018','01117','01017','01021','01087','01060','01072','01076']) {
    if (played(code)) continue
    if (['01016','01020','01006'].includes(code) && inv.assets.some(a => ['01016','01020','01006'].includes(a.code) && (a.uses == null || a.uses > 0))) continue
    if (['01033','01018','01021','01117'].includes(code) && inv.assets.some(a => ['01033','01018','01021','01117'].includes(a.code))) continue
    const play = moves.find(m => m.action === 'play' && m.cardId === code)
    if (play) return play
  }
  const threat = action('discardThreat')
  if (threat) return threat
  const cache = moves.find(m => m.action === 'play' && m.cardId === '01088')
  if (cache && inv.resources < 5) return cache
  if (sc === 'theGathering' && s.actIndex === 1 && inv.clues >= 3) return inv.location === 'hallway' ? action('endTurn') : moveTo('hallway')
  if (sc === 'theGathering' && s.actIndex === 2) return moveTo(mode === 'resign' ? 'parlor' : 'hallway') || action('endTurn')
  if (sc === 'theDevourerBelow' && s.actIndex === 1) return moveTo('ritualSite') || action('endTurn')
  if (sc === 'theMidnightMasks') {
    const cultist = s.enemies.find(e => e.uniqueCultist)
    if (cultist && cultist.location !== inv.location) return moveTo(cultist.location) || action('endTurn')
    if (action('drawCultist') && !cultist) return action('drawCultist')
  }
  if (action('interruptRitual')) return moves.find(m => m.action === 'interruptRitual' && m.skill === (inv.agility > inv.willpower ? 'agility' : 'willpower'))
  const hunch = moves.find(m => m.action === 'play' && m.cardId === '01037')
  if (hunch) return hunch
  if (action('investigate')) return moves.find(m => m.action === 'ability' && abilityEffect(m)?.type === 'investigate') || action('investigate')
  if (sc === 'theDevourerBelow' && s.actIndex === 2 && inv.location !== 'ritualSite') return moveTo('ritualSite') || action('endTurn')
  const candidates = s.locations.filter(l => l.id !== inv.location && (l.clues > 0 || (!l.revealed && ((l.cluesPerInvestigator || 0) > 0 || (l.clues || 0) > 0))) && !['parlor','ritualSite'].includes(l.id))
    .sort((a,b) => (a.shroud - inv[a.investigateSkill || 'intellect']) - (b.shroud - inv[b.investigateSkill || 'intellect']))
  for (const target of candidates) { const m = moveTo(target.id); if (m) return m }
  return action('endTurn') || moves[0]
}

export function playthrough(seed, { branch = 'r1', mode = 'victory', limit = 1400, stopAfterFirst = false, investigator = '01001' } = {}) {
  const s = createGameState({ ...settings, seed, playerInvestigator: investigator }, [{ seat: 0 }]), trace = []
  for (let i = 0; i < limit && s.uiState !== 'campaignResult'; i++) {
    if (stopAfterFirst && s.uiState === 'scenarioResult') break
    const move = policy(s, branch, mode) || legalMoves(s).find(m => m.action === 'endTurn')
    if (!move) throw new Error(`No move: ${s.uiState} ${s.status}`)
    const seat = decisionSeat(s), error = validateMove(s, seat, move)
    if (error) throw new Error(error + JSON.stringify(move))
    trace.push({ seat, move: structuredClone(move), scenario: s.scenario?.id, round: s.round, revision: s.revision })
    applyMove(s, seat, move)
  }
  return { state: s, trace, seed, branch, mode, investigator }
}
if (process.argv[1]?.endsWith('p6-playthrough.mjs')) {
  const start = Number(process.argv[2] || 0), count = Number(process.argv[3] || 1)
  let won = false
  for (let i = start; i < start + count; i++) {
    const r = playthrough('p6-' + i, { branch: process.argv[4] || 'r1', investigator: process.argv[5] || '01001', mode: process.argv[6] || 'victory' })
    console.log(i, r.trace.length, r.state.uiState, r.state.campaign.result, r.state.campaign.scenarioResults.map(x => [x.scenarioId, x.resolution]), r.state.resolution)
    if (r.state.campaign.result === 'victory') { won = true; break }
  }
  process.exitCode = won ? 0 : 1
}
