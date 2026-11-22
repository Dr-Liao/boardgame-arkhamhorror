// 《疯狂迷宫》· 章节行为。
//
// 本实现覆盖单桌普通流程（Group A / B / C 任选）：
//   · 组选择（preScenarioSetup）与按组布置初始地点 / act 牌库；
//   · 组混乱标记 + 2 枚；skull 额外揭示与符号失败效果；
//   · 幕推进：幕 1（组专属条件）→「幕 2 设置」→ 幕 2（简化组条件）→「幕 3 设置」→ 幕 3（击败艾克索多隆）；
//   · 结局按逃出组数映射 resolution1–4 并写回 groupXOutcome / escapedGroups。
// 跨桌同步（epic multiplayer 三桌共享剧情卡、交换资源/手牌、组顺序）由 Lead 的跨桌引擎提供；
// 本文件只写 primitive request，不做跨桌消息。
import { ACT_CODES, ESCAPE_ACT_CODE, GROUP_CHAOS_TOKEN, GROUP_TABLE, HALL_IDS, SECRETS_VARIANTS } from './definition.js'

const groupOf = state => {
  const group = state.campaign?.records?.currentGroup
  return GROUP_TABLE[group] ? group : 'A'
}
const clueCount = (state, locationId = null) => state.investigators
  .filter(inv => !inv.defeated && !inv.resigned && (!locationId || inv.location === locationId))
  .reduce((sum, inv) => sum + (inv.clues || 0), 0)
const alive = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const hasEnemy = (state, code) => state.enemies.some(enemy => (enemy.originalCode || enemy.code) === code)
const note = (state, text) => { (state.scenarioLog ||= []).push(text) }

export function setupPlan(state) {
  const group = groupOf(state)
  const plan = GROUP_TABLE[group]
  const zones = {
    setAside: [...state.scenario.setAsideAliases],
    removed: [],
    storyCards: [],
    keyAtSecrets: group === 'A' || group === 'B',
    hiddenChamber: null,
  }
  if (group === 'B') zones.removed.push('70040') // 单桌 B 组：致命之钥仍在一边（参考 setup setAside）
  return { group, plan, zones }
}

export const behavior = {
  id: 'theLabyrinthsOfLunacy',
  setupPlan,
  // 组选择：单桌模式默认询问；已有记录（读档/重开）时沿用。
  preScenarioSetup(state, events, api) {
    const records = state.campaign.records
    const options = ['A', 'B', 'C']
      .filter(group => !(records.playedGroups || []).includes(group))
      .map(group => ({ id: group, label: GROUP_TABLE[group].label }))
    if (records.currentGroup && GROUP_TABLE[records.currentGroup]) return
    const answer = options.length > 1 && api?.choice
      ? api.choice({ kind: 'group', source: 'theLabyrinthsOfLunacy', seat: state.campaign.leadSeat,
        prompt: '哪一组被困在迷宫的这部分？', options })
      : (options[0]?.id || 'A')
    records.currentGroup = GROUP_TABLE[answer] ? answer : 'A'
    records.miniCampaign = records.miniCampaign ?? false
    records.playedGroups ||= []
    records.escapedGroups ||= []
    note(state, `本局由 ${GROUP_TABLE[records.currentGroup].label} 进入迷宫。`)
  },
  setupLocations(state, events, ctx = {}) {
    const { group, plan, zones } = setupPlan(state)
    state.scenarioZones = { ...(state.scenarioZones || {}), ...zones }
    const random = () => (ctx.randomValue ? ctx.randomValue(state) : 0.5)
    const shuffleWith = list => (ctx.shuffle ? ctx.shuffle([...list], random) : [...list])
    state.scenarioFlags ||= {}
    // 按组替换 act 牌库（定义全部在 scenario.stageCards）。
    const actCodes = plan.actCodes
    const acts = actCodes.map(code => state.scenario.stageCards?.[code]).filter(Boolean)
    if (acts.length === actCodes.length) state.acts = acts
    const placed = []
    if (group === 'A') {
      const secrets = shuffleWith(SECRETS_VARIANTS)[0]
      state.locationVariants ||= {}
      state.locationVariants.chamberOfSecrets = {
        ...structuredClone(state.scenario.locations[secrets]), id: 'chamberOfSecrets',
      }
      zones.removed.push(...SECRETS_VARIANTS.filter(id => id !== secrets).map(id => state.scenario.locations[id]?.originalCode).filter(Boolean))
      placed.push('chamberOfSecrets')
      state.scenarioZones.keyAtSecrets = true    } else if (group === 'B') {
      placed.push('chamberOfRain', 'chamberOfSorrows')
    } else {
      const hiddenIndex = Math.floor(random() * SECRETS_VARIANTS.length)
      const hidden = SECRETS_VARIANTS[hiddenIndex]
      zones.hiddenChamber = state.scenario.locations[hidden]?.originalCode
        || state.scenario.locations[hidden]?.code
        || ['70016', '70017', '70018'][hiddenIndex]
      state.scenarioZones.hiddenChamber = zones.hiddenChamber
      placed.push('chamberOfNight', 'chamberOfRegret')
    }
    state.scenarioZones.setAside.push(...(state.scenario.setAsideLocations || []).map(id => state.scenario.locations[id]?.originalCode).filter(Boolean))
    return placed
  },
  afterDeckSetup(state, events, api) {
    const group = groupOf(state)
    if (group !== 'B') return
    const investigators = alive(state)
    if (!investigators.length) return
    const index = Math.floor((api?.random?.() ?? 0.5) * investigators.length)
    investigators.forEach((inv, order) => {
      inv.location = order === index ? 'chamberOfRain' : 'chamberOfSorrows'
    })
    state.currentSeat = investigators[0].seat
    note(state, 'B 组：一位调查员从雨之密室开始，其余从悲哀密室开始。')
  },
  afterChaosBagSetup(state) {
    const group = groupOf(state)
    const token = GROUP_CHAOS_TOKEN[group]
    state.chaosBag.push(token, token)
    note(state, `${GROUP_TABLE[group].label}：混乱袋加入 2 枚 ${token} 标记。`)
  },
  // ---------------------------------------------------------------------------
  // 混乱标记
  // ---------------------------------------------------------------------------
  resolveChaosToken(state, inv, token, api) {
    if (token !== 'skull') return
    if (typeof api?.revealChaosTokens === 'function') api.revealChaosTokens(1)
    else if (typeof api?.drawChaosToken === 'function') api.drawChaosToken()
    else note(state, 'skull：揭示另一个混乱标记（等待引擎额外揭示原语）。')
  },
  afterTest(state, inv, result, api) {
    if (!result || result.success) return
    const drawn = [...(result.drawn || [])]
    const token = ['skull', 'cultist', 'tablet', 'elderthing'].find(face => drawn.includes(face))
    if (!token) return
    const easy = ['easy', 'standard'].includes(state.difficulty)
    if (token === 'skull' && !easy) {
      const answer = api?.choice ? api.choice({
        kind: 'effect', source: 'theLabyrinthsOfLunacy', seat: inv.seat,
        prompt: 'skull：选择受到 1 点伤害或 1 点恐惧。',
        options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'horror', label: '受到 1 点恐惧' }],
      }) : 'damage'
      if (answer === 'horror') api.horror(inv.seat, 1)
      else api.damage(inv.seat, 1)
      return
    }
    if (token === 'cultist') {
      if ((inv.clues || 0) > 0) { inv.clues -= 1; state.locations.find(loc => loc.id === inv.location).clues = (state.locations.find(loc => loc.id === inv.location).clues || 0) + 1 }
      return
    }
    if (token === 'tablet') { api.loseResources?.(inv.seat, 2) ?? (inv.resources = Math.max(0, (inv.resources || 0) - 2)); return }
    if (token === 'elderthing') { api.discardRandomFromHand?.(inv.seat, 1) }
  },
  // ---------------------------------------------------------------------------
  // 幕 / 密谋
  // ---------------------------------------------------------------------------
  actReveal(state, act, api) {
    const code = act.originalCode || act.code
    note(state, `幕 ${state.actIndex + 1}：${act.name}`)
    state.scenarioFlags[`actRevealed:${code}`] = true
  },
  agendaReveal(state, agenda, api) {
    state.scenarioFlags.agendaStoryTriggered = false
    note(state, `密谋 ${state.agendaIndex + 1}：${agenda.name}`)
  },
  // 密谋 1/2 的强制：轮末若密谋上有毁灭且尚未触发，A 组队长抽取 1 张场景剧情卡（单桌等价：随机记录）。
  roundEnded(state, api) {
    const agenda = state.agendas?.[state.agendaIndex]
    const code = agenda?.originalCode || agenda?.code
    if (!['70003', '70005'].includes(code) || state.doom <= 0 || state.scenarioFlags.agendaStoryTriggered) return
    state.scenarioFlags.agendaStoryTriggered = true
    const pool = ['70033', '70034', '70035', '70036', '70037', '70038']
    const picked = pool[Math.floor((api?.random?.() ?? 0.5) * pool.length)]
    state.scenarioFlags.revealedStoryCard = picked
    note(state, `密谋强制：抽取场景剧情卡 ${picked}（跨桌同步由 engine 提供）。`)
  },
  // 幕 1 的组专属条件全部用场景行动结算；幕 2/3 的简化条件在 checkObjectives 里判定。
  actions(state, inv) {
    const moves = []
    const add = (rule, label, reason = null) => moves.push({ action: 'scenarioAction', rule, label, reason })
    const group = groupOf(state)
    if (!inv || inv.defeated || inv.resigned) return moves
    if (state.actIndex === 0) {
      const per = 2 * state.numInvestigators
      if (group === 'A' && inv.location === 'chamberOfSecrets' && state.scenarioZones?.keyAtSecrets) {
        add('useKeyOfMysteries', '使用奥秘之钥：共同花费 2[per_investigator] 个线索，结算幕 2 设置',
          clueCount(state, 'chamberOfSecrets') >= per ? null : `密室线索不足（${clueCount(state, 'chamberOfSecrets')}/${per}）`)
      }
      if (group === 'B' && ['chamberOfRain', 'chamberOfSorrows'].includes(inv.location)) {
        add('drainWateryGrave', '共同花费 2[per_investigator] 个线索，排干水箱，结算幕 2 设置',
          clueCount(state, inv.location) >= per ? null : `本地线索不足（${clueCount(state, inv.location)}/${per}）`)
      }
      if (group === 'C' && inv.location === 'chamberOfRegret') {
        add('pullLever', '拉动一根拉杆（左/中/右），结算幕 2 设置')
      }
    }
    return moves
  },
  performAction(state, inv, move, api) {
    const per = 2 * state.numInvestigators
    if (move.rule === 'useKeyOfMysteries') {
      const here = clueCount(state, 'chamberOfSecrets')
      if (here < per) { api.info?.('线索不足，无法使用奥秘之钥。'); return }
      let remaining = per
      for (const other of alive(state)) {
        const pay = Math.min(other.clues || 0, remaining)
        other.clues -= pay
        remaining -= pay
        if (remaining <= 0) break
      }
      state.scenarioZones.keyAtSecrets = false
      state.scenarioZones.removed.push('70040')
      api.advanceAct()
      return
    }
    if (move.rule === 'drainWateryGrave') {
      const here = clueCount(state, inv.location)
      if (here < per) { api.info?.('本地线索不足，无法排干水箱。'); return }
      let remaining = per
      for (const other of alive(state).filter(item => item.location === inv.location)) {
        const pay = Math.min(other.clues || 0, remaining)
        other.clues -= pay
        remaining -= pay
        if (remaining <= 0) break
      }
      api.advanceAct()
      return
    }
    if (move.rule === 'pullLever') {
      const lever = api.choice
        ? api.choice({ kind: 'effect', source: 'chamberOfRegret', seat: inv.seat,
          prompt: '你拉动三根拉杆中的一根。', options: [
            { id: 'left', label: '拉动左边的拉杆' }, { id: 'middle', label: '拉动中间的拉杆' }, { id: 'right', label: '拉动右边的拉杆' },
          ] })
        : 'left'
      state.scenarioFlags.pulledLever = lever
      // 单桌等价：没有其它组可核对暗置密室，按「拉对」推进（跨桌核对见 primitive request）。
      api.info?.(`${inv.name} 拉动了「${lever}」拉杆，暗置密室与拉杆相符，夜之密室的门打开了。`)
      api.advanceAct()
    }
  },
  actIndexAfterAdvance(state, previousAct, api) {
    // 注意：引擎传入的第二个参数是「当前幕对象」，推进前 state.actIndex 仍是旧值。
    const previousIndex = state.actIndex
    if (previousIndex === 0) {
      // 幕 2 设置。
      for (const id of HALL_IDS) api.place(id)
      const group = groupOf(state)
      if (group === 'A') api.place('chamberOfDecay')
      if (group === 'B') { api.place('chamberOfRot'); api.place('chamberOfPoison') }
      if (group === 'C') api.place('chamberOfHunger')
      state.doom = 0
      state.encounterDeck.push('70052', '70052')
      if (state.encounterDiscard?.length) { state.encounterDeck.push(...state.encounterDiscard); state.encounterDiscard = [] }
      note(state, '幕 2 设置：迷宫走廊与密室入场，无面掳掠者洗入遭遇牌库。')
      return 1
    }
    if (previousIndex === 1) {
      // 幕 3 设置。
      api.place('abandonedWarehouse')
      api.reveal?.('abandonedWarehouse')
      for (const enemy of state.enemies) enemy.engagedSeat = null
      for (const other of alive(state)) api.moveInvestigator(other.seat, 'abandonedWarehouse')
      api.spawn?.('70048', 'abandonedWarehouse')
      state.doom = 0
      note(state, '幕 3 设置：废弃仓库入场，艾克索多隆出现在仓库。')
      return 2
    }
    return undefined
  },
  checkObjectives(state, api) {
    const group = groupOf(state)
    if (allDefeated(state)) { api.finish('noResolution'); return }
    if (state.actIndex === 1) {
      const advance = group === 'A' ? state.doom >= 11
        : group === 'B' ? state.scenarioFlags.beenInjected === true
          : !hasEnemy(state, '70050')
      if (advance) { api.advanceAct(); return }
    }
    if (state.actIndex === 2 && !hasEnemy(state, '70048')) {
      api.finish('resolution2')
    }
  },
  allResigned(state, api) {
    if (allDefeated(state)) api.finish('noResolution')
  },
  resolution(state, key) {
    const group = groupOf(state)
    const records = state.campaign.records
    records.playedGroups = [...new Set([...(records.playedGroups || []), group])]
    const escaped = ['resolution2', 'resolution3', 'resolution4'].includes(key)
    records.escapedGroups = [...new Set([...(records.escapedGroups || []), ...(escaped ? [group] : [])])]
    records.theGroupPerished = [...new Set([...(records.theGroupPerished || []), ...(escaped ? [] : [group])])]
    records[`group${group}Outcome`] = escaped ? 'escaped' : 'perished'
    note(state, `${GROUP_TABLE[group].label}：${escaped ? '逃出了迷宫' : '在迷宫中覆灭'}（${key}）。`)
    return {
      award: escaped,
      bonus: 0,
      effects: [{ record: { currentGroup: null } }],
    }
  },
  tokenMeanings: '混乱标记含义见提示卡；skull 额外揭示 1 个标记。',
}

function allDefeated(state) {
  return state.investigators.length > 0 && state.investigators.every(inv => inv.defeated || inv.resigned)
}

export const scenarioSummary = Object.freeze({
  groups: GROUP_TABLE, actCodes: ACT_CODES, escapeActCode: ESCAPE_ACT_CODE,
})

export default behavior
