import { changeChaosBag } from '../../../../../src/engine/chaos-bag.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { awardStoryCard } from '../../../../../src/campaign/campaign-effects.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { chooseCandidate } from '../../../../choice-helpers.js'
import { encounterRules } from '../../encounter-rules.js'
import { dunwichChaosToken, dunwichChaosAfterTest } from '../../dunwich-chaos.js'

export function setupPlan(state) {
  return {
    locations: ['laBellaLuna', 'cloverClubLounge', 'cloverClubBar', 'cloverClubCardroom'],
    enemies: [{ code: '02078', location: 'cloverClubLounge' }],
    setAside: ['02074', '02079', '02080', '02075', '02076', '02077', ...state.scenario.setAsideEncounterCards],
    removed: [],
  }
}

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const groupClues = (state, location) => active(state).filter(inv => !location || inv.location === location)
  .reduce((sum, inv) => sum + inv.clues, 0)
const universityFinished = state => state.campaign.scenarioResults.some(result => result.scenarioId === 'extracurricularActivity')

export const behavior = {
  ...encounterRules,
  id: 'theHouseAlwaysWins', setupPlan,
  resolveChaosToken(state, inv, token, api) { return dunwichChaosToken('theHouseAlwaysWins', state, inv, token, api) },
  setupLocations(state) {
    // Scenario-local memory. Do not carry a previous game's cheating into this visit.
    state.scenarioFlags = { cheated: [], loungeUsed: false, barUsed: false }
    state.scenarioZones.clubAside = [...state.scenario.setAsideEncounterCards]
    return setupPlan(state).locations
  },
  setupEnemies(state, events, api) {
    const boss = api.spawnEnemy(state, '02078', 'cloverClubLounge', null)
    // Agenda 1 grants Criminal enemies Aloof, including the initial Pit Boss.
    if (boss) boss.aloof = true
  },
  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned(state, enemy, api)
    if (state.agendas[state.agendaIndex]?.originalCode === '02063'
      && enemy.traits?.some(trait => trait.toLowerCase() === 'criminal')) enemy.aloof = true
  },
  enemyPhaseStart(state, api) {
    for (const asset of state.storyAssets.filter(asset => asset.code === '02079' && asset.controllerSeat == null)) {
      asset.damage = (asset.damage || 0) + 1
      if (asset.damage >= 3) {
        state.storyAssets.splice(state.storyAssets.indexOf(asset), 1)
        state.scenarioZones.removed ||= []; state.scenarioZones.removed.push('02079')
      }
    }
    if (state.agendas[state.agendaIndex]?.originalCode !== '02065') return
    const abominations = state.enemies.filter(enemy => enemy.traits?.some(trait => trait.toLowerCase() === 'abomination'))
    for (const enemy of state.enemies.slice()) {
      if (!enemy.traits?.some(trait => trait.toLowerCase() === 'criminal')) continue
      if (abominations.some(other => other.location === enemy.location)) api.discardEnemy(enemy)
    }
  },
  locationRevealed(state, location, api) {
    if (location.id === 'darkenedHall') for (const id of ['artGallery', 'vipArea', 'backAlley']) api.place(id)
  },
  actReveal(state, act, api) {
    registeredEntry(act.originalCode)?.actRule?.onReveal?.(state, act, api)
  },
  agendaReveal(state, agenda, api) {
    registeredEntry(agenda.originalCode)?.agendaRule?.onReveal?.(state, agenda, api)
  },
  agendaChain(state, agenda) {
    const target = state.scenarioFlags.advanceDirectlyToAgenda
    if (!target || (agenda.originalCode || agenda.code) !== target) return false
    delete state.scenarioFlags.advanceDirectlyToAgenda
    return true
  },
  enemyDamaged(state, enemy, api) {
    if (state.agendas[state.agendaIndex]?.originalCode === '02063'
      && enemy.traits?.some(trait => trait.toLowerCase() === 'criminal')) api.advanceAgenda()
  },
  cluesGained(state, inv, amount, api) {
    encounterRules.cluesGained(state, inv, amount, api)
    if (amount <= 0) return
    const boss = state.enemies.find(enemy => enemy.code === '02078' && enemy.location === inv.location)
    if (!boss) return
    boss.exhausted = false
    api.engage(boss, inv.seat)
    api.attack(boss, inv)
  },
  skipUpkeepIncome(state, inv) { return state.locations.find(loc => loc.id === inv.location)?.originalCode === '02076' },
  afterTest(state, inv, result, api) {
    encounterRules.afterTest(state, inv, result, api)
    dunwichChaosAfterTest('theHouseAlwaysWins', state, inv, result, api)
    if (!result.success && result.source?.label === '调查'
      && state.locations.find(loc => loc.id === inv.location)?.originalCode === '02075')
      inv.resources = Math.max(0, inv.resources - 2)
  },
  statModifier(state, inv, skill) {
    return encounterRules.statModifier(state, inv, skill)
  },
  enemyDefeated(state, enemy, api) {
    const inv = state.investigators[enemy.defeatedBy]
    const morgan = inv?.assets.find(asset => asset.code === '02080' && !asset.exhausted)
    if (morgan && api.choose({ kind: 'reaction', source: morgan.id, seat: inv.seat, canSkip: true,
      prompt: '击败敌人后，是否横置摩尔根博士抽取 1 张牌？',
      options: [{ id: 'skip', label: '不抽牌' }, { id: 'trigger', label: '横置并抽牌' }] }) === 'trigger') {
      morgan.exhausted = true; api.drawCards(inv.seat, 1)
    }
    return false
  },
  chaosTokenRevealed(state, inv, token, api) {
    if (state.acts[state.actIndex]?.originalCode !== '02066'
      || state.scenarioFlags.cheatedRound === state.round || !state.chaosBag.length) return token
    const answer = api.choose({ kind: 'reaction', source: 'clubCheat', seat: inv.seat, canSkip: true,
      prompt: '新手的运气（作弊）：是否将刚揭示的混乱标记视为袋中另一标记的正面？每轮全队限一次。代价：本关结算时只要有调查员作弊，混乱袋就永久加入 1 个古神标记。',
      options: [{ id: 'skip', label: '不作弊（按原标记结算）' }, { id: 'trigger', label: '作弊：改为袋中另一标记的正面（本关结算时混乱袋永久 +1 古神标记）' }] })
    if (answer !== 'trigger') return token
    const faces = [...new Set(state.chaosBag)]
    const face = api.choose({ kind: 'token', source: 'clubCheatFace', seat: inv.seat,
      prompt: '选择本次检定视为的混乱标记正面。',
      options: faces.map(id => ({ id, label: id })) })
    state.scenarioFlags.cheatedRound = state.round
    if (!state.scenarioFlags.cheated.includes(inv.seat)) state.scenarioFlags.cheated.push(inv.seat)
    return face
  },
  actions(state, inv) {
    const moves = []
    const peter = inv.assets.find(asset => asset.code === '02079')
    if (peter) {
      const criminals = state.enemies.filter(enemy => enemy.location === inv.location
        && enemy.traits?.some(trait => trait.toLowerCase() === 'criminal'))
      if (peter.exhausted) moves.push({ action: 'scenarioAction', rule: 'peterEvade', actions: 0,
        label: '横置彼得·克洛弗，自动躲避「罪犯」', reason: '需要先重整彼得·克洛弗' })
      else if (!criminals.length) moves.push({ action: 'scenarioAction', rule: 'peterEvade', actions: 0,
        label: '横置彼得·克洛弗，自动躲避「罪犯」', reason: '所在地点没有[[罪犯]]敌人' })
      else for (const enemy of criminals)
        moves.push({ action: 'scenarioAction', rule: 'peterEvade', enemyId: enemy.id, actions: 0,
          label: `横置彼得·克洛弗，自动躲避「${enemy.name}」` })
    }
    if (state.actIndex === 0 && inv.location === 'cloverClubLounge' && !state.scenarioFlags.loungeUsed)
      moves.push({ action: 'scenarioAction', rule: 'loungeAlly', label: '弃掉一张盟友，获得 2 线索',
        reason: inv.hand.some(code => ALL_CARDS[code]?.traits?.some(trait => trait.toLowerCase() === 'ally')) ? null
          : '手牌里没有[[盟友]]支援' })
    if (state.actIndex === 0 && inv.location === 'cloverClubBar' && !state.scenarioFlags.barUsed)
      moves.push({ action: 'scenarioAction', rule: 'buyDrink', label: '支付 2 资源，获得 2 线索并抽 2 张牌',
        reason: inv.resources >= 2 ? null : `需要 2 资源（当前 ${inv.resources}）` })
    if (state.actIndex === 0 && inv.location === 'cloverClubCardroom')
      moves.push({ action: 'scenarioAction', rule: 'gamble', label: '支付 2 资源，在牌室赌博',
        reason: inv.resources >= 2 ? null : `需要 2 资源（当前 ${inv.resources}）` })
    if ([2, 3].includes(state.actIndex)) {
      // 02068/02069：剧情角色无人控制时，场景赋予谈判行动。角色已被控制则不列。
      const code = state.acts[state.actIndex]?.originalCode === '02068' ? '02080' : '02079'
      const guest = state.storyAssets.find(asset => asset.code === code && asset.controllerSeat == null)
      const name = code === '02080' ? '佛朗西斯·摩尔根博士' : '彼得·克劳佛'
      if (guest) moves.push({ action: 'scenarioAction', rule: 'parleyGuest', scriptCard: 'act', label: `谈判${name}（意志 3）`,
        reason: guest.location === inv.location ? null : `需要与${name}位于同一地点` })
    }
    return moves
  },
  performAction(state, inv, move, api) {
    if (move.rule === 'peterEvade') {
      const asset = inv.assets.find(item => item.code === '02079' && !item.exhausted)
      const enemy = state.enemies.find(item => item.id === move.enemyId && item.location === inv.location
        && item.traits?.some(trait => trait.toLowerCase() === 'criminal'))
      if (!asset || !enemy) throw new Error('没有合法的彼得·克洛弗躲避目标')
      asset.exhausted = true; api.evadeEnemy(enemy)
    } else if (move.rule === 'loungeAlly') {
      const allies = inv.hand.map((code, index) => ({ code, index }))
        .filter(item => ALL_CARDS[item.code]?.traits?.some(trait => trait.toLowerCase() === 'ally'))
      if (!allies.length) throw new Error('手牌中没有盟友')
      const chosen = chooseCandidate(api, { kind: 'card', source: '02071', seat: inv.seat, prompt: '选择要弃掉以换取线索的盟友支援。' }, allies, {
        key: item => String(item.index), cardCode: item => item.code, label: item => ALL_CARDS[item.code]?.nameZh || item.code,
      })
      inv.discard.push(inv.hand.splice(chosen.index, 1)[0]); state.scenarioFlags.loungeUsed = true; api.gainClues(inv.seat, 2)
    } else if (move.rule === 'buyDrink') {
      inv.resources -= 2; state.scenarioFlags.barUsed = true; api.gainClues(inv.seat, 2)
      state.scenarioFlags.hadDrink ||= []; state.scenarioFlags.hadDrink.push(inv.seat)
      api.drawCards(inv.seat, 2)
    } else if (move.rule === 'gamble') {
      inv.resources -= 2
      const token = api.revealToken()
      if (token === 'eldersign') { api.gainClues(inv.seat, 2); inv.resources += 2 }
      else if (/^-?\d+$/.test(token) && Number(token) % 2 === 0) api.gainClues(inv.seat, 2)
    } else if (move.rule === 'parleyGuest') api.test(inv.seat, 'willpower', 3, result => {
      if (!result.success) return
      const code = state.acts[state.actIndex]?.originalCode === '02068' ? '02080' : '02079'
      const asset = state.storyAssets.find(asset => asset.code === code && asset.location === inv.location && asset.controllerSeat == null)
      if (!asset) return
      asset.clues = (asset.clues || 0) + 1
      if (asset.clues >= state.numInvestigators) { state.storyAssets.splice(state.storyAssets.indexOf(asset), 1); inv.assets.push({ ...asset, controllerSeat: inv.seat }) }
    })
    else throw new Error(`未知百赌百胜行动：${move.rule}`)
  },
  checkObjectives(state, api) {
    if (state.actIndex === 0 && groupClues(state) >= 4 * state.numInvestigators) {
      api.payClues(4 * state.numInvestigators)
      api.advanceAct()
    }
    if (state.actIndex === 1 && groupClues(state, 'vipArea') >= 2 * state.numInvestigators) {
      api.payClues(2 * state.numInvestigators, 'vipArea')
      api.advanceAct()
    }
  },
  allResigned(state, api) {
    const code = state.acts[state.actIndex]?.originalCode === '02068' ? '02080'
      : state.acts[state.actIndex]?.originalCode === '02069' ? '02079' : null
    api.finish(code && state.investigators.some(inv => inv.resigned && inv.assets.some(asset => asset.code === code))
      ? code === '02080' ? 'r2' : 'r3' : 'r1')
  },
  storyResolutionKey(_state, key) {
    return key === 'noResolution' ? 'r1' : key
  },
  resolution(state, key, events, api) {
    if (!['noResolution', 'r1', 'r2', 'r3', 'r4'].includes(key)) throw new Error('未知百赌百胜结局')
    const records = state.campaign.records
    if (key === 'r2') {
      records.theInvestigatorsRescuedDrFrancisMorgan = true
      awardStoryCard(state, '02080', 'theHouseAlwaysWins')
    } else records.drFrancisMorganWasKidnapped = true
    if (key === 'r3') records.naomiHasTheInvestigatorsBacks = true
    else records.oBannionGangHasABoneToPickWithTheInvestigators = true
    if (key === 'r4') {
      records.investigatorsWereUnconsciousForSeveralHours = true
      for (const inv of state.investigators) api.addTrauma(state, inv.seat, 'physical', 1, events)
    }
    if (state.scenarioFlags?.cheated?.length) changeChaosBag(state, 'elderthing', 1, { permanent: true })
    return { bonus: ['noResolution', 'r1', 'r4'].includes(key) ? 1 : 0, award: true }
  },
}
