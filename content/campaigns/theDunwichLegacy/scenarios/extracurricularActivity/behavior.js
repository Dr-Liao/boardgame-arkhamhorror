import { changeChaosBag } from '../../../../../src/engine/chaos-bag.js'
import { awardStoryCard } from '../../../../../src/campaign/campaign-effects.js'
import { encounterRules } from '../../encounter-rules.js'
import { dunwichChaosToken, dunwichChaosAfterTest } from '../../dunwich-chaos.js'

const completedHouseAlwaysWins = state =>
  state.campaign.scenarioResults.some(result => result.scenarioId === 'theHouseAlwaysWins')

function concoctionState(state) {
  const owned = state.investigators.some(inv => inv.assets.some(asset => asset.code === '02059'))
  const discarded = state.investigators.some(inv => inv.discard.includes('02059'))
  const removed = (state.scenarioZones.removed || []).includes('02059')
  const underneath = state.scenarioZones.underLocations?.alchemyLabs === '02059'
  // Older saves can already be on act 3 without the under-location marker. The
  // campaign history is authoritative: after The House Always Wins, act 2b put
  // the set-aside concoction underneath the labs unless it was taken/removed.
  const claimed = !!state.scenarioZones.concoctionClaimed || owned || discarded || removed
  const recoverable = completedHouseAlwaysWins(state) && state.actIndex >= 2 && !claimed
  return { owned, removed, underneath, available: underneath || recoverable }
}

export function setupPlan(state) {
  const late = completedHouseAlwaysWins(state)
  return {
    locations: ['miskatonicQuad', 'humanitiesBuilding', 'orneLibrary', 'studentUnion', 'scienceBuilding', 'administrationBuilding'],
    facultyOfficeCode: late ? '02055' : '02054',
    setAside: [late ? '02055' : '02054', '02060', '02059', '02058', '02052', '02057', '02061'],
    removed: [late ? '02054' : '02055'],
  }
}

export const behavior = {
  ...encounterRules,
  id: 'extracurricularActivity', setupPlan,
  resolveChaosToken(state, inv, token, api) { return dunwichChaosToken('extracurricularActivity', state, inv, token, api) },
  setupLocations(state) {
    const plan = setupPlan(state)
    state.locationVariants.facultyOffices = structuredClone(state.scenario.locationVariants.facultyOffices
      .find(location => location.originalCode === plan.facultyOfficeCode))
    return plan.locations
  },
  locationRevealed(state, location, api) {
    if (location.id === 'studentUnion') api.place('dormitories')
    if (location.id === 'administrationBuilding') api.place('facultyOffices')
    if (location.id === 'scienceBuilding') api.place('alchemyLabs')
    if (location.id === 'facultyOffices' && location.originalCode === '02054') {
      const humanoid = code => (state.scenario.enemies[code]?.traits || []).some(trait => trait.toLowerCase() === 'humanoid')
      for (const pile of [state.encounterDeck, state.encounterDiscard]) {
        const index = pile.findLastIndex(humanoid)
        if (index < 0) continue
        api.spawn(pile.splice(index, 1)[0], location.id)
        api.shuffleEncounterDeck()
        break
      }
    }
  },
  turnEnded(state, inv, api) {
    encounterRules.turnEnded(state, inv, api)
    const here = state.locations.find(location => location.id === inv.location)?.originalCode
    if (here === '02049') api.discardTop(inv.seat, inv.horror)
    if (here === '02053') api.discardTop(inv.seat, 1)
  },
  afterTest(state, inv, result, api) {
    encounterRules.afterTest(state, inv, result, api)
    dunwichChaosAfterTest('extracurricularActivity', state, inv, result, api)
    if (result.success) return
    const here = state.locations.find(location => location.id === inv.location)?.originalCode
    if (here === '02056' && result.skill === 'willpower') api.damage(inv.seat, 1)
  },
  enemyPhaseStart(state) {
    for (const enemy of state.enemies.filter(enemy => enemy.code === '02058')) enemy.exhausted = false
  },
  actReveal(state, act, api) {
    if (act.originalCode === '02045') {
      // Jazz is searched for in the encounter deck during the next act.
      state.encounterDeck.push('02060')
      api.shuffleDiscard()
    } else if (act.originalCode === '02046') {
      api.place('alchemyLabs')
      if (state.agendaIndex < 2 && !state.enemies.some(enemy => enemy.code === '02058')) api.spawn('02058', 'alchemyLabs')
      if (completedHouseAlwaysWins(state)) {
        state.scenarioZones.underLocations ||= {}
        state.scenarioZones.underLocations.alchemyLabs = '02059'
      }
    } else if (act.originalCode === '02047') api.finish('r3')
  },
  agendaReveal(state, agenda, api) {
    if (agenda.originalCode === '02042') {
      for (const inv of state.investigators.filter(inv => !inv.defeated && !inv.resigned)) {
        if (inv.discard.length >= 5) api.horror(inv.seat, inv.discard.length >= 10 ? 2 : 1)
      }
      if (completedHouseAlwaysWins(state)) state.agendas.splice(1, 1)
    } else if (agenda.originalCode === '02043') {
      api.place('dormitories')
      const experiment = state.enemies.find(enemy => enemy.code === '02058')
      if (experiment) this.moveExperiment(state, experiment, 'dormitories')
      else api.spawn('02058', 'scienceBuilding')
    } else if (agenda.originalCode === '02044') {
      for (const inv of state.investigators.filter(inv => !inv.defeated && !inv.resigned)) api.horror(inv.seat, 3)
      api.finish('r4')
    }
  },
  moveExperiment(state, experiment, target) {
    const queue = [[experiment.location]]
    const visited = new Set([experiment.location])
    for (let i = 0; i < queue.length; i++) {
      const path = queue[i]
      if (path.at(-1) === target) {
        if (path.length > 1) experiment.location = path[1]
        return
      }
      const location = state.locations.find(loc => loc.id === path.at(-1))
      for (const next of location?.connections || []) if (!visited.has(next) && state.locations.some(loc => loc.id === next)) {
        visited.add(next); queue.push([...path, next])
      }
    }
  },
  agendaWouldAdvance(state, api) {
    if (state.agendas[state.agendaIndex]?.originalCode !== '02044') return false
    api.clearDoom()
    const experiment = state.enemies.find(enemy => enemy.code === '02058')
    if (experiment) this.moveExperiment(state, experiment, 'dormitories')
    if (experiment?.location === 'dormitories') api.advanceAgenda()
    return true
  },
  drawStoryAsset(state, inv, code, api) {
    if (code !== '02060') throw new Error(`未知课外活动剧情资产：${code}`)
    api.storyAsset(code, inv.location)
  },
  actions(state, inv) {
    const moves = []
    const groupClues = state.investigators.filter(other => !other.defeated && !other.resigned && other.location === inv.location)
      .reduce((total, other) => total + other.clues, 0)
    const here = state.locations.find(loc => loc.id === inv.location)
    if (here?.originalCode === '02051' && (inv.damage > 0 || inv.horror > 0))
      moves.push({ action: 'scenarioAction', rule: 'unionHeal', actions: 2, label: '花费 2 行动，治愈 1 伤害和 1 恐惧' })
    if (here?.originalCode === '02057') {
      const available = concoctionState(state).available
      moves.push({ action: 'scenarioAction', rule: 'searchConcoction',
        label: available ? '调查炼金实验室，取得炼金试剂' : '调查炼金实验室（下方没有炼金试剂）' })
    }
    if (inv.assets.some(asset => asset.code === '02059')) for (const enemy of state.enemies.filter(enemy => enemy.location === inv.location))
      moves.push({ action: 'scenarioAction', rule: 'concoctionAttack', enemyId: enemy.id, label: `使用炼金试剂攻击「${enemy.name}」（智识）` })
    if (here?.id === 'dormitories' && groupClues >= 3 * state.numInvestigators) {
      moves.push({ action: 'scenarioAction', rule: 'rescueStudents', label: '共同支付线索，救出学生' })
    }
    if (here?.id === 'facultyOffices' && here.originalCode === '02054' && groupClues >= 2 * state.numInvestigators) {
      moves.push({ action: 'scenarioAction', rule: 'rescueRice', label: '共同支付线索，救出莱斯教授' })
    }
    if (state.actIndex === 1) {
      if (state.storyAssets.some(asset => asset.code === '02060' && asset.location === inv.location && asset.controllerSeat == null)) {
        moves.push({ action: 'scenarioAction', rule: 'parleyJazz', label: '谈判“爵士”马利根（智识 3）' })
      }
      if (inv.clues > 0 && state.encounterDeck.length) moves.push({ action: 'scenarioAction', rule: 'searchJazz', scriptCard: 'act', label: '花费 1 线索，搜索遭遇牌库中的爵士' })
    }
    return moves
  },
  // 02046 莱斯的下落：[action] 花费 1 线索，弃遭遇牌库顶 5（单人 10）张。不可执行时也提示原因。
  scriptActions(state, inv) {
    if (state.actIndex !== 1) return []
    return [{ action: 'scenarioAction', rule: 'searchJazz', scriptCard: 'act', label: '花费 1 线索，搜索遭遇牌库中的爵士',
      reason: inv.clues < 1 ? '需要花费 1 个线索' : !state.encounterDeck.length ? '遭遇牌库已空' : null }]
  },
  performAction(state, inv, move, api) {
    if (move.rule === 'unionHeal') {
      inv.damage = Math.max(0, inv.damage - 1); inv.horror = Math.max(0, inv.horror - 1)
    } else if (move.rule === 'searchConcoction') {
      const loc = state.locations.find(location => location.id === inv.location)
      api.test(inv.seat, 'intellect', loc.shroud + (loc.shroudMod || 0) + (state.fogMod || 0), result => {
        if (!result.success) {
          api.info(`${inv.name} 调查炼金实验室失败，未能取得炼金试剂。`)
          return
        }
        if (!concoctionState(state).available) {
          api.info('炼金实验室下方没有可取得的炼金试剂。')
          return
        }
        state.scenarioZones.underLocations ||= {}
        delete state.scenarioZones.underLocations.alchemyLabs
        state.scenarioZones.concoctionClaimed = true
        api.giveAsset(inv.seat, '02059')
        api.info(`${inv.name} 从炼金实验室取得了「炼金试剂」。`)
      })
    } else if (move.rule === 'concoctionAttack') {
      const enemy = state.enemies.find(item => item.id === move.enemyId && item.location === inv.location)
      if (!enemy || !inv.assets.some(asset => asset.code === '02059')) throw new Error('没有合法的炼金试剂目标')
      api.test(inv.seat, 'intellect', enemy.fight, result => {
        if (!result.success) return
        api.damageEnemy(enemy.id, enemy.code === '02058' ? 7 : 1, inv.seat, '02059')
        const index = inv.assets.findIndex(asset => asset.code === '02059')
        if (index >= 0) { inv.assets.splice(index, 1); state.scenarioZones.removed ||= []; state.scenarioZones.removed.push('02059') }
      })
    } else if (move.rule === 'rescueStudents') {
      api.payClues(3 * state.numInvestigators, inv.location)
      api.finish('r2')
    } else if (move.rule === 'rescueRice') {
      api.payClues(2 * state.numInvestigators, inv.location)
      api.finish('r1')
    } else if (move.rule === 'searchJazz') {
      inv.clues--
      const count = state.numInvestigators === 1 ? 10 : 5
      for (let i = 0; i < count && state.encounterDeck.length; i++) {
        const code = state.encounterDeck.pop()
        if (code === '02060') api.storyAsset(code, inv.location)
        else state.encounterDiscard.push(code)
      }
    } else if (move.rule === 'parleyJazz') api.test(inv.seat, 'intellect', 3, result => {
      if (!result.success) return
      const index = state.storyAssets.findIndex(asset => asset.code === '02060' && asset.location === inv.location)
      if (index < 0) return
      const [asset] = state.storyAssets.splice(index, 1)
      inv.assets.push({ ...asset, controllerSeat: inv.seat })
      api.advanceAct()
    })
    else throw new Error(`未知课外活动行动：${move.rule}`)
  },
  checkObjectives(state, api) {
    if (state.actIndex === 2 && state.victoryDisplay.some(card => (card.originalCode || card.code) === '02058')) api.advanceAct()
    if (state.agendaIndex === 2 && state.enemies.some(enemy => enemy.code === '02058' && enemy.location === 'dormitories')) api.advanceAgenda()
  },
  resolution(state, key) {
    if (!['noResolution', 'r1', 'r2', 'r3', 'r4'].includes(key)) throw new Error('未知课外活动结局')
    const records = state.campaign.records
    if (key === 'r1') {
      records.theInvestigatorsRescuedProfessorWarrenRice = true
      awardStoryCard(state, '02061', 'extracurricularActivity')
    } else records.professorWarrenRiceWasKidnapped = true
    if (key === 'r2') records.theStudentsWereRescued = true
    if (key === 'r3') records.theExperimentWasDefeated = true
    if (['noResolution', 'r4'].includes(key)) records.theInvestigatorsFailedToSaveTheStudents = true
    if (key === 'r4') records.investigatorsWereUnconsciousForSeveralHours = true
    if (['noResolution', 'r1', 'r4'].includes(key)) changeChaosBag(state, 'tablet', 1, { permanent: true })
    return { bonus: ['noResolution', 'r4'].includes(key) ? 1 : 0, award: true }
  },
}
