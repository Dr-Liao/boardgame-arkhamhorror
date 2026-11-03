// 《无归之地》（Point of No Return）· 章节行为层。
//
// 结构：`...encounterRules`（食梦者共享钩子）+ `id` + 本章钩子。逐卡规则不写「卡号分支」：
//   · 幕/议程推进键写在 definition 的阶段数据上（advanceRule 等），behavior 只按字段分派；
//   · 地点/故事规则键在 definition 的 LOCATION_RULES / STORY_RULES；单卡条目 flags 携带同一份键，
//     索引重建后 `entryFlags` 优先（TCU WagesOfSin 的同一口径）；
//   · 漆黑之海 4 张是同一张印刷卡的不同卡号：位置/线索分配按 SEA_OF_PITCH_IDS 数据表处理。
//
// 事实源：参考实现 `Scenario/Scenarios/TheDreamEaters/PointOfNoReturn.hs` 与
// `{Act,Agenda,Enemy,Location,Story,Treachery}/Cards/TheDreamEaters/PointOfNoReturn/*.hs`。
//
// 本章状态键（存档往返/测试断言用，全部纯 JSON）：
//   scenarioFlags: introResolved, actOneVariant, pnrFlipped:<locId>, pnrStory:<locId>,
//                  surgeMythosSeat:<round>, falseAwakeningInPlay, pickmanSeat, firstMythosTreachery
//   scenarioZones: setAside, removed, storyResolved
//   markerCounts.reference（剧本参考卡伤害 = Distortion）
//   campaign.records.stepsOfTheBridge（桥梁进度，number）
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { entryFlags } from '../../../../../src/cards/card-rules.js'
import {
  activeInvestigators, encounterRules, recordsFor,
} from '../../encounter-rules.js'
import { chaosAfterTest, markerCountOf, resolveChaosToken as resolveChaos } from './chaos.js'
import { ACT_ONE_VARIANTS, CODES, INITIAL_LOCATIONS, INTRO_VARIANTS, LOCATION_IDS, LOCATION_RULES, SEA_OF_PITCH_IDS, SET_ASIDE_GROUP_DECKS, STORY_RULES, REMOVE_FROM_GAME_DECKS, RAW_CODES as RAW } from './definition.js'

const codeOf = card => String(card?.originalCode || card?.code || card || '')
const flagsFor = state => (state.scenarioFlags ||= {})
const zonesFor = state => (state.scenarioZones ||= {})
const rulesFor = (table, code) => ({ ...(table?.[codeOf(code)] || {}), ...(entryFlags(codeOf(code)) || {}) })
const locationRuleOf = location => rulesFor(LOCATION_RULES, location)
const storyRuleOf = storyCode => rulesFor(STORY_RULES, storyCode)
const traitsOf = card => (ALL_CARDS[codeOf(card)]?.traits || card?.traits || []).map(trait => String(trait).toLowerCase())
const hasTraitOf = (card, trait) => traitsOf(card).includes(String(trait).toLowerCase())
const storyTextOf = (state, storyCode) => state.scenario?.storyFaces?.[storyCode] || null
const activeAt = (state, locationId) => activeInvestigators(state).filter(inv => inv.location === locationId)
const groupCluesOf = state => activeInvestigators(state).reduce((sum, inv) => sum + Number(inv.clues || 0), 0)
const jsonClone = value => JSON.parse(JSON.stringify(value))

function logStory(api, text, extra = {}) {
  if (!text) return
  const presentation = { kind: 'story', title: '剧情', name: '无归之地', text, ...extra }
  if (typeof api.present === 'function') api.present(text, presentation)
  else api.info?.(text)
}

function logRule(state, api, storyCode) {
  const story = storyTextOf(state, storyCode)
  if (!story) return null
  const body = [story.flavor, story.text].filter(Boolean).join('\n\n')
  logStory(api, body, { code: storyCode, title: story.name || storyCode })
  return story
}

// ---------------------------------------------------------------------------
// 放在一边 / 游戏移除 / 洗入遭遇牌库
// ---------------------------------------------------------------------------

function setAsideLocationIds(state, trait) {
  return Object.entries(state.scenario?.locations || {})
    .filter(([, location]) => traitsOf(location).includes(String(trait).toLowerCase()))
    .map(([id]) => id)
    .filter(id => !(state.locations || []).some(entry => entry.id === id))
}

function placeSetAsideLocations(state, api, trait) {
  for (const id of setAsideLocationIds(state, trait)) {
    const code = state.scenario.locations[id].originalCode || state.scenario.locations[id].code
    api.takeFromSetAside?.(code)
    api.place?.(id)
    api.info?.(`📍 「${state.scenario.locations[id].name || id}」进入游戏。`)
  }
}

function takeSetAsideGroupCards(state, api, groupIds) {
  const codes = []
  for (const groupId of groupIds) {
    for (const code of SET_ASIDE_GROUP_DECKS[groupId] || []) {
      codes.push(code)
      api.takeFromSetAside?.(code)
    }
  }
  return codes
}

function shuffleGroupsIntoDeck(state, api, groupIds) {
  const codes = takeSetAsideGroupCards(state, api, groupIds)
  if (!codes.length) return
  api.shuffleIntoEncounterDeck?.(codes)
  api.shuffleDiscard?.()
  api.info?.(`遭遇牌库洗入 ${codes.length} 张放一边的卡，并洗回遭遇弃牌堆。`)
}

function removeGroupsFromGame(state, api, groupIds) {
  const zones = zonesFor(state)
  zones.removed ||= []
  for (const groupId of groupIds) {
    for (const code of REMOVE_FROM_GAME_DECKS[groupId] || []) {
      api.takeFromSetAside?.(code)
      api.takeEncounterDiscard?.(code)
      if (api.discardEncounterCard?.(code)) api.takeEncounterDiscard?.(code)
      zones.removed.push(code)
    }
  }
  api.info?.(`移出游戏：${groupIds.join(', ')} 遭遇组。`)
}

function giveStoryAssetToLead(state, api, code) {
  const candidates = activeInvestigators(state)
  if (!candidates.length) return null
  const lead = Number(state.campaign?.leadSeat ?? candidates[0].seat)
  const seat = candidates.some(inv => inv.seat === lead) ? lead : candidates[0].seat
  api.takeFromSetAside?.(code)
  const asset = api.giveAsset?.(seat, code) || null
  flagsFor(state).pickmanSeat = seat
  flagsFor(state).pickmanRemovedOnLeave = true
  api.info?.(`剧情支援「理查德·厄普顿·皮克曼」由座位 ${seat} 的调查员控制。`)
  return asset
}

// ---------------------------------------------------------------------------
// 故事效果分派（12 张背面故事卡；按 storyRule 数据键，不写卡号分支）
// ---------------------------------------------------------------------------

function findEncounterCardInDeck(state, api, predicate) {
  if (typeof api.discardUntilEnemy === 'function') {
    const found = api.discardUntilEnemy(state.currentSeat ?? state.campaign?.leadSeat ?? 0, predicate)
    if (found) return found
  }
  const deck = state.encounterDeck || []
  for (let index = deck.length - 1; index >= 0; index -= 1) {
    const code = deck[index]
    if (!predicate(ALL_CARDS[code], code)) continue
    api.discardEncounterCard?.(code)
    return code
  }
  return null
}

function takeFromDiscard(state, api, predicate) {
  const discard = state.encounterDiscard || []
  for (let index = discard.length - 1; index >= 0; index -= 1) {
    const code = discard[index]
    if (!predicate(ALL_CARDS[code], code)) continue
    if (api.takeEncounterDiscard?.(code)) return code
  }
  return null
}

function placeCluesOnEnemy(api, enemy, amount) {
  if (!enemy || !(amount > 0)) return
  if (typeof api.addCluesToEnemy === 'function') {
    api.addCluesToEnemy(enemy, amount)
    return
  }
  // 原语尚未交付（primitive-request）：不直写 enemy.clues，只留日志。
  api.info?.(`（简化）本应在「${enemy.name || enemy.code}」上放置 ${amount} 个线索。`)
}

function spawnAt(state, api, code, locationId, { exhausted = false, engagedSeat = null } = {}) {
  if (!code) return null
  const enemy = engagedSeat == null
    ? api.spawn?.(code, locationId)
    : api.spawnEngaged?.(code, locationId, engagedSeat)
  if (!enemy) return null
  if (exhausted) api.exhaustEnemy?.(enemy)
  return enemy
}

function resetFlipsAfterFailedCheck(state, location) {
  if (!location) return
  const flags = flagsFor(state)
  delete flags[`pnrStory:${location.id}`]
  if (location.veiled) location.veiledRevealed = false
  else delete flags[`pnrFlipped:${location.id}`]
}

function storyGhastlyTunnels(state, api, location, inv) {
  const seat = inv?.seat ?? state.campaign?.leadSeat ?? 0
  const isGhast = (definition, code) => Boolean(definition) && String(definition.type) === 'enemy'
    && (definition.traits || []).some(trait => String(trait).toLowerCase() === 'ghast')
  let code = findEncounterCardInDeck(state, api, isGhast)
  if (!code) code = takeFromDiscard(state, api, isGhast)
  if (!code) {
    api.info?.('遭遇牌库与弃牌堆里没有[[噩妖]]敌人。')
    return
  }
  const enemy = spawnAt(state, api, code, location.id, { exhausted: true })
  if (enemy) {
    placeCluesOnEnemy(api, enemy, 1)
    api.info?.(`「${enemy.name}」以横置状态在「${location.name}」生成，并带有 1 个线索。`)
  }
  api.shuffleEncounterDeck?.()
  void seat
}

function storyTheSentry(state, api, location, inv) {
  api.takeFromSetAside?.(CODES.gugSentinel)
  const enemy = spawnAt(state, api, CODES.gugSentinel, location.id)
  if (!enemy) {
    api.info?.('古革哨兵生成失败。')
    return
  }
  const seat = inv?.seat ?? state.campaign?.leadSeat ?? 0
  api.test?.(seat, 'agility', 3, result => {
    if (result.success) {
      api.exhaustEnemy?.(enemy)
      api.info?.(`${inv?.name || '调查员'} 检定成功：古革哨兵以横置状态入场，不与调查员交战。`)
    } else {
      api.engage?.(enemy, seat)
      api.info?.(`检定失败：古革哨兵与${inv?.name || '调查员'}交战。`)
    }
  })
  placeCluesOnEnemy(api, enemy, Number(state.numInvestigators || 1))
}

function storyAnotherPath(state, api) {
  const rule = storyRuleOf(RAW.c06256b)
  const locationId = rule.placeLocationId || LOCATION_IDS.enchantedWoods
  api.takeFromSetAside?.(CODES.enchantedWoods)
  api.place?.(locationId)
  api.reveal?.(locationId)
  api.setCampaignRecord?.(rule.campaignRecord || 'theInvestigatorsFoundAWayOutOfTheUnderworld', true)
  api.info?.('「魔幻森林（石板暗门）」已揭示放入场；战役日志记录调查员找到了离开地下世界的路。')
}

function spendGroupClues(state, api, amount) {
  let need = Math.max(0, amount)
  for (const inv of activeInvestigators(state)) {
    if (need <= 0) break
    const pay = Math.min(need, Number(inv.clues || 0))
    if (pay > 0) {
      api.spendClues?.(inv.seat, pay)
      need -= pay
    }
  }
  return need <= 0
}

function storyGroupClueCheck(state, api, location, inv, storyCode) {
  const rule = storyRuleOf(storyCode)
  const perInvestigator = Number(rule.clueThresholdPerInvestigator || 3)
  const required = perInvestigator * Number(state.numInvestigators || 1)
  const total = groupCluesOf(state)
  if (total < required) {
    api.info?.(`调查员合计只有 ${total} 个线索（需要 ${required} 个）；「${location.name}」翻回，稍后可再次翻面。`)
    resetFlipsAfterFailedCheck(state, location)
    return false
  }
  if (rule.spendClues !== false) spendGroupClues(state, api, required)
  if (rule.advanceAct) api.advanceAct?.()
  return true
}

function storyScoutingTheVale(state, api, location, inv) {
  const rule = storyRuleOf(RAW.c06258b)
  const look = Number(rule.lookCountPerInvestigator || 2) * Number(state.numInvestigators || 1)
  api.scoutEncounterTop(inv?.seat ?? state.campaign.leadSeat, { count:look, source:RAW.c06258b })
  const targetCode = rule.ignoreLocationCode || RAW.c06258
  const crag = (state.locations || []).find(entry => codeOf(entry) === targetCode)
  if (crag) {
    api.setLocationFlag?.(crag.id, 'ignoreText', true)
    api.info?.('直到本场游戏结束，忽略「食尸鬼峭壁」的文本。')
  }
  void location
}

function storySomethingBelow(state, api, location) {
  const rule = storyRuleOf(RAW.c06259b)
  const dholeTunnel = rule.attachTreachery || RAW.c06272
  const already = (state.locations || []).some(entry => entry.id === location.id
    && (entry.attachments || []).some(attachment => codeOf(attachment) === dholeTunnel))
  if (!already) {
    const found = (state.encounterDeck || []).includes(dholeTunnel)
      ? (api.discardEncounterCard?.(dholeTunnel), dholeTunnel)
      : takeFromDiscard(state, api, (definition, code) => code === dholeTunnel)
    if (found) {
      api.attachEncounterToLocation?.(dholeTunnel, location.id)
      api.shuffleEncounterDeck?.()
      api.info?.('「巨噬蠕虫隧道」已附属到「骸骨之海」。')
    }
  }
  const dholeCode = rule.enemy || RAW.c06271
  const inPlay = (state.enemies || []).find(enemy => codeOf(enemy) === dholeCode)
  if (inPlay) {
    api.moveEnemy?.(inPlay, location.id)
    placeCluesOnEnemy(api, inPlay, Number(rule.enemyClues || 2))
    api.info?.('「滑行的巨噬蠕虫」移动到「骸骨之海」，并获得 2 个线索。')
    return
  }
  let code = (state.encounterDeck || []).includes(dholeCode)
    ? (api.discardEncounterCard?.(dholeCode), dholeCode)
    : takeFromDiscard(state, api, (definition, cardCode) => cardCode === dholeCode)
  if (!code) {
    // 胜利区取回：P8 已提供 api.takeFromVictory（引擎通用原语），取回后按「生成」处理。
    const taken = typeof api.takeFromVictory === 'function' ? api.takeFromVictory(dholeCode) : null
    if (!taken) {
      api.info?.('未能找到滑行的巨噬蠕虫。')
      return
    }
    code = dholeCode
    api.info?.('从胜利区取回了「滑行的巨噬蠕虫」。')
  }
  const enemy = spawnAt(state, api, code, location.id, { exhausted: true })
  if (enemy) {
    placeCluesOnEnemy(api, enemy, Number(rule.enemyClues || 2))
    api.info?.('「滑行的巨噬蠕虫」以横置状态在「骸骨之海」生成，并带有 2 个线索。')
  }
}

function storyInhabitantsOfTheVale(state, api, location, inv) {
  const rule = storyRuleOf(RAW.c06260b)
  const nightgaunt = rule.enemy || RAW.c01172
  let code = (state.encounterDeck || []).includes(nightgaunt)
    ? (api.discardEncounterCard?.(nightgaunt), nightgaunt)
    : takeFromDiscard(state, api, (definition, cardCode) => cardCode === nightgaunt)
  if (code) {
    const spawnId = rule.spawnLocationId || LOCATION_IDS.valeOfPnath
    const enemy = spawnAt(state, api, code, spawnId, { exhausted: true })
    api.info?.(enemy
      ? '「狩猎中的夜魇」以横置状态在「潘斯山谷」生成。'
      : '「狩猎中的夜魇」生成失败。')
  }
  for (const each of activeAt(state, location.id)) {
    api.drawCards?.(each.seat, Number(rule.drawCards || 2))
  }
  const enemies = (state.enemies || []).filter(enemy => !enemy.defeated)
  if (enemies.length) {
    const options = enemies.map((enemy, index) => ({ id: String(index), label: `${enemy.name || enemy.code}` }))
    const picked = enemies.length === 1 ? 0 : Number(api.choose?.({
      kind: 'enemy', source: RAW.c06260b, seat: inv?.seat ?? state.campaign?.leadSeat ?? 0,
      prompt: '选择场上任意一个敌人，在其上放置 2 个线索。', options,
    }) ?? 0)
    placeCluesOnEnemy(api, enemies[picked] || enemies[0], Number(rule.enemyClues || 2))
  }
}

function storySpiderInfestedWaters(state, api, location) {
  const rule = storyRuleOf(RAW.c06262b)
  api.shuffleDiscard?.()
  const isSpider = (definition, code) => Boolean(definition) && String(definition.type) === 'enemy'
    && (definition.traits || []).some(trait => String(trait).toLowerCase() === 'spider')
  const code = findEncounterCardInDeck(state, api, isSpider) || takeFromDiscard(state, api, isSpider)
  if (!code) {
    api.info?.('遭遇牌库里没有[[蜘蛛]]敌人可生成。')
    return
  }
  const enemy = spawnAt(state, api, code, location.id)
  if (enemy) {
    const count = Number(rule.enemyCluesPerInvestigator || 1) * Number(state.numInvestigators || 1)
    placeCluesOnEnemy(api, enemy, count)
    api.info?.(`「${enemy.name}」在「${location.name}」生成，并带有 ${count} 个线索。`)
  }
}

function storyStillSurface(state, api, location) {
  const other = (state.locations || []).find(entry => SEA_OF_PITCH_IDS.includes(entry.id) && entry.id !== location.id)
  if (!other) {
    api.info?.('场上没有另一张「漆黑之海」可供查看。')
    return
  }
  const storyCode = other.backCode || other.storyCode
  const story = storyCode ? storyTextOf(state, storyCode) : null
  api.info?.(`查看另一张「漆黑之海」的背面${story ? `：${(story.text || '').split('\n')[0]}` : '。'}`)
}

function storyRollingPits(state, api) {
  const rule = storyRuleOf(RAW.c06264b)
  const seas = (state.locations || []).filter(entry => SEA_OF_PITCH_IDS.includes(entry.id))
  const clues = seas.map(entry => Number(entry.clues || 0))
  const total = clues.reduce((sum, value) => sum + value, 0)
  seas.forEach((entry, index) => {
    if (clues[index] > 0) api.removeLocationClues?.(entry.id, clues[index])
  })
  const perSea = Math.floor(total / Math.max(1, seas.length))
  api.shuffleLocationPositions(seas.map(location => location.id), { clearOtherTokensAndAttachments:true,preserveOccupants:true })
    for (const location of seas) delete flagsFor(state).storyResolved?.[location.id]
  for (const entry of seas) if (perSea > 0) api.addCluesToLocation(entry.id,perSea)
  const candidates = [...seas]
  for (let remainder = total - perSea * seas.length; remainder > 0; remainder--) {
    const id = api.choose({ kind:'location',source:RAW.c06264b,seat:state.campaign.leadSeat,
      prompt:'选择额外放置 1 个线索的漆黑之海，保持尽量平均。',options:candidates.map(location=>({id:location.id,label:location.name})) })
    api.addCluesToLocation(id,1)
    candidates.splice(candidates.findIndex(location=>location.id===id),1)
  }
  api.info?.(`「起伏的漩涡」：把 ${total} 个线索在 ${seas.length} 张「漆黑之海」间尽可能平均分配；各张漆黑之海可再次用掩藏关键词翻面。`)
}

function storyDispatch(state, api, storyCode, location, inv) {
  const rule = storyRuleOf(storyCode)
  switch (rule.storyRule) {
    case 'ghastlyTunnels': return storyGhastlyTunnels(state, api, location, inv)
    case 'theSentry': return storyTheSentry(state, api, location, inv)
    case 'anotherPath': return storyAnotherPath(state, api, location, inv)
    case 'aStrangeGhoul': return storyGroupClueCheck(state, api, location, inv, storyCode)
    case 'scoutingTheVale': return storyScoutingTheVale(state, api, location, inv)
    case 'somethingBelow': return storySomethingBelow(state, api, location, inv)
    case 'inhabitantsOfTheVale': return storyInhabitantsOfTheVale(state, api, location, inv)
    case 'theWayOut': return storyGroupClueCheck(state, api, location, inv, storyCode)
    case 'spiderInfestedWaters': return storySpiderInfestedWaters(state, api, location, inv)
    case 'stillSurface': return storyStillSurface(state, api, location, inv)
    case 'rollingPits': return storyRollingPits(state, api, location, inv)
    case 'centerOfTheSea': return storyGroupClueCheck(state, api, location, inv, storyCode)
    default:
      api.info?.(`（故事「${storyCode}」没有可结算的规则效果）`)
      return undefined
  }
}

function resolveStory(state, api, storyCode, location, inv) {
  if (!storyCode) return
  logRule(state, api, storyCode)
  storyDispatch(state, api, storyCode, location, inv)
}

// ---------------------------------------------------------------------------
// 章节 hooks
// ---------------------------------------------------------------------------

const behavior = {
  ...encounterRules,
  id: 'pointOfNoReturn',

  // ---- setup ----
  preScenarioSetup(state, events, api) {
    const flags = flagsFor(state)
    if (flags.introResolved) return
    flags.introResolved = true
    const records = recordsFor(state)
    const randolphDied = records.randolphDidNotSurviveTheDescent === true
    flags.actOneVariant = randolphDied ? 'v1' : 'v2'
    if (!randolphDied) state.acts[0] = jsonClone(ACT_ONE_VARIANTS.v2)
    const intro = INTRO_VARIANTS[randolphDied ? 'intro1' : 'intro2']
    const paragraphs = [...INTRO_VARIANTS.intro.paragraphs, ...intro.paragraphs]
    logStory(api, paragraphs.join('\n\n'), { title: intro.title })
    // 「检查桥梁进度」：0 → 无事；1–4 → 参考卡 1 点伤害；≥5 → 2 点伤害。
    const steps = Number(api.campaignRecord?.('stepsOfTheBridge') ?? records.stepsOfTheBridge ?? 0)
    const distortion = steps >= 5 ? 2 : steps >= 1 ? 1 : 0
    if (distortion > 0) {
      api.markers?.add?.('reference', distortion)
      api.info?.(`「桥梁进度」有 ${steps} 个记号：剧本参考卡上放置 ${distortion} 点伤害（Distortion）。`)
    }
  },

  setupLocations(state, events, helper) {
    const zones = zonesFor(state)
    const flags = flagsFor(state)
    zones.setAside = [
      ...Object.values(SET_ASIDE_GROUP_DECKS).flat(),
      ...((state.scenario?.setAsideLocations || []).map(id => state.scenario.locations[id]?.originalCode).filter(Boolean)),
      CODES.gugSentinel, CODES.richardUptonPickman, CODES.falseAwakening,
    ]
    zones.removed = []
    const removedAct = flags.actOneVariant === 'v2' ? CODES.actOneV1 : CODES.actOneV2
    zones.removed.push(removedAct)
    flags.storyResolved = {}
    flags.pnrFlipped = {}
    // 遭遇牌库在 setupDecks 才建立（本钩子早于它），这里没有可洗的牌堆；
    // 牌库顺序由 setup.js 的 shuffle(deck, rng) 统一决定。P9 修掉单参 helper.shuffle 调用。
    void helper
    return [...INITIAL_LOCATIONS]
  },

  afterDeckSetup(state, events, helper) {
    // 卡达斯（False Awakening）：开局从调查员牌组取出，放在密谋牌库旁并有 1 点毁灭。
    const code = CODES.falseAwakening
    for (const inv of state.investigators || []) {
      if (!Array.isArray(inv.deck)) continue
      const index = inv.deck.indexOf(code)
      if (index < 0) continue
      inv.deck.splice(index, 1)
      flagsFor(state).falseAwakeningInPlay = true
      flagsFor(state).falseAwakeningSeat = inv.seat
      helper.api.putNextToAgenda(code, { ownerSeat: inv.seat, doom: 1 })
      helper?.info?.(state, events, '「卡达斯」放在密谋牌库旁，其上放置 1 点毁灭。')
    }
    void events
  },

  // ---- 幕 ----
  actReveal(state, act, api) {
    if (act?.reveal?.type === 'campaignRule') return true
    return undefined
  },

  actLeftPlay(state, act, api) {
    if (!act) return
    const rule = act.advanceRule
    if (rule === 'enteringTheUnderworldV1' || rule === 'enteringTheUnderworldV2') {
      if (rule === 'enteringTheUnderworldV2') giveStoryAssetToLead(state, api, CODES.richardUptonPickman)
      placeSetAsideLocations(state, api, 'Vale')
      removeGroupsFromGame(state, api, act.removeFromGameGroups || [])
      shuffleGroupsIntoDeck(state, api, act.shuffleIntoDeckGroups || [])
      return
    }
    if (rule === 'theDescent') {
      placeSetAsideLocations(state, api, 'Depths')
      shuffleGroupsIntoDeck(state, api, act.shuffleIntoDeckGroups || [])
      return
    }
    if (rule === 'theBlackExpanse') {
      flagsFor(state).actThreeAdvanced = state.round
      api.info?.('「无边黑暗」推进：调查员找到了扭曲的根源。')
      api.finish?.(act.finishOnAdvance || 'resolution1')
    }
  },

  // ---- 幕/议程推进辅助：站在敌人身上的线索被击败后归击败者 ----
  enemyDefeated(state, enemy, api) {
    const replaced = encounterRules.enemyDefeated?.(state, enemy, api)
    const act = state.acts?.[state.actIndex]
    if (act?.takeCluesOnEnemyDefeat && Number(enemy?.clues || 0) > 0) {
      const clues = Number(enemy.clues || 0)
      const seat = Number(state.currentSeat ?? enemy.engagedSeat ?? state.campaign?.leadSeat ?? 0)
      api.clearCluesOnEnemy?.(enemy)
      api.gainClues?.(seat, clues)
      api.info?.(`「${enemy.name || enemy.code}」被击败：${state.investigators?.[seat]?.name || `座位${seat}`} 控制其身上的 ${clues} 个线索。`)
    }
    return replaced
  },

  // ---- 议程 ----
  agendaReveal(state, agenda, api) {
    if (agenda?.reveal?.type === 'campaignRule') return true
    return undefined
  },

  agendaAdvancing(state, agenda, api) {
    if (!agenda) return
    if (agenda.advanceRule === 'aSinisterRealm') {
      api.shuffleDiscard?.()
      api.markers?.add?.('reference', Number(agenda.distortionOnAdvance || 1))
      api.info?.('「邪恶国度」推进：遭遇弃牌堆洗回，参考卡上放置 1 点伤害。')
    }
  },

  // 「怪物围困」：推进时结算选择 + Distortion；≥5 → R2，否则翻回正面（清空毁灭继续）。
  agendaWouldAdvance(state, api) {
    const agenda = state.agendas?.[state.agendaIndex]
    if (!agenda || agenda.advanceRule !== 'besetByMonsters') return undefined
    resolveBesetByMonsters(state, api, agenda)
    const distortion = markerCountOf(state)
    if (distortion >= Number(agenda.finishAtDistortion || 5)) {
      api.info?.(`参考卡上已有 ${distortion} 点伤害（≥5）：现实崩解，进入结局 2。`)
      api.finish?.('resolution2')
      return true
    }
    api.removeDoom(Number.MAX_SAFE_INTEGER)
    api.clearDoomOnCard(agenda)
    api.info?.('「怪物围困」翻回正面：本局继续，现实的结构继续崩解。')
    return true
  },

  // ---- 结局 ----
  storyResolutionKey(state, key) {
    return key === 'noResolution' ? 'resolution2' : key
  },

  resolution(state, key, events, api) {
    const effective = key === 'noResolution' ? 'resolution2' : key
    const records = recordsFor(state)
    const distortion = markerCountOf(state)
    const before = Number(records.stepsOfTheBridge || 0)
    if (effective === 'resolution1' || effective === 'resolution2') {
      records.stepsOfTheBridge = before + distortion
      api.info?.(`战役日志：桥梁进度记号 ${before} → ${records.stepsOfTheBridge}（参考卡伤害 ${distortion}）。`)
    }
    if (effective === 'resolution2') {
      const code = CODES.falseAwakening
      api.takeFromSetAside?.(code)
      const lead = Number(state.campaign?.leadSeat ?? 0)
      const record = state.campaign?.investigators?.[lead]
      if (record) {
        record.deck ||= []
        if (!record.deck.includes(code)) record.deck.push(code)
      }
      api.info?.('队长获得弱点「卡达斯」（不计入牌组张数）。')
    }
    return { award: true }
  },

  // ---- 混乱标记 / 检定后 ----
  resolveChaosToken(state, inv, token, api) {
    return resolveChaos(state, inv, token, api)
  },

  afterTest(state, inv, result, api) {
    chaosAfterTest(state, inv, result, api)
  },

  // ---- 地点 ----
  // 漆黑之海的 X 帷幕 = 剧本参考卡上的伤害数。
  locationShroudModifier(state, location) {
    if (!location) return undefined
    const rule = locationRuleOf(location)
    if (!rule.shroudEqualsReferenceDamage) return undefined
    return markerCountOf(state)
  },

  locationFlipped(state, location, api, seat) {
    const rule = locationRuleOf(location)
    if (!rule.flipStory) return
    const flags = flagsFor(state)
    const key = `pnrStory:${location.id}`
    if (flags[key]) return
    flags[key] = true
    resolveStory(state, api, rule.flipStory, location, { seat })
  },

  // 掩藏地点翻面（引擎原生 flipVeiled 成功后派发）：读故事正文 → 结算故事效果 →（如声明）洗回。
  veiledFlipped(state, inv, locationId, flipped, api) {
    if (!flipped?.changed) {
      api.info?.(`不能翻面：${flipped?.reason || '条件不满足'}`)
      return
    }
    const location = (state.locations || []).find(entry => entry.id === locationId)
    if (!location) return
    const flags = flagsFor(state)
    flags.storyResolved ||= {}
    const locationRule = locationRuleOf(location)
    const storyCode = flipped.storyCode || locationRule.flipStory
    if (storyCode && !flags.storyResolved[locationId]) {
      resolveStory(state, api, storyCode, location, inv)
      if (storyRuleOf(storyCode)?.storyRule !== 'rollingPits') flags.storyResolved[locationId] = storyCode
    }
    const shuffleBack = location.shuffleBack === true || locationRule.shuffleBack === true
    if (shuffleBack && location.veiledRevealed !== false) {
      const flag = `pnrShuffled:${locationId}`
      if (!flags[flag]) {
        flags[flag] = true
        api.veiled?.shuffleBack?.(locationId)
        api.info?.(`「${location.name || locationId}」已翻面并洗回遭遇牌库。`)
      }
    }
  },

  // 发现线索后强制翻面（骸骨之海）。
  cluesRemoved(state, location, amount, api) {
    if (!location) return
    const rule = locationRuleOf(location)
    if (!rule.flipOnCluesDiscovered) return
    const flags = flagsFor(state)
    if (flags[`pnrFlipped:${location.id}`]) return
    flags[`pnrFlipped:${location.id}`] = true
    api.info?.(`强制：「${location.name}」的线索被发现后翻面。`)
    api.flipLocation?.(location.id)
  },

  // 食尸鬼峭壁：神话阶段本地点调查员抽到的第一张诡计获得涌动。
  encounterGainsSurge(state, code, inv) {
    if (!inv) return undefined
    if (ALL_CARDS[code]?.type !== 'treachery') return undefined
    if (String(state.phase) !== 'mythos') return undefined
    const location = (state.locations || []).find(entry => entry.id === inv.location)
    if (!location) return undefined
    if (location.flags?.ignoreText) return undefined
    const rule = locationRuleOf(location)
    if (!rule.firstMythosTreacherySurge) return undefined
    const flags = flagsFor(state)
    const tag = `${state.round}:${inv.seat}`
    flags.firstMythosTreachery = flags.firstMythosTreachery || {}
    if (flags.firstMythosTreachery[tag]) return undefined
    flags.firstMythosTreachery[tag] = String(code)
    return true
  },

  // 食尸鬼平原：[[古革巨人]]敌人不能进入 / 改为在古革巨人之城生成。
  spawnLocation(state, code, fallbackLoc, engagedSeat, api) {
    const definition = ALL_CARDS[code]
    const isGug = Boolean(definition) && String(definition.type) === 'enemy'
      && (definition.traits || []).some(trait => String(trait).toLowerCase() === 'gug')
    if (!isGug) return undefined
    const plain = (state.locations || []).find(entry => entry.id === LOCATION_IDS.plainOfTheGhouls)
    if (!plain) return undefined
    const locationRule = locationRuleOf(plain)
    if (!locationRule.gugCannotEnter && !locationRule.gugSpawnRedirectTo) return undefined
    const redirectId = locationRule.gugSpawnRedirectTo || LOCATION_IDS.cityOfGugs
    if (fallbackLoc !== plain.id && fallbackLoc !== LOCATION_IDS.plainOfTheGhouls) return undefined
    if (!api?.info) return redirectId
    api.info?.(`「${definition.name}」改为在「古革巨人之城」生成（[[古革巨人]]不能进入食尸鬼平原）。`)
    return redirectId
  },

  enemyMoved(state, enemy, locationArg, api, previousArg) {
    encounterRules.enemyMoved?.(state, enemy, locationArg, api, previousArg)
    if (!enemy || !hasTraitOf(enemy, 'gug')) return
    if (enemy.location !== LOCATION_IDS.plainOfTheGhouls) return
    const plain = (state.locations || []).find(entry => entry.id === LOCATION_IDS.plainOfTheGhouls)
    const rule = plain ? locationRuleOf(plain) : {}
    if (!rule.gugCannotEnter && !rule.gugSpawnRedirectTo) return
    api.moveEnemy?.(enemy, rule.gugSpawnRedirectTo || LOCATION_IDS.cityOfGugs)
    api.info?.(`[[古革巨人]]「${enemy.name || enemy.code}」不能进入食尸鬼平原：改为移动到古革巨人之城。`)
  },

  // 潘斯山谷：仍有线索时不能打出/投入卡牌。
  canPlayCard(state, inv, def) {
    const location = (state.locations || []).find(entry => entry.id === inv?.location)
    if (!location) return undefined
    const rule = locationRuleOf(location)
    if (!rule.blocksPlayAndCommitWhileClues) return undefined
    if (Number(location.clues || 0) <= 0) return undefined
    return false
  },

  canCommitCard(state, owner, code) {
    const location = (state.locations || []).find(entry => entry.id === owner?.location)
    if (!location) return undefined
    const rule = locationRuleOf(location)
    if (!rule.blocksPlayAndCommitWhileClues) return undefined
    if (Number(location.clues || 0) <= 0) return undefined
    void code
    return false
  },

  // ---- 玩家行动：地点上的 [action] 翻面（卡斯之塔 / 撒克山峰）+ 皮克曼的受控行动 ----
  actions(state, inv) {
    const moves = encounterRules.actions?.(state, inv) || []
    for (const card of state.agendaAside || []) if (entryFlags(card.originalCode || card.code)?.agendaAsideWeakness) {
      moves.push({ action: 'scenarioAction', actions: 1, rule: `agendaAside:${card.id}`,
        label: '[行动] 检定任意技能，摆脱「卡达斯」' })
    }
    addPickmanActions(state, inv, moves)
    const location = (state.locations || []).find(entry => entry.id === inv?.location)
    if (!location) return moves
    const rule = locationRuleOf(location)
    if (!rule.flipAction) return moves
    const flipped = Boolean(flagsFor(state)[`pnrFlipped:${location.id}`] || flagsFor(state)[`pnrStory:${location.id}`])
    moves.push({
      action: 'scenarioAction',
      rule: `flipLocation:${location.id}`,
      actions: 1,
      label: `🗺️ 「${location.name}」：[action] 检定${rule.flipAction.skill === 'combat' ? '战斗' : '敏捷'}(${rule.flipAction.difficulty}) 翻开背面故事`,
      ...(flipped ? { reason: '本地点已经翻面（本局不能再翻）', used: true } : {}),
    })
    return moves
  },

  performAction(state, inv, move, api) {
    const rule = String(move?.rule || '')
    if (rule.startsWith('agendaAside:')) {
      const card = state.agendaAside?.find(item => `agendaAside:${item.id}` === rule)
      if (!card) return false
      const data = entryFlags(card.originalCode || card.code)
      const skill = api.choose({ kind: 'skill', seat: inv.seat, source: card.code,
        prompt: '选择技能检定。', options: ['willpower','intellect','combat','agility'].map(id => ({ id, label: id })) })
      api.test(inv.seat, skill, data.difficulty + data.difficultyPerInvestigator * state.numInvestigators,
        result => { if (result.success) api.removeAgendaAside(card.id) })
      return true
    }
    if (rule === 'pickmanAttach' || rule === 'pickmanFight') {
      return performPickmanAction(state, inv, move, api)
    }
    if (rule.startsWith('flipLocation:')) {
      const locationId = rule.slice('flipLocation:'.length)
      const location = (state.locations || []).find(entry => entry.id === locationId)
      if (!location) return true
      if (flagsFor(state)[`pnrFlipped:${location.id}`] || flagsFor(state)[`pnrStory:${location.id}`]) {
        api.info?.('本地点已经翻面（本局不能再翻）。')
        return true
      }
      const locationRule = locationRuleOf(location)
      const spec = locationRule.flipAction
      if (!spec) return true
      api.test?.(inv.seat, spec.skill, spec.difficulty, result => {
        if (!result.success) return
        flagsFor(state)[`pnrFlipped:${location.id}`] = true
        api.info?.(`${inv.name} 检定成功：「${location.name}」翻面。`)
        api.flipLocation?.(location.id, inv.seat)
      })
      return true
    }
    return encounterRules.performAction?.(state, inv, move, api) || false
  },

  // 玩家窗口的 [fast]：当前没有任何本章专属 fast 行动（Veiled 翻面是引擎原生 flipVeiled）。
  fastActions(state, inv, timing) {
    void state
    void inv
    void timing
    return []
  },

  scenarioGaps: [],

  scenarioApproximations: [],
}

// ---------------------------------------------------------------------------
// 理查德·厄普顿·皮克曼（06266，受控剧情支援）的 [fast] 附属与 [action] 攻击。
// 规则数据在单卡条目的 assetRule（fastAttachGhoul / fightAction）；引擎无「支援行动」非玩家读点，
// 行动由本章 actions/performAction 分派（NON_PLAYER_SCOPES 不允许条目标 action/free 描述子）。
// ---------------------------------------------------------------------------

function pickmanAssetOf(inv) {
  return (inv?.assets || []).find(asset => codeOf(asset) === CODES.richardUptonPickman) || null
}

function pickmanAttachedCount(api, asset) {
  return (asset.attachments || []).filter(card=>card.encounterAttached && card.facedown).length
}

function pickmanTargets(state, inv) {
  return (state.enemies || []).filter(enemy => !enemy.defeated && enemy.location === inv.location)
}

function addPickmanActions(state, inv, moves) {
  const asset = pickmanAssetOf(inv)
  if (!asset || asset.exhausted) return
  const targets = pickmanTargets(state, inv)
  if (targets.some(enemy => hasTraitOf(enemy, 'ghoul'))) {
    moves.push({
      action: 'scenarioAction', rule: 'pickmanAttach', actions: 0, fast: true,
      label: '🧑‍🎨 横置皮克曼：把所在地点的一个[[食尸鬼]]敌人正面朝下附属到其下',
    })
  }
  if (targets.length) {
    moves.push({
      action: 'scenarioAction', rule: 'pickmanFight', actions: 1, actionKind:'fight',
      label: '🧑‍🎨 横置皮克曼：以基础战斗 5 攻击（伤害 = 附属的正面朝下遭遇卡数）',
    })
  }
}

function performPickmanAction(state, inv, move, api) {
  const asset = pickmanAssetOf(inv)
  if (!asset) return true
  if (asset.exhausted) {
    api.info?.('皮克曼已经横置。')
    return true
  }
  const targets = pickmanTargets(state, inv)
  if (!targets.length) {
    api.info?.('所在地点没有敌人。')
    return true
  }
  if (move.rule === 'pickmanAttach') {
    const ghouls = targets.filter(enemy => hasTraitOf(enemy, 'ghoul'))
    if (!ghouls.length) {
      api.info?.('所在地点没有[[食尸鬼]]敌人。')
      return true
    }
    const options = ghouls.map((enemy, index) => ({ id: String(index), label: enemy.name || enemy.code }))
    const picked = ghouls.length === 1 ? 0 : Number(api.choose?.({
      kind: 'enemy', source: CODES.richardUptonPickman, seat: inv.seat,
      prompt: '选择要正面朝下附属到皮克曼的[[食尸鬼]]敌人。', options,
    }) ?? 0)
    const enemy = ghouls[picked] || ghouls[0]
    api.placeEnemyCardUnderAsset(enemy,asset,{facedown:true})
    const count = pickmanAttachedCount(api, asset)
    asset.exhausted = true
    api.info?.(`${inv.name} 横置皮克曼：把「${enemy.name || enemy.code}」正面朝下附属到他身上（现有 ${count} 张）。`)
    return true
  }
  // pickmanFight：基础战斗 5；伤害 = 附属的正面朝下遭遇卡数。
  const options = targets.map((enemy, index) => ({ id: String(index), label: enemy.name || enemy.code }))
  const picked = targets.length === 1 ? 0 : Number(api.choose?.({
    kind: 'enemy', source: CODES.richardUptonPickman, seat: inv.seat,
    prompt: '选择皮克曼攻击的敌人。', options,
  }) ?? 0)
  const enemy = targets[picked] || targets[0]
  const damage = pickmanAttachedCount(api, asset)
  asset.exhausted = true
  api.fight(inv.seat,enemy.id,{baseValue:5,damageOverride:damage,assetId:asset.id,sourceCode:CODES.richardUptonPickman})
  return true
}

function resolveBesetByMonsters(state, api, agenda) {
  const choice = agenda.advanceChoice || { discardRandom: 1, loseResources: 2 }
  for (const inv of activeInvestigators(state)) {
    const hasHand = (inv.hand || []).length > 0
    const hasResources = Number(inv.resources || 0) >= Number(choice.loseResources || 2)
    if (!hasHand && !hasResources) continue
    const options = []
    if (hasHand) options.push({ id: 'discard', label: `随机弃掉 1 张手牌` })
    if (hasResources) options.push({ id: 'resources', label: `失去 ${choice.loseResources} 点资源` })
    const answer = options.length === 1 ? options[0].id : String(api.choose?.({
      kind: 'option', source: RAW.c06249, seat: inv.seat,
      prompt: '「怪物围困」：选择随机弃 1 张手牌，或失去 2 点资源。', options,
    }) ?? options[0].id)
    if (answer === 'discard') {
      api.discardRandom?.(inv.seat, Number(choice.discardRandom || 1))
      api.info?.(`🌫️ ${inv.name} 随机弃掉 1 张手牌。`)
    } else {
      api.loseResources?.(inv.seat, Number(choice.loseResources || 2))
      api.info?.(`🌫️ ${inv.name} 失去 ${choice.loseResources} 点资源。`)
    }
  }
  api.shuffleDiscard?.()
  api.markers?.add?.('reference', Number(agenda.distortionOnAdvance || 1))
  api.info?.('「怪物围困」：遭遇弃牌堆洗回，参考卡上放置 1 点伤害。')
}

export { behavior }
export default behavior

// 本章自己实现的遭遇卡条目（古革哨兵 + 4 张诡计）；其余共享组由各自分片的单卡条目承载。
export const implementedEncounterCodes = [RAW.c06267, RAW.c06268, RAW.c06269, RAW.c06270, RAW.c06275]
