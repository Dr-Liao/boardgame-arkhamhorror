// 寻觅卡达斯（The Search for Kadath · 06119）· 引擎钩子（章节流程）。
//
// 分工（P8-WORKER-BRIEF §4）：
//   · 逐卡规则在单卡条目（`src/cards/encounter-entries/theDreamEaters/theSearchForKadath/*.js`）的
//     `actRule` / `agendaRule` / `locationRule` / `enemyRule` / `treacheryRule` / `assetRule` 里；
//   · 本文件只做章节流程：区域设置、幕/议程分派、神迹计数读数、被俘记录、冲突判定与共享钩子转发。
//   · 覆盖共享钩子（actions / performAction / afterTest / enemyStatModifier / roundEnded / turnEnded…）
//     时都在函数体内显式转发 `encounterRules.<hook>(...)`。
//
// 引擎读点（P8-API-NOTES §2）：
//   setupLocations/setupEnemies/preScenarioSetup · actReveal/actIndexAfterAdvance/agendaReveal/checkObjectives ·
//   veiledFlipped（引擎原生 flipVeiled 成功后派发）· locationFlipped（自翻面能力）·
//   locationLeaveTest/locationLeaveFailed · actionBlocked/actions/performAction · beforeMove ·
//   afterTest/resolveChaosToken · enemyStatModifier/enemyAttackModifier/enemyPhaseAfterHunters/afterEvade/canEngageEnemy ·
//   roundEnded/turnEnded/cluesGained/locationLeft · resolution/storyResolutionKey
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  actRuleFor, agendaRuleFor, assetRuleFor, enemyRuleFor, locationRuleFor, treacheryRuleFor,
} from '../../../../../src/cards/card-rules.js'
import { swarmCountOf } from '../../../../../src/engine/swarm.js'
import { encounterRules, activeInvestigators, here, original } from '../../encounter-rules.js'
import { hardSide, searchForKadathChaosToken, signsOfTheGods } from './chaos.js'
import { BEINGS_OF_IB, CATS_OF_ULTHAR, CORSAIR_OF_LENG, CRAWLING_MIST, HORDE_OF_NIGHT, NIGHTRIDERS, PACK_OF_VOONITHS, PRIEST_OF_A_THOUSAND_MASKS, REGION_BY_ID, SET_ASIDE_ALIASES, SET_ASIDE_LOCATION_IDS, START_LOCATION_IDS, STALKING_MANTICORE, TENEBROUS_NIGHTGAUNT, VIRGIL_GRAY, ZOOG_SET, scenario, RAW_CODES as RAW } from './definition.js'

const codeOf = original
const traitsOf = (api, code) => {
  const fromApi = api?.cardTraits?.(code)
  if (Array.isArray(fromApi) && fromApi.length) return fromApi.map(trait => String(trait).toLowerCase())
  return (ALL_CARDS[code]?.traits || []).map(trait => String(trait).toLowerCase())
}

const flags = state => (state.scenarioFlags ||= {})
const readFlag = (state, key) => state.scenarioFlags?.[key] ?? null

// 幕 1 的卡号（轮末线索推进由引擎 objective + roundEndActIndex 处理；其余幕轮末在港口推进）。
const FIRST_ACT_CODE = RAW.c06122

// 本章已实现的单卡条目（报告与审计证据；逐卡条目仍是主证据）。
export const implementedEncounterCodes = Object.freeze([
  RAW.c06120, RAW.c06121, RAW.c06122, RAW.c06123, RAW.c06124, RAW.c06125, RAW.c06126,
  RAW.c06127, RAW.c06127b, RAW.c06128, RAW.c06128b, RAW.c06129, RAW.c06129b, RAW.c06130, RAW.c06130b, RAW.c06131, RAW.c06131b,
  RAW.c06132, RAW.c06132b, RAW.c06133, RAW.c06133b, RAW.c06134, RAW.c06134b, RAW.c06135, RAW.c06135b, RAW.c06136, RAW.c06136b,
  RAW.c06137, RAW.c06137b, RAW.c06138, RAW.c06138b, RAW.c06139, RAW.c06139b, RAW.c06140, RAW.c06140b, RAW.c06141, RAW.c06141b,
  RAW.c06142, RAW.c06142b, RAW.c06143, RAW.c06143b, RAW.c06144, RAW.c06145, RAW.c06146, RAW.c06147, RAW.c06148, RAW.c06149,
  RAW.c06150, RAW.c06151, RAW.c06152, RAW.c06153, RAW.c06154,
])

export const scenarioGaps = Object.freeze([
  '掩藏地点的翻面行动是引擎原生的 flipVeiled（moves.js 枚举 + dispatch.js 结算）；本章行为只通过 veiledFlipped 结算背面故事卡。',
  '剧本参考卡（06119）没有单卡条目（reference card，无行为读点）；神迹计数走 api.markers 的通用命名计数。',
])

export const scenarioApproximations = Object.freeze([
  '斯凯河的「意志(2)或敏捷(2)」：引擎 locationRule.onLeave.test 只支持单一技能，改为 behavior.beforeMove 先询问技能、behavior.locationLeaveTest 再返回该技能（不再静默固定为意志）。',
  '塞拉尼安的「进入/离开的额外费用」：无手牌时放行并记日志（卡面要求支付，但引擎没有「额外费用的合法性闸门」读点）。',
  '黑暗夜魇在区域设置时的「保留标记与附属」：保留伤害/毁灭标记快照并在重新入场时恢复；地点/敌人附属在离场时由引擎清理，不保留。',
  '维吉尔·格雷「离场时移出游戏」：通过 behavior.assetLeftPlay 设置 asset.removedFromGame 并写入 removedFromGame（与引擎 leaveAsset 的 removedFromGame 读点一致）。',
  '哈祖斯-克列格的「背面故事卡把无以达愿之庙放置入场」按 api.place + takeFromSetAside 结算；地点入场不触发一次 onEnter（卡面没有「进入」强制，可接受）。',
  '「凶星」把地图未见之城加入胜利牌区：由条目设置 pendingVictoryLocation 标志，behavior 在故事结算后写入 victoryDisplay 并移出游戏。',
  '艾雷克-瓦达的费用减免没有内容层读点（playCost 只读玩家卡能力层），记录为 simplified（见 worker 报告）。',
])

// ---------------------------------------------------------------------------
// 故事卡：翻面后读背面正文并结算条目规则
// ---------------------------------------------------------------------------
function storyFaceOf(state, storyCode) {
  return state.scenario?.storyFaces?.[storyCode] || null
}

// 神迹计数增加后触发维吉尔·格雷的反应（条目 assetRule.afterSignsUncovered）。
function triggerSignsGained(state, api, gained) {
  if (!(gained > 0)) return
  const rule = assetRuleFor(VIRGIL_GRAY)
  const owner = (state.investigators || []).find(inv =>
    (inv.assets || []).some(asset => codeOf(asset) === VIRGIL_GRAY))
  if (owner && rule?.afterSignsUncovered) rule.afterSignsUncovered(state, api, { ownerSeat: owner.seat })
  api.info?.(`✨ 神迹：参考卡上现有 ${signsOfTheGods(state, api)} 个神迹。`)
}

function addLocationToVictory(state, api, locationId) {
  const location = (state.locations || []).find(item => item.id === locationId)
  if (!location) return
  state.victoryDisplay ||= []
  const code = location.originalCode || location.code
  if (!state.victoryDisplay.some(card => String(card.id) === String(location.id))) {
    state.victoryDisplay.push({ id: location.id, code, originalCode: code, victory: location.victory || 0 })
    api.info?.(`💎 「${location.name}」被加入胜利牌区（胜利 ${location.victory || 0}）。`)
  }
  api.removeLocationFromGame?.(location.id, { discardEnemies: false })
}

/**
 * 结算一张背面故事卡：日志（卡面中文正文来自 cards-data）+ 条目 assetRule.resolve +
 * 神迹计数后置（维吉尔反应）+ 06143b 的 pendingVictoryLocation。
 */
function resolveStoryCard(state, inv, location, storyCode, api) {
  if (!storyCode) return false
  const key = `storyRead:${location?.id || storyCode}`
  if (readFlag(state, key)) return false
  const face = storyFaceOf(state, storyCode)
  if (face?.text) api.info?.(`📖 「${face.name || storyCode}」：${face.text}`)
  else api.info?.(`📖 翻开背面故事卡 ${storyCode}。`)
  const before = signsOfTheGods(state, api)
  assetRuleFor(storyCode)?.resolve?.(state, api, { location, inv, storyCode })
  api.setScenarioFlag?.(key, true)
  triggerSignsGained(state, api, signsOfTheGods(state, api) - before)
  const pendingVictory = api.scenarioFlag?.('pendingVictoryLocation')
  if (pendingVictory) {
    api.setScenarioFlag?.('pendingVictoryLocation', null)
    addLocationToVictory(state, api, pendingVictory)
  }
  return true
}

// ---------------------------------------------------------------------------
// 区域设置（4 个区域共用流程；文本来自 definition.regionSetup 的英文原文）
// ---------------------------------------------------------------------------
function takeEncounterCard(state, api, code) {
  // 从遭遇牌库取走（不触发抽牌）：deck → discard 再从 discard 取出（不新增状态字段）。
  if (api.discardEncounterCard?.(code) === true) {
    api.takeEncounterDiscard?.(code)
    return true
  }
  return api.takeEncounterDiscard?.(code) === true
}

function spawnFromEncounterSearch(state, api, code, locationId) {
  takeEncounterCard(state, api, code)
  return api.spawn?.(code, locationId) || null
}

function spawnFromSetAside(state, api, code, locationId) {
  if (api.takeFromSetAside?.(code) !== true) return null
  return api.spawn?.(code, locationId) || null
}

// 区域设置前把黑暗夜魇收进「放在一边」快照；结算后在领队选择的[[城市]]地点放回。
function setNightgauntsAside(state, api) {
  const nightgaunts = (state.enemies || []).filter(enemy => codeOf(enemy) === TENEBROUS_NIGHTGAUNT)
  if (!nightgaunts.length) return
  const snapshots = []
  for (const enemy of nightgaunts) {
    snapshots.push({
      damageTaken: Number(enemy.damageTaken) || 0,
      doom: Number(enemy.doom) || 0,
      exhausted: enemy.exhausted === true,
    })
    api.removeEnemyFromGame?.(enemy)
  }
  const previous = Array.isArray(readFlag(state, 'nightgauntsAside')) ? readFlag(state, 'nightgauntsAside') : []
  api.setScenarioFlag?.('nightgauntsAside', [...previous, ...snapshots])
  api.info?.(`🌑 ${snapshots.length} 张黑暗夜魇在区域设置时被放在一边（保留伤害/毁灭标记）。`)
}

function restoreNightgaunts(state, api) {
  const snapshots = Array.isArray(readFlag(state, 'nightgauntsAside')) ? readFlag(state, 'nightgauntsAside') : []
  if (!snapshots.length) return
  api.setScenarioFlag?.('nightgauntsAside', [])
  const cities = (state.locations || []).filter(location =>
    traitsOf(api, location.originalCode || location.code).includes('city'))
  for (const snapshot of snapshots) {
    if (!cities.length) break
    const leadSeat = Number(state.campaign?.leadSeat ?? 0)
    const options = cities.map(location => ({ id: location.id, label: location.name || location.id }))
    const answer = api.choose?.({
      kind: 'location', source: RAW.c06150, seat: leadSeat,
      prompt: '黑暗夜魇放回场上的一个[[城市]]地点。',
      options,
    }) ?? options[0].id
    const city = cities.find(location => location.id === String(answer)) || cities[0]
    const enemy = api.spawn?.(TENEBROUS_NIGHTGAUNT, city.id)
    if (!enemy) continue
    if (snapshot.damageTaken > 0) api.damageEnemy?.(enemy, snapshot.damageTaken)
    if (snapshot.doom > 0) api.doomOn?.(enemy, snapshot.doom)
    if (snapshot.exhausted) api.exhaustEnemy?.(enemy)
    api.info?.(`🌑 黑暗夜魇回到「${city.name}」。`)
  }
}

function removeSetupLocations(state, api) {
  for (const location of [...(state.locations || [])]) {
    const victory = Number(location.victory) || 0
    if (victory > 0 && (location.clues || 0) === 0) {
      state.victoryDisplay ||= []
      const code = location.originalCode || location.code
      if (!state.victoryDisplay.some(card => String(card.id) === String(location.id))) {
        state.victoryDisplay.push({ id: location.id, code, originalCode: code, victory })
      }
    }
    api.removeLocationFromGame?.(location.id)
  }
}

function loseAllClues(state, api) {
  for (const inv of activeInvestigators(state)) {
    if ((inv.clues || 0) > 0) api.spendClues?.(inv.seat, inv.clues)
  }
}

function runRegionSetup(state, api, regionKey) {
  const region = REGION_BY_ID[regionKey]
  if (!region) return false
  setNightgauntsAside(state, api)
  loseAllClues(state, api)
  removeSetupLocations(state, api)
  for (const id of region.locations) {
    const code = scenario.locations[id]?.originalCode || scenario.locations[id]?.code
    if (code) api.takeFromSetAside?.(code)
    api.place?.(id)
  }
  for (const inv of activeInvestigators(state)) api.moveInvestigator?.(inv.seat, region.hub)
  api.info?.(`🧭 区域设置「${region.label}」：3 处地点入场，调查员位于「${scenario.locations[region.hub]?.name || region.hub}」。`)

  if (regionKey === 'oriab') {
    spawnFromEncounterSearch(state, api, NIGHTRIDERS, 'mtNgranek')
    if (state.numInvestigators >= 3) spawnFromEncounterSearch(state, api, NIGHTRIDERS, 'namelessRuins')
    api.shuffleEncounterDeck?.()
  } else if (regionKey === 'mnar') {
    spawnFromSetAside(state, api, BEINGS_OF_IB, 'ruinsOfIb')
  } else if (regionKey === 'forbiddenLands') {
    spawnFromSetAside(state, api, STALKING_MANTICORE, 'forbiddenLands')
    spawnFromSetAside(state, api, HORDE_OF_NIGHT, 'zulanThek')
  } else if (regionKey === 'timelessRealm') {
    if (api.takeFromSetAside?.(CRAWLING_MIST) === true) api.shuffleIntoEncounterDeck?.([CRAWLING_MIST])
    spawnFromEncounterSearch(state, api, PRIEST_OF_A_THOUSAND_MASKS, 'hazuthKleg')
    if (state.numInvestigators >= 3) spawnFromEncounterSearch(state, api, PRIEST_OF_A_THOUSAND_MASKS, 'celephais')
    api.shuffleEncounterDeck?.()
  }
  restoreNightgaunts(state, api)

  const visited = Array.isArray(readFlag(state, 'regionsVisited')) ? readFlag(state, 'regionsVisited') : []
  if (!visited.includes(regionKey)) api.setScenarioFlag?.('regionsVisited', [...visited, regionKey])
  api.setScenarioFlag?.('nextActIndex', region.actIndex)
  api.info?.(`📜 区域设置完成：推进到幕 2a（${region.label}）。`)
  return true
}

// ---------------------------------------------------------------------------
// 幕 1 背面：清理旧区域的卡（条目的 onReveal 负责），这里只兜底「新区域判定」。
// ---------------------------------------------------------------------------

function currentActCode(state) {
  const act = state.acts?.[state.actIndex]
  return act ? codeOf(act) : null
}

// 轮末：区域幕（2a–）的推进条件 = 每位未败退调查员都在同一个[[港口]]地点。
function advanceRegionActAtRoundEnd(state, api) {
  const act = state.acts?.[state.actIndex]
  if (!act || state.actIndex === 0) return false
  const alive = activeInvestigators(state)
  if (!alive.length) return false
  const locationId = alive[0].location
  if (!alive.every(inv => inv.location === locationId)) return false
  const location = (state.locations || []).find(item => item.id === locationId)
  if (!location) return false
  if (!traitsOf(api, location.originalCode || location.code).includes('port')) return false
  const answer = api.choose?.({
    kind: 'story', source: codeOf(act) || 'regionAct', seat: Number(state.campaign?.leadSeat ?? 0),
    prompt: '轮末：所有调查员都在同一个[[港口]]地点，是否推进本幕前往另一个区域？',
    canSkip: true,
    options: [{ id: 'advance', label: '推进本幕（前往另一个区域）' }, { id: 'skip', label: '留在本区域' }],
  }) ?? 'advance'
  if (String(answer) === 'skip') return false
  api.advanceAct?.()
  return true
}

// ---------------------------------------------------------------------------
// 标记后果（[cultist]/[tablet]/[elder_thing]）；afterTest 会被引擎调用两次，按 result 幂等。
// ---------------------------------------------------------------------------
const afterTestSeen = new WeakSet()

function resolveChaosEffectsAfterTest(state, inv, result, api) {
  if (!inv || !result) return
  if (afterTestSeen.has(result)) return
  afterTestSeen.add(result)
  const hard = hardSide(state)
  const cancelled = new Set(result.cancelledTokens || result.cancelled || [])
  const drawn = (result.drawn || []).filter(token => !cancelled.has(token))
  const has = token => result.token === token || drawn.includes(token)
  const investigating = String(result.source?.label || '') === '调查'
  const location = investigating
    ? (state.locations || []).find(item => (item.originalCode || item.code) === result.source?.code) || null
    : null
  const failed = !result.success

  if (failed && has('cultist') && location) {
    const amount = hard ? 2 : 1
    api.setShroudMod?.(location, amount)
    flags(state).cultistShroud = { round: state.round, locationId: location.id, amount }
    api.info?.(`[cultist]：${inv.name} 调查失败——「${location.name}」隐藏值 +${amount}（直到本轮结束）。`)
  }
  if (failed && has('tablet')) {
    const answer = api.choose?.({
      kind: 'harm', source: '06119-tablet', seat: inv.seat,
      prompt: '[tablet]：受到 1 伤害 + 1 恐惧，或在当前密谋上放 1 毁灭。',
      options: [
        { id: 'harm', label: '受到 1 伤害 + 1 恐惧' },
        { id: 'doom', label: '在当前密谋上放 1 毁灭' },
      ],
    }) ?? 'harm'
    if (String(answer) === 'doom') api.addDoom?.(1)
    else {
      api.damage?.(inv.seat, 1)
      api.horror?.(inv.seat, 1)
    }
    api.info?.('[tablet]：结算失败后果。')
  }
  if (result.success && investigating && has('elderthing')) {
    api.discoverClue?.(inv.seat, 1)
    api.info?.('[elder_thing]：调查成功——发现 1 个额外线索。')
  }
}

// ---------------------------------------------------------------------------
// 行为对象
// ---------------------------------------------------------------------------
export const behavior = {
  ...encounterRules,
  id: 'theSearchForKadath',
  implementedEncounterCodes,
  scenarioGaps,
  scenarioApproximations,

  // 冒规则：所有地点以已揭示面（故事卡在背面）入场。
  locationsStartRevealed: true,
  // 幕 1 的线索推进只在轮末窗口（引擎 objective）。
  roundEndActIndex: 0,

  // ---- 开局 ----
  preScenarioSetup(state, events, api) {
    if (readFlag(state, 'introResolved')) return
    api.setScenarioFlag?.('introResolved', true)
    const leadSeat = Number(state.campaign?.leadSeat ?? 0)
    const records = () => state.campaign?.records || {}
    const hasRecord = key => records()[key] === true
    const parleyed = hasRecord('theInvestigatorsParleyedWithTheZoogs')
    const saved = hasRecord('theInvestigatorsWereSavedByRandolphCarder')
    const tribute = hasRecord('theCatsCollectedTheirTributeFromTheZoogs')

    // 介绍 5：只有「既未与祖格鼠谈判、也未被卡特救下、猫群也未收贡品」时才走二选一。
    let reachedTemple = true
    if (!parleyed && !saved && !tribute) {
      const answer = api.choose?.({
        kind: 'story', source: '06119-intro', seat: leadSeat,
        prompt: '介绍 5：猫群守着神庙。空手离开，还是强行进入？',
        options: [
          { id: 'leaveEmptyHanded', label: '空手离开（不进入神庙）' },
          { id: 'forceIntoTemple', label: '强行进入神庙' },
        ],
      }) ?? 'leaveEmptyHanded'
      if (String(answer) === 'leaveEmptyHanded') reachedTemple = false
      else api.setCampaignRecord?.('theInvestigatorsForcedTheirWayIntoTheTemple', true)
      api.info?.(reachedTemple ? '介绍 8：你强行冲进了神庙。' : '介绍 7：你空手离开了神庙。')
    }
    if (reachedTemple) {
      let evidence = Number(api.campaignRecord?.('evidenceOfKadath') || 0) + 1
      api.info?.('介绍 9：阿塔尔透露了幻梦境的秘密（卡达斯的证据 +1）。')
      if (parleyed) {
        evidence += 1
        api.setScenarioFlag?.('introXpBonus', 2)
        api.info?.('介绍 10：祖格鼠的月酒让阿塔尔吐露更多（卡达斯的证据再 +1；本关结局每位调查员额外 2 经验）。')
      }
      api.setCampaignRecord?.('evidenceOfKadath', evidence)
    }
    // 队长获得维吉尔·格雷剧情支援。
    api.giveAsset?.(leadSeat, VIRGIL_GRAY)
    api.info?.('📖 队长获得剧情支援「维吉尔·格雷」并放入场。')
  },

  setupLocations(state, events, helper = {}) {
    const zones = (state.scenarioZones ||= {})
    zones.setAside = [
      ...SET_ASIDE_ALIASES,
      ...SET_ASIDE_LOCATION_IDS.map(id => scenario.locations[id]?.originalCode || scenario.locations[id]?.code),
    ]
    zones.removed = []
    zones.victory = []
    const flagsState = flags(state)
    flagsState.regionsVisited = []
    flagsState.nightgauntsAside = []
    return [...START_LOCATION_IDS]
  },

  setupEnemies(state, events, helper = {}) {
    const spawn = helper.spawnEnemy
    if (typeof spawn !== 'function') return
    // 1 张「一群乌尼斯」在斯凯河；3–4 人局再加 1 张在狄拉斯-利恩（卡面 setup）。
    spawn(state, PACK_OF_VOONITHS, 'skaiRiver')
    if ((state.numInvestigators || 1) >= 3) spawn(state, PACK_OF_VOONITHS, 'dylathLeen')
  },

  // ---- 混乱标记 ----
  resolveChaosToken(state, inv, token, api) {
    return searchForKadathChaosToken(state, inv, token, api)
  },

  // ---- 幕 / 议程分派 ----
  actReveal(state, act, api) {
    const handled = actRuleFor(codeOf(act))?.onReveal?.(state, act, api)
    const pendingRegion = api.scenarioFlag?.('pendingRegion')
    if (pendingRegion) {
      api.setScenarioFlag?.('pendingRegion', null)
      runRegionSetup(state, api, String(pendingRegion))
    }
    return handled
  },

  // 区域设置把下一个幕下标写进 nextActIndex；引擎在 actReveal 之后读取。
  actIndexAfterAdvance(state, act, api) {
    const next = readFlag(state, 'nextActIndex')
    if (Number.isInteger(next)) {
      api.setScenarioFlag?.('nextActIndex', null)
      return next
    }
    return undefined
  },

  agendaReveal(state, agenda, api) {
    return agendaRuleFor(codeOf(agenda))?.onReveal?.(state, agenda, api)
  },

  // 幕目标：10 个神迹 → 结局 1（任意窗口，卡面 Forced）。
  checkObjectives(state, api) {
    if (signsOfTheGods(state, api) >= 10) {
      api.info?.('✨ 调查员已发现 10 个神迹：进入结局 1。')
      api.finish?.('resolution1')
    }
  },

  // ---- 地点行动：翻面门槛 + 地点条目 [action] + 地点附属 [action] ----
  actionBlocked(state, inv, move) {
    if (move?.action !== 'flipVeiled') return undefined
    const location = (state.locations || []).find(item => item.id === move.locationId)
    if (!location) return undefined
    if (readFlag(state, `storyRead:${location.id}`)) return '该地点已经翻面并读过故事，不能再翻。'
    const requirement = locationRuleFor(codeOf(location))?.flipRequirement
    if (requirement && readFlag(state, requirement.flag) !== true) return requirement.message
    return undefined
  },

  actions(state, inv) {
    const moves = encounterRules.actions?.(state, inv) || []
    const location = here(state, inv)
    if (location) {
      locationRuleFor(codeOf(location))?.actions?.({ moves, state, inv, location })
      for (const attachment of location.attachments || []) {
        const rule = treacheryRuleFor(codeOf(attachment))?.attachedAction
        if (!rule) continue
        moves.push({ action: 'scenarioAction', rule: rule.rule, actions: 1, label: rule.label })
      }
    }
    return moves
  },

  performAction(state, inv, move, api) {
    if (encounterRules.performAction?.(state, inv, move, api)) return true
    const location = here(state, inv)
    const locationRule = location ? locationRuleFor(codeOf(location)) : null
    if (locationRule?.performAction?.(state, inv, move, api)) return true
    // 地点附属诡计的 [action]（06153 麦格鸟之歌）。
    if (location) {
      for (const attachment of location.attachments || []) {
        const rule = treacheryRuleFor(codeOf(attachment))?.attachedAction
        if (!rule || rule.rule !== move.rule) continue
        const skills = rule.skills || ['willpower']
        const answer = api.choose?.({
          kind: 'skill', source: codeOf(attachment), seat: inv.seat,
          prompt: '选择检定技能。',
          options: skills.map(skill => ({ id: skill, label: String(skill) })),
        }) ?? skills[0]
        const skill = skills.includes(String(answer)) ? String(answer) : skills[0]
        api.test?.(inv.seat, skill, rule.difficulty ?? 4, result => {
          if (!result.success) return
          api.detachLocationAttachment?.(location.id, attachment.id)
          api.info?.(`🐦 成功摆脱了「${api.cardName?.(codeOf(attachment)) || codeOf(attachment)}」。`)
        })
        return true
      }
    }
    throw new Error(`未知「寻觅卡达斯」剧本行动：${move.rule}`)
  },

  // ---- 移动前置：斯凯河的技能选择 / 塞拉尼安的额外费用 ----
  beforeMove(state, inv, destination, api, options = {}) {
    const prev = here(state, inv)
    if (prev && codeOf(prev) === RAW.c06128 && readFlag(state, 'storyRead:skaiRiver') !== true) {
      const answer = api.choose?.({
        kind: 'skill', source: RAW.c06128, seat: inv.seat,
        prompt: '斯凯河：离开前检定[willpower](2)或[agility](2)——选择技能。',
        options: [{ id: 'willpower', label: '意志' }, { id: 'agility', label: '敏捷' }],
      }) ?? 'willpower'
      api.setScenarioFlag?.('skaiLeaveSkill', String(answer) === 'agility' ? 'agility' : 'willpower')
    }
    const payLocations = []
    if (destination && locationRuleFor(codeOf(destination))?.extraHandDiscardOnMove) payLocations.push(destination)
    if (prev && locationRuleFor(codeOf(prev))?.extraHandDiscardOnMove) payLocations.push(prev)
    for (const location of payLocations) payExtraHandCost(state, inv, location, api)
  },

  locationLeaveTest(state, inv, prevLoc) {
    const rule = locationRuleFor(codeOf(prevLoc))?.onLeave
    if (!rule?.forcedTest) return null
    if (rule.forcedTest.beforeFlipOnly && readFlag(state, `storyRead:${prevLoc.id}`)) return null
    const choices = rule.forcedTest.skillChoice || ['willpower']
    const chosen = readFlag(state, 'skaiLeaveSkill')
    const skill = choices.includes(chosen) ? chosen : choices[0]
    return { skill, difficulty: rule.forcedTest.difficulty }
  },

  locationLeaveFailed(state, inv, prevLoc, api) {
    const rule = locationRuleFor(codeOf(prevLoc))?.onLeave
    if (rule?.cancelMessage) api.info?.(rule.cancelMessage.replaceAll('{name}', inv.name))
    api.flipLocation?.(prevLoc.id, inv.seat)
  },

  // 掩藏地点：引擎原生 flipVeiled 成功后派发 → 读背面故事卡。
  veiledFlipped(state, inv, locationId, flipped, api) {
    if (!flipped?.changed) return
    const location = (state.locations || []).find(item => item.id === locationId)
    const storyCode = flipped.storyCode
      || location?.storyCode
      || location?.backCode
      || scenario.locations?.[locationId]?.backCode
    api.info?.(`🗺️ 翻面「${location?.name || locationId}」。`)
    resolveStoryCard(state, inv, location, storyCode, api)
  },

  // 自身能力翻面的地点（斯凯河 / 禁闭之地）：api.flipLocation 触发。
  locationFlipped(state, location, api, seat) {
    if (!location) return
    if (location.veiled === true) return // Veiled 走 veiledFlipped
    const definition = scenario.locations?.[location.id] || {}
    const storyCode = definition.backCode || definition.storyCode || null
    const inv = Number.isInteger(seat) ? state.investigators?.[seat] : null
    resolveStoryCard(state, inv, location, storyCode, api)
  },

  // ---- 调查/检定后 ----
  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    resolveChaosEffectsAfterTest(state, inv, result, api)
    if (!inv || !result) return
    const investigating = String(result.source?.label || '') === '调查'
    const location = investigating
      ? (state.locations || []).find(item => (item.originalCode || item.code) === result.source?.code) || null
      : null
    if (!location) return
    // 地点的「调查后强制」（萨尔纳斯 / 鲁因遗迹 / 地图未见之城）。
    locationRuleFor(codeOf(location))?.afterTest?.(state, location, inv, result, api)
    // 奇妙平原：附着地点被成功调查后的强制。
    if (result.success) {
      for (const attachment of (location.attachments || []).slice()) {
        const rule = treacheryRuleFor(codeOf(attachment))?.afterInvestigateSuccess
        if (!rule) continue
        api.horror?.(inv.seat, rule.horror || 1)
        api.addDoom?.(rule.doom || 1)
        api.detachLocationAttachment?.(location.id, attachment.id)
        api.info?.(`🌾 「奇妙平原」：成功调查附着地点——受到 1 点恐惧、放 1 毁灭并弃掉本卡。`)
      }
    }
  },

  locationShroudModifier(state, location, inv) {
    if (!location) return 0
    let value = 0
    if ((location.attachments || []).some(attachment => codeOf(attachment) === RAW.c06154)) value -= 2
    const rule = locationRuleFor(codeOf(location))
    if (Number.isFinite(rule?.shroudPerPriest)) {
      const priests = (state.enemies || []).filter(enemy =>
        enemy.location === location.id
        && codeOf(enemy) === PRIEST_OF_A_THOUSAND_MASKS
        && enemy.swarmHostId == null).length
      value += rule.shroudPerPriest * priests
    }
    return value
  },

  investigatorEntryError(state, location, inv) {
    if (!location) return undefined
    const rule = locationRuleFor(codeOf(location))?.entryRequirement
    if (rule && readFlag(state, rule.flag) !== true) return rule.message
    return undefined
  },

  cluesGained(state, inv, amount, api) {
    if (!(amount > 0)) return
    const location = here(state, inv)
    if (!location) return
    locationRuleFor(codeOf(location))?.cluesGained?.(state, location, inv, amount, api)
  },

  // ---- 敌人规则（卡面数据在 enemyRule；这里只做章节级读点） ----
  enemyStatModifier(state, enemy, stat) {
    let value = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
    const rule = enemyRuleFor(codeOf(enemy))
    if (!rule) return value
    const signs = Number(state.markerCounts?.reference) || 0
    for (const tier of rule.signsOfTheGodsBonuses || []) {
      if (signs >= tier.atSigns && Number.isFinite(tier[stat])) value += tier[stat]
    }
    const swarmCount = swarmCountOf(enemy)
    if (swarmCount === 0) {
      if ((stat === 'fight' || stat === 'evade') && Number.isFinite(rule.fightEvadeBonusWithoutSwarm)) {
        value += rule.fightEvadeBonusWithoutSwarm
      }
      if (stat === 'evade' && Number.isFinite(rule.evadePenaltyWithoutSwarm)) {
        value += rule.evadePenaltyWithoutSwarm
      }
    }
    return value
  },

  enemyAttackModifier(state, enemy, inv) {
    const rule = enemyRuleFor(codeOf(enemy))
    if (!rule?.signsOfTheGodsBonuses) return undefined
    const signs = Number(state.markerCounts?.reference) || 0
    let damage = 0
    for (const tier of rule.signsOfTheGodsBonuses) {
      if (signs >= tier.atSigns && Number.isFinite(tier.damage)) damage += tier.damage
    }
    return damage ? { damage } : undefined
  },

  // 伊伯生物：敌人攻击步骤改为攻击其地点的每位调查员（并跳过引擎的正常攻击）。
  enemyPhaseAfterHunters(state, api) {
    for (const enemy of [...(state.enemies || [])]) {
      if (enemyRuleFor(codeOf(enemy))?.attacksEachInvestigatorAtLocation !== true) continue
      const targets = activeInvestigators(state).filter(inv => inv.location === enemy.location)
      if (!targets.length) continue
      for (const inv of targets) api.attack?.(enemy, inv)
      api.skipEnemyAttackThisRound?.(enemy)
      api.info?.(`👁️ 「${enemy.name}」攻击本地点的每位调查员（跳过正常攻击）。`)
    }
  },

  afterEvade(state, inv, enemy, result, api) {
    if (!result?.success || !enemy) return
    const rule = enemyRuleFor(codeOf(enemy))
    if (!rule) return
    if (rule.evadeDisengageWithoutExhaust || rule.cannotEngageUntilEndOfPhase) {
      api.readyEnemy?.(enemy) // 「不要横置它」
    }
    if (rule.cannotEngageUntilEndOfPhase) {
      flags(state).cannotEngageEnemy = {
        ...(flags(state).cannotEngageEnemy || {}),
        [enemy.id]: { round: state.round, phase: state.phase, seat: inv.seat },
      }
      api.info?.(`🦁 「${enemy.name}」本阶段结束前不能再与 ${inv.name} 交战。`)
    }
    if (rule.discardAfterEvade) {
      api.discardEnemy?.(enemy)
      api.info?.(`🌪️ 「${enemy.name}」被躲避后弃掉。`)
    }
  },

  canEngageEnemy(state, inv, enemy) {
    if (!enemy) return undefined
    const rule = enemyRuleFor(codeOf(enemy))
    if (!rule?.cannotEngageUntilEndOfPhase) return undefined
    const marker = flags(state).cannotEngageEnemy?.[enemy.id]
    if (!marker) return undefined
    if (marker.round !== state.round || marker.phase !== state.phase) return undefined
    if (Number(marker.seat) !== Number(inv?.seat)) return undefined
    return false
  },

  // ---- 轮末 / 回合末 / 离开 ----
  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    // 祖兰-提克：轮末按在此的调查员数给「夜色怪群」加蜂拥卡。
    for (const location of state.locations || []) {
      locationRuleFor(codeOf(location))?.onRoundEnd?.(state, location, api)
    }
    // 区域幕：全员同一港口时可在轮末推进。
    advanceRegionActAtRoundEnd(state, api)
    // 清除本轮 [cultist] 的隐藏值修正。
    const cultistShroud = flags(state).cultistShroud
    if (cultistShroud && cultistShroud.round === state.round) {
      const location = (state.locations || []).find(item => item.id === cultistShroud.locationId)
      if (location) api.setShroudMod?.(location, 0)
      delete flags(state).cultistShroud
    }
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
    const location = here(state, inv)
    if (location) locationRuleFor(codeOf(location))?.onTurnEnd?.(state, location, api, inv)
  },

  locationLeft(state, inv, prevLoc, api) {
    if (!prevLoc) return
    for (const attachment of (prevLoc.attachments || []).slice()) {
      const rule = treacheryRuleFor(codeOf(attachment))?.afterLeave
      if (!rule) continue
      api.horror?.(inv.seat, rule.horror || 1)
      api.addDoom?.(rule.doom || 1)
      api.detachLocationAttachment?.(prevLoc.id, attachment.id)
      api.info?.(`🐦 离开「${prevLoc.name}」：受到 1 点恐惧、放 1 毁灭并弃掉「麦格鸟之歌」。`)
    }
  },

  // ---- 剧情支援离场 ----
  assetLeftPlay(state, inv, asset, api) {
    if (codeOf(asset) !== VIRGIL_GRAY) return
    asset.removedFromGame = true
    state.removedFromGame ||= []
    if (!state.removedFromGame.includes(VIRGIL_GRAY)) state.removedFromGame.push(VIRGIL_GRAY)
    api.info?.('📖 强制：维吉尔·格雷离场——移出游戏。')
  },

  // ---- 结局 ----
  storyResolutionKey(state, key) {
    if (key !== 'noResolution') return key
    const resigned = (state.investigators || []).some(inv => inv.resigned)
    return resigned ? 'resolution1' : 'resolution2'
  },

  resolution(state, key, events, api = {}) {
    if (key === 'noResolution') {
      const resigned = (state.investigators || []).some(inv => inv.resigned)
      key = resigned ? 'resolution1' : 'resolution2'
    }
    if (!['resolution1', 'resolution2'].includes(key)) return { award: true }
    const records = state.campaign?.records || (state.campaign.records = {})
    const defeated = (state.investigators || []).filter(inv => inv.defeated)
    if (defeated.length) {
      const captured = Array.isArray(records.wasCaptured) ? [...records.wasCaptured] : []
      for (const inv of defeated) if (inv.name && !captured.includes(inv.name)) captured.push(inv.name)
      records.wasCaptured = captured
    }
    const signs = Number(state.markerCounts?.reference) || 0
    records.evidenceOfKadath = (Number(records.evidenceOfKadath) || 0) + signs
    records.virgilWasCaptured = true
    if (key === 'resolution1') records.randolphEludedCapture = true
    else records.randolphWasCaptured = true
    api.info?.(`📜 结局 ${key}：卡达斯的证据 +${signs}；维吉尔被俘${key === 'resolution1' ? '；伦道夫未遭俘虏' : '；伦道夫被俘'}。`)
    const bonus = Number(flags(state).introXpBonus) || 0
    return { award: true, ...(bonus ? { bonus } : {}) }
  },
}

// ---------------------------------------------------------------------------
// 窄工具
// ---------------------------------------------------------------------------
function payExtraHandCost(state, inv, location, api) {
  const hand = [...(inv.hand || [])]
  if (!hand.length) {
    api.info?.(`🌉 「${location.name}」：没有手牌可弃（额外费用未支付）。`)
    return false
  }
  const options = hand.map((code, index) => ({
    id: String(index), cardCode: code, label: api.cardName?.(code) || code,
  }))
  const answer = api.choose?.({
    kind: 'card', source: codeOf(location), seat: inv.seat,
    prompt: `「${location.name}」：进入/离开的额外费用——弃掉 1 张手牌。`,
    options,
  }) ?? '0'
  const picked = options.find(option => option.id === String(answer)) || options[0]
  api.discardFromHand?.(inv.seat, picked.cardCode)
  api.info?.(`🌉 「${location.name}」：弃掉「${api.cardName?.(picked.cardCode) || picked.cardCode}」作为额外费用。`)
  return true
}

// 保持模块可读：未直接使用但供后续 P8-T 使用的卡号常量集中引用，避免 lint 误报。
void CATS_OF_ULTHAR
void CORSAIR_OF_LENG
void ZOOG_SET
void FIRST_ACT_CODE
void currentActCode
