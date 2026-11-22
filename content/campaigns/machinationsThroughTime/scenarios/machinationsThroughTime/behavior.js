// 《时间阴谋》· 章节行为。
//
// 单桌普通流程覆盖：
//   · 三时代地点布置 + 廷达洛斯起点；三张 A Noble Legacy 剧情链；随机 Machination/Plot；
//   · 按难度放置密谋 1a 毁灭标记；异常/黑帮/怪物三种 Plot 的开局分歧；
//   · 剧情链场景行动（过去→现在→未来）、Plot 完成判定；
//   · 幕目标判定（三时代剧情全部完成且无 Plot 剧情卡 → 结局 1）与密谋耗尽结局（2/3/4 按艾德温形态）；
//   · cultist 在廷达洛斯自动失败、elderthing 失败伤害/恐惧盟友（简化读点）；
//   · 结局记录与经验/奖励资产写回。
// 跨桌/多时代同步（共享胜利区、跨桌科学家/剧情、三桌行动顺序）写 primitive request。
import {
  ACT_CODES, ERAS, MACHINATION_CODES, NOBLE_LEGACY_CODES, PLOT_CODES, PLOT_ENEMY_CODES,
  START_LOCATION, STORY_CARDS,
} from './definition.js'

const RECORD = state => (state.campaign.records ||= {})
const zones = state => (state.scenarioZones ||= {})
const flags = state => (state.scenarioFlags ||= {})
const note = (state, text) => { (state.scenarioLog ||= []).push(text) }
const alive = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const currentEra = (state, inv) => {
  const location = state.locations.find(item => item.id === inv.location)
  return location?.era || 'all'
}
const assetAt = (state, code) => zones(state).assets?.[code]?.location || null
const hasAssetAt = (state, code, locationId) => assetAt(state, code) === locationId
const investigateHereCount = (state, inv) => state.investigators
  .filter(other => !other.defeated && !other.resigned && other.location === inv.location)
  .reduce((sum, other) => sum + (other.clues || 0), 0)
const NOBLE_FLAGS = Object.freeze([
  'thomasAndMaryHaveMet', 'thomasAndMaryAreInspiredByNikolaTesla', 'fundingForAnObservatoryHasBegun',
  'theObservatoryIsBuilt', 'teleportationResearchHasBegun', 'corriganIndustriesHasBeenFounded',
  'thomasAndMaryHaveMadeAHistoricDiscovery', 'thomasAndMaryHaveWonANobelPrize',
])
const randomPick = (api, list) => {
  const value = typeof api?.random === 'function' ? api.random() : Math.random()
  return list[Math.min(list.length - 1, Math.floor(value * list.length))]
}
const storyCard = (state, role, code) => (zones(state).storyCards || []).find(item => item.code === code && item.role === role)
const markStep = (state, code, step) => {
  const card = (zones(state).storyCards || []).find(item => item.code === code || item.backCode === code)
  if (!card) return false
  card.steps ||= []
  if (!card.steps.includes(step)) card.steps.push(step)
  return true
}
const record = (state, key, value = true) => { RECORD(state)[key] = value }
const hasFlag = (state, key) => RECORD(state)[key] === true

export const behavior = {
  id: 'machinationsThroughTime',
  // -------------------------------------------------------------------------
  // 设置
  // -------------------------------------------------------------------------
  preScenarioSetup(state, events, api) {
    RECORD(state).machinationsSetup ||= {}
    zones(state).storyCards ||= []
    zones(state).assets ||= {}
    zones(state).anomalies ||= {}
    zones(state).winConditions ||= {}
    flags(state).timeoutHandled = false
    note(state, `时间阴谋开始：${ERAS.join(' / ')} 三个时代同时展开。`)
  },
  setupLocations(state, events, ctx = {}) {
    const placed = Object.keys(state.scenario.locations).filter(id => id !== 'corriganIndustries')
    // 三张 A Noble Legacy 放入场（过去/现在/未来各一）。
    for (const code of NOBLE_LEGACY_CODES) {
      const story = Object.values(STORY_CARDS).find(item => item.code === code)
      zones(state).storyCards.push({
        code, backCode: story.backCode, role: story.role, era: story.era,
        steps: [], completed: false, inVictory: false,
      })
    }
    // 随机 Machination 与 Plot（另外两组移出游戏）。
    const machination = randomPick(ctx, MACHINATION_CODES)
    const plot = randomPick(ctx, PLOT_CODES)
    zones(state).machinationCode = machination
    zones(state).plotCode = plot
    for (const [code, role] of [[machination, 'machination'], [plot, 'plot']]) {
      const story = Object.values(STORY_CARDS).find(item => item.code === code)
      zones(state).storyCards.push({
        code, backCode: story?.backCode || null, role, era: null,
        steps: [], completed: false, inPlay: true, inVictory: false,
      })
    }
    const machinationStory = (zones(state).storyCards).find(item => item.code === machination)
    const plotStory = (zones(state).storyCards).find(item => item.code === plot)
    if (machinationStory) machinationStory.inPlay = true
    if (plotStory) plotStory.inPlay = true
    flags(state).machinationCode = machination
    flags(state).plotCode = plot
    // 剧情资产初始位置（单桌等价：按 .hs setup 的 assetAt_）。
    const assets = zones(state).assets
    assets['87014'] = { code: '87014', location: 'riverDocksPast' } // 尼古拉·特斯拉
    assets['87023'] = { code: '87023', location: 'arkhamAdvertiserPresent' } // 埃兹拉·格雷夫斯
    assets['87032'] = { code: '87032', location: null, aside: true } // 维度光束机器
    if (machination === '87033') {
      assets['87013'] = { code: '87013', location: 'arkhamGazette' } // 玛丽·杰林斯基（过去）
      zones(state).abducted = ['87012', '87030', '87031']
    } else if (machination === '87034') {
      assets['87012'] = { code: '87012', location: 'childhoodHome' }
      zones(state).abducted = ['87013', '87021', '87030', '87031']
    } else {
      assets['87012'] = { code: '87012', location: 'childhoodHome' }
      assets['87013'] = { code: '87013', location: 'oMalleysWatchShop' }
      assets['87036b'] = { code: '87036b', location: 'arkhamGazette' }
      zones(state).abducted = ['87021', '87022', '87030', '87031']
      flags(state).edwinAssetClues = Math.max(0, 12 - 3 * state.numInvestigators)
    }
    // Plot 开局分歧。
    const plotEnemies = PLOT_ENEMY_CODES[plot] || []
    zones(state).plotEnemyZone = plotEnemies
    if (plot === '87038') {
      for (const location of state.locations) {
        if (/米斯卡塔尼克|Miskatonic/.test(`${location.name || ''}${location.nameEn || ''}`) || ['miskatonicUniversityPast', 'miskatonicUniversityPresent', 'miskatonicUniversityFuture'].includes(location.id)) {
          zones(state).anomalies[location.id] = state.numInvestigators
        }
      }
    }
    if (plot === '87039') {
      flags(state).debtPaid = false
      for (const inv of alive(state)) if (currentEra(state, inv) === 'present') inv.resources = (inv.resources || 0) + 2
    }
    // 密谋 1a 初始毁灭：1/人 + 难度调整（简单 -1 / 普通 0 / 困难 +1 / 专家 +2）。
    const adjustment = { easy: -1, standard: 0, hard: 1, expert: 2 }[state.difficulty] ?? 0
    const doom = Math.max(0, state.numInvestigators + adjustment)
    if (state.agendas[0]) state.agendas[0].doom = (state.agendas[0].doom || 0) + doom
    flags(state).initialDoom = doom
    note(state, `Machination=${machination}，Plot=${plot}，密谋 1a 初始毁灭 ${doom}。`)
    return placed
  },
  afterDeckSetup(state) {
    // 单桌等价：把 Plot 对应敌人从遭遇牌库移到一边/移出游戏（参考 setup 的 remove/setAside）。
    const plot = flags(state).plotCode
    const removed = [...(PLOT_ENEMY_CODES[plot] || [])]
    if (removed.length) {
      state.encounterDeck = state.encounterDeck.filter(code => !removed.includes(code))
      zones(state).setAsideEnemies = removed
    }
  },
  // -------------------------------------------------------------------------
  // 混乱标记
  // -------------------------------------------------------------------------
  resolveChaosToken(state, inv, token, api) {
    if (token !== 'cultist') return
    const location = state.locations.find(item => item.id === inv.location)
    if (location?.id === 'tindalos' || location?.era === 'all') {
      if (typeof api?.failSkillTest === 'function') api.failSkillTest()
      else note(state, 'cultist：你在廷达洛斯，本次检定自动失败。')
    }
  },
  afterTest(state, inv, result, api) {
    if (!result || result.success) return
    const drawn = [...(result.drawn || [])]
    const token = ['skull', 'cultist', 'tablet', 'elderthing'].find(face => drawn.includes(face))
    if (token === 'skull') {
      // -X 的动态数值见 tokenMeanings 近似；此处只记录胜利区剧情卡数量。
      const n = (zones(state).storyCards || []).filter(card => card.inVictory).length
      note(state, `skull：-${(['easy', 'standard'].includes(state.difficulty) ? 1 : 2) + n}。`)
    }
    if (token === 'elderthing') {
      const ally = (state.investigators.find(other => other.seat === inv.seat)?.assets || [])
        .find(asset => (asset.traits || []).some(trait => String(trait).toLowerCase() === 'ally'))
      if (ally && typeof api?.damageAsset === 'function') api.damageAsset(ally, 1)
      else note(state, 'elderthing：失败时对同地点一张盟友支援造成 1 伤害或 1 恐惧（引擎读点待接线）。')
    }
  },
  // -------------------------------------------------------------------------
  // 幕 / 密谋
  // -------------------------------------------------------------------------
  actReveal(state, act, api) {
    flags(state).actRevealed = true
    note(state, `幕：${act.name} — 通过完成三张伟大遗产剧情卡的目标来修复时间线。`)
  },
  agendaReveal(state, agenda, api) {
    note(state, `密谋：${agenda.name}`)
  },
  // 情景行动：A Noble Legacy 剧情链 + Plot 互动。
  actions(state, inv) {
    if (!inv || inv.defeated || inv.resigned) return []
    const list = []
    const add = (rule, label, enabled = true, reason = null) => list.push({ action: 'scenarioAction', rule, label, reason: enabled ? null : reason })
    const records = RECORD(state)
    // --- 过去 ---
    if (currentEra(state, inv) === 'past') {
      if (inv.location === 'miskatonicUniversityPast') {
        add('declareThomasAndMaryMet', '宣告「托马斯和玛丽相识了」',
          !records.thomasAndMaryHaveMet && hasAssetAt(state, '87012', inv.location) && hasAssetAt(state, '87013', inv.location),
          '需要托马斯、玛丽与你同在过去的米斯卡塔尼克大学')
        add('declareObservatoryFunding', '花费 2[per_investigator] 资源：宣告「天文台开始筹建」',
          !records.fundingForAnObservatoryHasBegun && (inv.resources || 0) >= 2 * state.numInvestigators,
          '资源不足')
        if (records.thomasAndMaryHaveMet) {
          add('declareInspiredByTesla', '作为团队花费 2[per_investigator] 线索：宣告「受尼古拉·特斯拉启发」',
            !records.thomasAndMaryAreInspiredByNikolaTesla && investigateHereCount(state, inv) >= 2 * state.numInvestigators,
            '线索不足')
        }
      }
    }
    // --- 现在 ---
    if (inv.location === 'miskatonicUniversityPresent') {
      add('declareObservatoryBuilt', '宣告「天文台建成了」',
        !records.theObservatoryIsBuilt && records.fundingForAnObservatoryHasBegun,
        '需要先开始筹建天文台')
      add('declareTeleportationResearch', '作为团队花费 2[per_investigator] 线索：宣告「传送研究开始了」',
        !records.teleportationResearchHasBegun && records.theObservatoryIsBuilt && records.thomasAndMaryAreInspiredByNikolaTesla,
        '前置剧情未完成')
    }
    if (inv.location === 'yeOldeMagickShoppe') {
      add('declareCorriganIndustries', '花费 1[per_investigator] 资源：宣告「科里根工业成立」',
        !records.corriganIndustriesHasBeenFounded && records.thomasAndMaryHaveMet && (inv.resources || 0) >= state.numInvestigators,
        '前置剧情/资源不足')
    }
    // --- 未来 ---
    if (inv.location === 'miskatonicUniversityFuture') {
      add('declareHistoricDiscovery', '检定智力(3)：宣告「取得历史性发现」',
        !records.thomasAndMaryHaveMadeAHistoricDiscovery && records.teleportationResearchHasBegun,
        '需要先开始传送研究')
    }
    if (inv.location === 'arkhamAdvertiserFuture') {
      add('declareNobelPrize', '宣告「托马斯和玛丽获得诺贝尔奖」',
        !records.thomasAndMaryHaveWonANobelPrize && records.thomasAndMaryHaveMadeAHistoricDiscovery,
        '需要先取得历史性发现')
    }
    // --- Plot：黑帮麻烦的「债务已偿还」以 3 资源/人团队支付 ---
    if (flags(state).plotCode === '87039') {
      add('payMobDebt', '作为团队支付 3 资源/人：宣告「债务已偿还」',
        !records.theDebtHasBeenPaid && state.investigators.reduce((sum, other) => sum + (other.resources || 0), 0) >= 3 * state.numInvestigators,
        '资源不足')
    }
    return list
  },
  performAction(state, inv, move, api) {
    const records = RECORD(state)
    const spendTeamClues = amount => {
      let remaining = amount
      for (const other of alive(state)) {
        const pay = Math.min(other.clues || 0, remaining)
        other.clues -= pay
        remaining -= pay
        if (remaining <= 0) break
      }
      return remaining <= 0
    }
    switch (move.rule) {
      case 'declareThomasAndMaryMet':
        record(state, 'thomasAndMaryHaveMet'); markStep(state, '87006', 'met')
        note(state, '宣告「托马斯和玛丽相识了」。'); return
      case 'declareInspiredByTesla':
        if (!spendTeamClues(2 * state.numInvestigators)) return
        record(state, 'thomasAndMaryAreInspiredByNikolaTesla'); markStep(state, '87006', 'inspired')
        note(state, '宣告「托马斯和玛丽受尼古拉·特斯拉启发」。'); return
      case 'declareObservatoryFunding':
        for (const other of alive(state)) other.resources = Math.max(0, (other.resources || 0) - 2)
        record(state, 'fundingForAnObservatoryHasBegun'); markStep(state, '87006', 'funding')
        note(state, '宣告「天文台开始筹建」。'); return
      case 'declareObservatoryBuilt':
        record(state, 'theObservatoryIsBuilt'); markStep(state, '87015', 'built')
        note(state, '宣告「天文台建成了」。'); return
      case 'declareTeleportationResearch':
        if (!spendTeamClues(2 * state.numInvestigators)) return
        record(state, 'teleportationResearchHasBegun'); markStep(state, '87015', 'research')
        note(state, '宣告「传送研究开始了」。'); return
      case 'declareCorriganIndustries':
        for (const other of alive(state)) other.resources = Math.max(0, (other.resources || 0) - state.numInvestigators)
        record(state, 'corriganIndustriesHasBeenFounded'); markStep(state, '87015', 'founded')
        record(state, 'theDebtHasBeenPaid', true)
        state.scenarioFlags.corriganIndustriesPlaced = true
        if (api.place) api.place('corriganIndustries')
        note(state, '宣告「科里根工业成立」，科里根工业在未来时代入场。'); return
      case 'declareHistoricDiscovery': {
        if (!api.test) return
        api.test(inv.seat, 'intellect', 3, result => {
          const current = state.investigators.find(other => other.seat === inv.seat)
          if (result?.success) {
            record(state, 'thomasAndMaryHaveMadeAHistoricDiscovery'); markStep(state, '87024', 'discovery')
            note(state, '检定成功：宣告「托马斯和玛丽取得了一项历史性发现」。')
          } else {
            note(state, '检定失败：未能取得历史性发现。')
          }
          void current
        })
        return
      }
      case 'declareNobelPrize':
        record(state, 'thomasAndMaryHaveWonANobelPrize'); markStep(state, '87024', 'prize')
        note(state, '宣告「托马斯和玛丽获得了诺贝尔奖」。'); return
      case 'payMobDebt':
        for (const other of alive(state)) other.resources = Math.max(0, (other.resources || 0) - 3)
        record(state, 'theDebtHasBeenPaid'); note(state, '宣告「债务已偿还」。'); return
      default:
        return
    }
  },
  // 目标检查：三时代剧情全完成且无 Plot 剧情卡 → 结局 1；密谋耗尽 → 按艾德温形态 2/3/4。
  checkObjectives(state, api) {
    if (!state.pendingChoice) {
      const nobleDone = NOBLE_FLAGS.every(key => hasFlag(state, key))
      const plot = storyCard(state, 'plot', flags(state).plotCode)
      const plotInPlay = plot?.inPlay !== false
      if (nobleDone && !plotInPlay && !flags(state).actAdvanced) {
        flags(state).actAdvanced = true
        if (api?.finish) { api.finish('resolution1'); return }
      }
      if (state.agendaIndex >= state.agendas.length && !flags(state).timeoutHandled) {
        flags(state).timeoutHandled = true
        const edwinAsset = Object.values(zones(state).assets || {}).some(asset => asset.code === '87036b')
        const edwinEnemy = state.enemies.some(enemy => (enemy.originalCode || enemy.code) === '87036a')
        const key = edwinAsset ? 'resolution2' : edwinEnemy ? 'resolution3' : 'resolution4'
        if (api?.finish) api.finish(key)
        else note(state, `密谋耗尽：进入 ${key}。`)
      }
    }
  },
  allResigned(state, api) {
    if (state.investigators.length && state.investigators.every(inv => inv.defeated || inv.resigned)) api.finish('noResolution')
  },
  // 结局：1/2/4 奖励经验（胜利区 X），3 无奖励并逼疯幸存者；奖励资产记录供 UI。
  resolution(state, key) {
    const award = ['resolution1', 'resolution2', 'resolution4'].includes(key)
    const rewards = (zones(state).assets || {})
    flags(state).rewardAssets = ['87014', '87023', '87032'].filter(code => rewards[code]?.location || rewards[code]?.controlledBy)
    flags(state).rewardAssetsChosen = award
    if (key === 'resolution3') {
      for (const inv of state.investigators) if (!inv.defeated) inv.insane = true
    }
    note(state, `结局 ${key}：${award ? '获得胜利区经验与奖励资产' : '无经验奖励'}。`)
    return { award, bonus: 0, effects: [] }
  },
  tokenMeanings: 'skull 动态 -X（胜利区剧情卡）；cultist 在廷达洛斯自动失败；tablet 受科学家支援影响；elderthing 失败伤害/恐惧盟友。',
}

export const scenarioSummary = Object.freeze({
  eras: ERAS,
  actCodes: ACT_CODES,
  nobleSteps: NOBLE_FLAGS,
  machinations: MACHINATION_CODES,
  plots: PLOT_CODES,
})

export default behavior
