// 非玩家卡行为文件的共享窄工具。
//
// 这里的内容原来在 src/cards/encounter-abilities.js 顶部；拆分后由
// src/cards/encounter-entries/<归属目录>/<code>.js 按需 import。
// 只放跨卡复用的工具，不放任何一张卡的规则；某张卡的私有 helper 留在该卡文件里。
//
// 依赖方向：encounter-entries/<归属>/<code>.js → _shared.js → engine/matcher.js / cards-data.js。
// 条目文件不得 import 聚合入口或 engine.js。

import { hasTrait } from '../../engine/matcher.js'
import { canClaimKey, canGiveKeys } from '../../engine/scenario-keys.js'
import { ALL_CARDS } from '../cards-data.js'
import { traitLabel } from '../trait-labels.js'

export { hasTrait, ALL_CARDS }

// 「你检定失败且每低于难度 1 点」的唯一读法：难度优先取本次检定的实际难度（含难度修正），
// 检定的 result 没带 difficulty 时（老测试桩 / 部分外部调用）回落到卡面声明的难度。
// 差值下限 0，与引擎旧 DSL 的 applyPenalty（src/engine/treachery-tokens.js）同一口径。
// 用法：api.test(..., result => { if (result.success) return; api.horror(inv.seat, failedBy(result, 3)) })
export const failedBy = (result, fallbackDifficulty = 0) =>
  Math.max(0, Number(result?.difficulty ?? fallbackDifficulty) - Number(result?.value ?? 0))

// 05097 秘社玄仪「直到一轮结束，对该敌人攻击、躲避或谈判的难度 +2」的通用读点。
// 攻击/躲避由 encounter-rules.js 的 enemyStatModifier 汇总；谈判由各谈判条目/章节
// behavior 调用这一个口径（内容层 encounter-rules.parleyDifficultyBonus 是它的别名）。
export function enemyParleyDifficultyBonus(enemy, round) {
  const bonus = enemy?.roundFightEvadeBonus
  if (!bonus || bonus.round !== round) return 0
  return Number(bonus.amount) || 0
}

// 沿连接图从 from 走一步，使得到 to 的距离最短（03097 的逐地点移动）。
export function shortestNextStep(state, from, to) {
  const distance = new Map([[to, 0]])
  const queue = [to]
  while (queue.length) {
    const current = queue.shift()
    const location = state.locations.find(candidate => candidate.id === current)
    for (const next of location?.connections || []) {
      if (distance.has(next) || !state.locations.some(candidate => candidate.id === next)) continue
      distance.set(next, distance.get(current) + 1)
      queue.push(next)
    }
  }
  const current = state.locations.find(candidate => candidate.id === from)
  let best = null
  for (const next of current?.connections || []) {
    if (!distance.has(next)) continue
    if (!best || distance.get(next) < distance.get(best)) best = next
  }
  return best
}

// 胜利区的复仇点数（失落时代的「复仇」按卡面点数累计到胜利区）。
export const victoryVengeance = state => (state?.victoryDisplay || [])
  .reduce((sum, card) => sum + Number(card.vengeance || 0), 0)

export const actThreeIs = (state, value) => state?.scenarioFlags?.actThree === value

// 一个实体的印刷卡号（附属于别的卡时 originalCode 才是原卡号）。
export const originalOf = entity => entity?.originalCode || entity?.code

// 第 55 轮：章节地点规则要用的两个查询（只读 state，不写）。
export const activeInvestigators = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
export const investigatorAt = (state, locationId) => activeInvestigators(state).find(inv => inv.location === locationId)
export const revealLead = (state, loc) => investigatorAt(state, loc.id) || state.investigators[state.campaign.leadSeat]
export const scenarioLocationId = (state, code) => state.locations.find(loc => originalOf(loc) === code)?.id || null
// 第 83 轮：邪秽誓约的「记住事实」由地点条目直接写 scenarioFlags。
export const rememberFact = (state, fact) => {
  state.scenarioFlags.remembered ||= []
  if (!state.scenarioFlags.remembered.includes(fact)) state.scenarioFlags.remembered.push(fact)
}

// 第 92 轮：边界之外古代地点的「团队每轮一次」行动 helper（从 behavior 复制）。
export const isWeaknessCode = code => ['weakness', 'basicweakness'].includes(ALL_CARDS[code]?.subtype)
export function teamOnce(state, key, scope = 'phase') {
  const flags = state.scenarioFlags ||= {}
  const bucket = (flags.teamOnce ||= {})
  const tag = `${key}:${state.round}:${scope === 'round' ? 'r' : state.phase}`
  if (bucket[tag]) return false
  bucket[tag] = true
  return true
}
export function discoverAt(state, api, inv, location, amount) {
  if (!inv || !location) return 0
  const found = Math.min(Math.max(0, amount), location.clues || 0)
  if (found <= 0) return 0
  location.clues -= found
  api.gainClues(inv.seat, found)
  return found
}
export function shuffleDeckWith(state, inv, api) {
  const random = () => api.random?.() ?? 0.5
  for (let index = inv.deck.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1))
    ;[inv.deck[index], inv.deck[target]] = [inv.deck[target], inv.deck[index]]
  }
}
// 第 109 轮：幽嘶深渊的追击区 helper（从 behavior 复制，供条目使用）。
export function tfaPursuitEvade(state, entry) {
  const printed = Number(state.scenario.enemies?.[entry.code]?.evade || 0)
  const depth = Math.max(1, Number(state.scenarioFlags?.depthLevel || 1))
  return entry.code === '04298' ? printed + depth : printed
}
export function tfaPlacePursuit(state, api) {
  const pursuit = state.scenarioZones?.pursuit || []
  if (!pursuit.length) return null
  const best = Math.max(...pursuit.map(entry => tfaPursuitEvade(state, entry)))
  const candidates = pursuit.filter(entry => tfaPursuitEvade(state, entry) === best)
  const chosen = candidates.length === 1 || typeof api?.choose !== 'function'
    ? candidates[0]
    : candidates[Number(api.choose({
      kind: 'enemy', source: 'theDepthsOfYoth', seat: state.campaign.leadSeat,
      prompt: '选择一位躲闪值最高的追击敌人入场。',
      options: candidates.map((entry, index) => ({
        id: String(index), label: state.scenario.enemies?.[entry.code]?.name || entry.code,
      })),
    }))] || candidates[0]
  const index = pursuit.indexOf(chosen)
  if (index >= 0) pursuit.splice(index, 1)
  const start = state.scenarioFlags?.depthStartLocation
  const enemy = api.spawn(chosen.code, start)
  if (!enemy) { pursuit.push(chosen); return null }
  enemy.damageTaken = chosen.damageTaken || 0
  if (chosen.code === '04062' && chosen.resources) enemy.harbingerResources = chosen.resources
  api.info?.(`追击中的「${enemy.name}」在「${start}」现身。`)
  return enemy
}
// 第 101 轮：混乱袋永久加标记（谢幕使者被击败）。
export function addPermanentChaosTokens(state, token, amount) {
  state.chaosBag = [...(state.chaosBag || []), ...Array(amount).fill(token)]
  if (state.campaign) state.campaign.chaosBag = [...(state.campaign.chaosBag || []), ...Array(amount).fill(token)]
}

// 谢幕三张 2c 幕的背面（03047a/b/c）：不弃掉苍白面具下的男子，改为移动到前厅并留在场上。
// 关键点是 `defeatEnemy` / `discardEnemyCard` 已经先把敌人移出 state.enemies：
// 这里必须重新收录，否则敌人既不在场也不进胜利区（P0 审计的原始缺陷）。
// `enemy == null` 时只结算背面其余效果（尚未生成男子）。
export function applyStrangerBack(state, code, enemy, api) {
  const origin = enemy?.location || null
  if (enemy) {
    const ownerDiscard = state.investigators?.[enemy.bearerSeat]?.discard
    for (const pile of [state.encounterDiscard, ownerDiscard]) {
      if (!pile) continue
      const index = pile.lastIndexOf(enemy.code)
      if (index >= 0) pile.splice(index, 1)
    }
    state.enemies ||= []
    if (!state.enemies.includes(enemy)) state.enemies.push(enemy)
    enemy.location = 'lobby'
    enemy.engagedSeat = null
    enemy.damageTaken = 0
    enemy.exhausted = false
    delete enemy.defeatedBy
    api.info?.(`🛋️ 苍白面具下的男子没有被弃掉：他被移动到「前厅」并留在场上。`)
  }
  state.scenarioFlags ||= {}
  state.locations ||= []
  if (code === '03047a') {
    addPermanentChaosTokens(state, 'cultist', 2)
    const theatre = state.locations.find(location => location.id === 'theatre')
    if (theatre) theatre.horror = (theatre.horror || 0) + 1
    state.scenarioFlags.hazard = 'flames'
  } else if (code === '03047b') {
    addPermanentChaosTokens(state, 'tablet', 2)
    const originLocation = state.locations.find(location => location.id === origin)
    if (originLocation) originLocation.horror = (originLocation.horror || 0) + 1
    state.scenarioFlags.hazard = 'ooze'
  } else if (code === '03047c') {
    addPermanentChaosTokens(state, 'elderthing', 2)
    for (const location of state.locations) {
      if ((location.traits || []).includes('Private')) location.horror = (location.horror || 0) + 1
    }
    state.scenarioFlags.hazard = 'flood'
  }
}

// 02329 星际旅行者：进入地点（含生成时）把 1 个线索翻成毁灭。
export function starlightTravelerEnters(state, enemy) {
  if (enemy.textBlanked && enemy.textBlanked.round === state.round && enemy.textBlanked.phase === state.phase) return
  const location = state.locations.find(item => item.id === enemy.location)
  if (location?.clues > 0) location.clues--
  enemy.doom = (enemy.doom || 0) + 1
}

// 02258 子嗣移动：朝目标地点沿最短路移动一步（第 61 轮从 later-behaviors 复制）。
export function moveBroodToward(state, enemy, target, api) {
  const here = state.locations.find(loc => loc.id === enemy.location)
  if (!here || here.id === target) return
  const distance = new Map([[target, 0]]), queue = [target]
  for (const id of queue) {
    const location = state.locations.find(loc => loc.id === id)
    for (const neighbor of location?.connections || []) if (!distance.has(neighbor)
      && state.locations.some(loc => loc.id === neighbor)) {
      distance.set(neighbor, distance.get(id) + 1)
      queue.push(neighbor)
    }
  }
  const adjacent = here.connections.filter(id => distance.has(id))
  if (!adjacent.length) return
  const nearest = Math.min(...adjacent.map(id => distance.get(id)))
  const candidates = adjacent.filter(id => distance.get(id) === nearest)
  const destination = candidates.length === 1 ? candidates[0] : api.choose({
    kind: 'location', source: '02294', seat: state.campaign.leadSeat,
    prompt: `选择「${enemy.name}」的移动方向（等距路线）。`,
    options: candidates.map(id => ({ id, label: state.locations.find(loc => loc.id === id)?.name || id })),
  })
  if (api.moveEnemy) api.moveEnemy(enemy, destination)
  else enemy.location = destination
}

// 02259 生物踪迹：随机选一个地点，02245 允许敏捷（3）重新选择。
export function chooseBroodRandomLocation(state, api) {
  let chosen = state.locations[Math.floor(api.random() * state.locations.length)]
  if (originalOf(chosen) !== '02245') return chosen
  const candidates = activeInvestigators(state).filter(inv => inv.location === chosen.id)
  for (const inv of candidates) {
    if (api.choose({ kind: 'reaction', source: '02245', seat: inv.seat,
      prompt: '进行敏捷（3）检定，成功后重新选择随机地点？',
      options: [{ id: 'skip', label: '不触发' }, { id: 'trigger', label: '进行检定' }] }) !== 'trigger') continue
    let success = false
    api.test(inv.seat, 'agility', 3, result => { success = result.success })
    if (success) {
      const others = state.locations.filter(loc => loc.id !== chosen.id)
      if (others.length) chosen = others[Math.floor(api.random() * others.length)]
      break
    }
  }
  return chosen
}

// 02141 追猎恐魔 / 02142 暗影之子（第 62 轮从 later-behaviors 复制，供 02146 条目使用）。
export function summonHuntingHorror(state, location, api) {
  let enemy = state.enemies.find(item => item.code === '02141')
  if (!enemy) {
    for (const pile of [state.encounterDeck, state.encounterDiscard]) {
      const index = pile.indexOf('02141')
      if (index >= 0) pile.splice(index, 1)
    }
    enemy = api.spawn('02141', location)
    if (!enemy) return null
    if (!enemy.shadowSpawned) attachShadowSpawned(state, enemy, api)
  } else if (api.moveEnemy) api.moveEnemy(enemy, location)
  else enemy.location = location
  enemy.exhausted = false
  return enemy
}

export function attachShadowSpawned(state, enemy, api) {
  if (enemy.shadowSpawned) return
  const zones = state.scenarioZones
  let resources = 0
  if (zones.void) {
    resources = (zones.void.resources || 0) + 1
    delete zones.void
  } else {
    const index = (zones.setAside || []).indexOf('02142')
    if (index >= 0) zones.setAside.splice(index, 1)
  }
  enemy.shadowResources = resources
  enemy.shadowSpawned = true
  enemy.fight += resources
  enemy.evade += resources
  enemy.health += resources
  enemy.massive = resources >= 3
  api.info?.(`「追猎恐魔」附属「暗影之子」（${resources} 资源${resources >= 3 ? '，获得巨大' : ''}）。`)
}

// 02167–02171 旅客车厢：弃掉指定图标，或承受伤害/恐惧（第 68 轮从 later-behaviors 复制）。
export function essexPassengerCompartment(state, inv, api, code, { skill, needed, damage = 0, horror = 0, harmLabel }) {
  const options = []
  for (let mask = 1; mask < 2 ** inv.hand.length; mask++) {
    const indices = inv.hand.map((_, index) => index).filter(index => mask & (1 << index))
    const value = indices.reduce((sum, index) => sum + (ALL_CARDS[inv.hand[index]]?.icons?.[skill] || 0)
      + (skill === 'wild' ? 0 : ALL_CARDS[inv.hand[index]]?.icons?.wild || 0), 0)
    if (value < needed || indices.some(index => value - (ALL_CARDS[inv.hand[index]]?.icons?.[skill] || 0)
      - (skill === 'wild' ? 0 : ALL_CARDS[inv.hand[index]]?.icons?.wild || 0) >= needed)) continue
    options.push({ id: indices.join(','), label: `弃牌：${indices.map(index => ALL_CARDS[inv.hand[index]]?.nameZh || inv.hand[index]).join('、')}` })
  }
  const answer = api.choose({ kind: 'location', source: code, seat: inv.seat,
    prompt: `旅客车厢：弃掉合计至少 ${needed} 个指定图标，或受到伤害／恐惧。`,
    options: [{ id: 'harm', label: harmLabel }, ...options] })
  if (answer === 'harm') {
    if (damage) api.damage(inv.seat, damage)
    if (horror) api.horror(inv.seat, horror)
  } else for (const index of answer.split(',').map(Number).sort((a, b) => b - a)) inv.discard.push(inv.hand.splice(index, 1)[0])
}

// 第 64 轮：剧情资产控制者选择（从 later-behaviors.chooseStoryController 复制，改用 api.choose）。
export function chooseStoryControllerEntry(state, code, api) {
  const seat = api.choose({
    kind: 'story', source: code, seat: state.campaign.leadSeat,
    prompt: '选择剧情资产的控制者。',
    options: activeInvestigators(state).map(inv => ({ id: String(inv.seat), label: inv.name })),
  })
  api.giveAsset(Number(seat), code)
}

// 从遭遇牌库/弃牌堆按特性生成敌人（第 63 轮从 later-behaviors 复制 chooseCandidate 逻辑）。
export function chooseCandidateEntry(api, request, candidates, { key, label, cardCode } = {}) {
  if (!candidates.length) return null
  if (candidates.length === 1 || typeof api.choose !== 'function') return candidates[0]
  const keyOf = key || (candidate => String(candidate.id ?? candidate.seat ?? candidate.index ?? candidate.code))
  const labelOf = label || (candidate => candidate.label || candidate.name || String(candidate.code ?? candidate.id ?? ''))
  const answer = api.choose({
    ...request,
    options: candidates.map(candidate => ({
      id: keyOf(candidate),
      ...(cardCode ? { cardCode: cardCode(candidate) } : {}),
      label: labelOf(candidate),
    })),
  })
  return candidates.find(candidate => keyOf(candidate) === answer) || candidates[0]
}

export function spawnTraitEnemyAtVillage(state, loc, api, trait) {
  const matches = []
  // 卡面只允许从遭遇牌库检索（不含弃牌堆）。
  state.encounterDeck.forEach((code, index) => {
    if ((state.scenario.enemies[code]?.traits || []).some(item => item.toLowerCase() === trait.toLowerCase())) {
      matches.push({ code, index, pileName: 'encounterDeck' })
    }
  })
  if (!matches.length) return
  const chosen = chooseCandidateEntry(api, {
    kind: 'card', source: originalOf(loc), seat: state.currentSeat ?? state.campaign.leadSeat,
    prompt: `选择要生成在村公所的 ${traitLabel(trait)} 敌人。`,
  }, matches, {
    key: match => `${match.pileName}:${match.index}`,
    cardCode: match => match.code,
    label: match => ALL_CARDS[match.code]?.nameZh || match.code,
  })
  state.encounterDeck.splice(chosen.index, 1)
  api.spawn(chosen.code, scenarioLocationId(state, '02201') || 'location02201')
  api.shuffleEncounterDeck()
}

// 04062 瓦卢西亚的预示者（第 54 轮从 TFA encounter-rules.js 搬来）：
// 资源累积 / 横置也能反击 / 按记录带伤入场。
export function harbingerSpawn(state, enemy) {
  enemy.resources = enemy.resources || 0
  enemy.retaliateWhileExhausted = true
  enemy.tfaRetaliateWhileExhausted = true
  const recorded = Number(state.scenarioFlags?.harbingerDamage
    ?? state.campaign?.records?.theHarbingerIsStillAlive ?? 0)
  if (!enemy.damageTaken && recorded > 0) enemy.damageTaken = recorded
  // 第 118 轮：命运之线要记录「预示者已经入场」（原来写在章节 enemySpawned 里）。
  state.scenarioFlags ||= {}
  state.scenarioFlags.harbingerEnteredPlay = true
}

export function harbingerAfterSuccessfulTest(state, enemy, api) {
  if (!enemy || !state.enemies.includes(enemy)) return false
  const need = 2 * Math.max(1, state.numInvestigators || 1)
  const next = (enemy.resources || 0) + 1
  if (next < need) {
    enemy.resources = next
    api?.info?.(`🐍 「${enemy.name}」上放置 1 资源（${next}/${need}）。`)
    return false
  }
  // 这一击会击败它时先走引擎的击败判定（进胜利区 / 记复仇），不遁去。
  if (Number.isFinite(enemy.health) && enemy.health > 0 && (enemy.damageTaken || 0) >= enemy.health) return false
  const damage = enemy.damageTaken || 0
  const flags = (state.scenarioFlags ||= {})
  flags.harbingerDamage = damage
  flags.harbingerSetAside = true
  const records = state.campaign?.records
  if (records) records.theHarbingerIsStillAlive = damage
  if (enemy.engagedSeat != null) {
    const holder = state.investigators[enemy.engagedSeat]
    if (holder) holder.engaged = (holder.engaged || []).filter(id => id !== enemy.id)
  }
  enemy.engagedSeat = null
  const index = state.enemies.indexOf(enemy)
  if (index >= 0) state.enemies.splice(index, 1)
  const zones = (state.scenarioZones ||= {})
  zones.harbingerAside = { code: '04062', damageTaken: damage, resources: next }
  zones.setAside ||= []
  if (!zones.setAside.includes('04062')) zones.setAside.push('04062')
  flags.harbingerResources = 0
  api?.info?.('🐍 「瓦卢西亚的预示者」发出奸险的嘶嘶声，遁去身影（保留所有伤害标记）。')
  return true
}

// 风琴手远离最近调查员的移动（第 7 批从 aPhantomOfTruth/behavior.js 搬来）。
export function moveOrganistAway(state, api) {
  const organist = state.enemies.find(enemy => ['03221', '03221b'].includes(enemy.code))
  if (!organist) return
  organist.engagedSeat = null
  const investigators = state.investigators
    .filter(inv => !inv.defeated && !inv.resigned)
    .map(inv => inv.location)
  const here = state.locations.find(location => location.id === organist.location)
  const candidates = (here?.connections || []).filter(id => state.locations.some(location => location.id === id))
  if (!candidates.length) return
  const scored = candidates.map(id => ({ id, score: api.locationDistance(id, investigators) }))
  const best = Math.max(...scored.map(item => item.score))
  const choices = scored.filter(item => item.score === best)
  const destination = choices.length === 1 ? choices[0].id : api.choose({
    kind: 'location', source: organist.id, seat: state.campaign.leadSeat,
    prompt: '选择风琴手远离最近调查员的移动地点。',
    options: choices.map(item => ({ id: item.id, label: api.locationName(item.id) })),
  })
  api.moveEnemy(organist, destination)
}

// 「不可言说的誓言」的钥匙选择 / 怪物暂存（第 7 批从章节 behavior 搬来）。
export function chooseKeysInEntry(state, api, skills = ['combat', 'agility', 'intellect']) {
  const options = [
    ...skills.map(skill => ({ id: skill, label: `由一位调查员进行 [${skill}]（4）检定` })),
    { id: 'force', label: '强行夺走钥匙' },
  ]
  const answer = api.choose({
    kind: 'story', source: '03163', seat: state.campaign.leadSeat,
    prompt: '选择取得地下室钥匙的方式。', options,
  })
  if (answer === 'force') {
    state.scenarioFlags.tookKeysByForce = true
    state.scenarioFlags.keysFound = 1
    return
  }
  const candidates = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
  const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choose({
    kind: 'target', source: `03163-${answer}`, seat: state.campaign.leadSeat,
    prompt: '选择进行检定的调查员。',
    options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
  }))
  api.test(seat, answer, 4, result => {
    if (result.success) {
      state.scenarioFlags.keysFound = 1
      return
    }
    chooseKeysInEntry(state, api, skills.filter(skill => skill !== answer))
  })
}

export function stashRandomMonsterInEntry(state, api) {
  const monsters = state.scenarioZones.monsters || []
  if (!monsters.length) return null
  const code = monsters.splice(Math.floor(api.random() * monsters.length), 1)[0]
  if (state.agendaIndex === 2) {
    state.encounterDeck.push(code)
    api.shuffleEncounterDeck()
  } else {
    state.scenarioZones.underAct ||= []
    state.scenarioZones.underAct.push(code)
  }
  return code
}

// 「埃兹特里覆灭」的时间石室 / 古代遗物 / 预示者（第 7 批从章节 behavior 搬来）。
export function doomLocation(state, code) {
  return state.locations.find(location => originalOf(location) === code)
}

export function takeFromSetAsideInEntry(state, code) {
  const zones = (state.scenarioZones ||= {})
  const list = (zones.setAside ||= [])
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
}

export function takeControlOfRelicInEntry(state, api) {
  const chamber = doomLocation(state, '04068')
  const candidates = chamber
    ? state.investigators.filter(inv => !inv.defeated && !inv.resigned && inv.location === chamber.id)
    : []
  if (!candidates.length) {
    api.info?.('时间石室里没有调查员，古代遗物仍留在原地。')
    return null
  }
  const answer = candidates.length === 1 ? String(candidates[0].seat) : api.choose({
    kind: 'investigator', source: '04058', seat: state.campaign.leadSeat ?? 0,
    prompt: '选择位于时间石室、控制「古代遗物」的调查员。',
    options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
  })
  const seat = Number(answer)
  const owner = candidates.find(inv => inv.seat === seat) || candidates[0]
  const asset = (state.storyAssets || []).find(item => originalOf(item) === '04061')
  if (asset) state.storyAssets.splice(state.storyAssets.indexOf(asset), 1)
  if (!(owner.assets || []).some(item => originalOf(item) === '04061')) api.giveAsset?.(owner.seat, '04061')
  api.moveRelicOfAges?.({ seat: owner.seat })
  api.info?.(`🏺 ${owner.name} 控制了「古代遗物」。`)
  return owner
}

export function chooseEntryOption(api, request, candidates, label = candidate => candidate.name || candidate.id) {
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]
  const key = candidate => String(candidate?.id ?? candidate?.seat ?? candidate?.code)
  const id = api.choose({ ...request, options: candidates.map(candidate => ({ id: key(candidate), label: label(candidate) })) })
  return candidates.find(candidate => key(candidate) === String(id)) || candidates[0]
}

export function entryDistance(state, from, to) {  if (from === to) return 0
  const queue = [[from, 0]]
  const seen = new Set([from])
  for (const [id, steps] of queue) {
    if (id === to) return steps
    const location = state.locations.find(candidate => candidate.id === id)
    for (const next of location?.connections || []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return Infinity
}

export function formLocationLineInEntry(state, api) {  const entryway = doomLocation(state, '04060')
  const chamber = doomLocation(state, '04068')
  const others = state.locations
    .filter(location => location.id !== entryway?.id && location.id !== chamber?.id)
    .sort((left, right) => (left.doom || 0) - (right.doom || 0)
      || String(originalOf(left)).localeCompare(String(originalOf(right))))
  const order = [chamber, ...others, entryway].filter(Boolean)
  const flags = (state.scenarioFlags ||= {})
  flags.locationLine = order.map(location => location.id)
  flags.locationsInLine = true
  for (const [index, location] of order.entries()) {
    location.connections = [order[index - 1]?.id, order[index + 1]?.id].filter(Boolean)
    location.linePosition = index + 1
  }
  state.scenario.layout ||= {}
  state.scenario.layout.locations = Object.fromEntries(order.map((location, index) => [
    location.id, { x: index - (order.length - 1) / 2, y: 0 },
  ]))
  api.info?.(`🧱 遗迹排成一条线：${order.map(location => location.name).join(' → ')}。`)
  return order
}

export function spawnHarbingerAtDoomInEntry(state, api) {
  const flags = (state.scenarioFlags ||= {})
  if (!state.locations.length) return null
  const most = Math.max(...state.locations.map(location => location.doom || 0))
  const candidates = state.locations.filter(location => (location.doom || 0) === most)
  const answer = candidates.length === 1 ? candidates[0].id : api.choose({
    kind: 'location', source: '04055', seat: state.campaign.leadSeat ?? 0,
    prompt: '选择毁灭标记最多、预示者生成的地点。',
    options: candidates.map(location => ({ id: location.id, label: `${location.name}（毁灭 ${location.doom || 0}）` })),
  })
  const locationId = (candidates.find(location => location.id === answer) || candidates[0]).id
  takeFromSetAsideInEntry(state, '04062')
  flags.harbingerSpawned = true
  const enemy = api.spawn('04062', locationId)
  const spawned = enemy || state.enemies.find(item => originalOf(item) === '04062') || null
  if (spawned) {
    if (!spawned.damageTaken && flags.harbingerDamage) spawned.damageTaken = flags.harbingerDamage
    spawned.resources = spawned.resources || 0
    spawned.tfaRetaliateWhileExhausted = true
  }
  return spawned
}

// 第 114 轮：邪秽誓约的「随机怪物」池（从 theUnspeakableOath 的 behavior 复制）。
// 密谋 2 时直接塞回遭遇牌库，否则放到幕牌底下（换乘了同一张牌。）
export function stashMonsterFromZones(state, api) {
  const monsters = state.scenarioZones?.monsters || []
  if (!monsters.length) return null
  const index = Math.floor((api.random?.() ?? 0.5) * monsters.length)
  const code = monsters.splice(index, 1)[0]
  if (state.agendaIndex === 2) {
    state.encounterDeck.push(code)
    api.shuffleEncounterDeck?.()
  } else {
    state.scenarioZones.underAct ||= []
    state.scenarioZones.underAct.push(code)
  }
  return code
}

// 第 114 轮：东区病房的「疯子」口径（原 behavior 的 isLunatic：Lunatic 或 Possessed）。
export const isLunaticEnemy = enemy => hasTrait(enemy, 'Lunatic') || hasTrait(enemy, 'Possessed')

// 第 114 轮：幽嘶深渊追击区域的蛇族判定（原 behavior 的 hasSerpentDefinition / serpentFight）。
export const pursuitDefinitionOf = (state, code) => state.scenario?.enemies?.[code] || {}
export const isPursuitSerpent = (state, code) => hasTrait(pursuitDefinitionOf(state, code), 'Serpent')
export const pursuitFightOf = (state, code) => Number(pursuitDefinitionOf(state, code).fight || 0)

// 第 115 轮：荒莽密林（失落时代第一章）的共用读点。
// 中毒判定与章节 behavior 同口径（04102 中毒弱点，或引擎标记 poisoned）。
export const isPoisonedInvestigator = inv => (inv?.threat || []).some(card => originalOf(card) === '04102')
  || inv?.poisoned === true
export const locationOfInvestigator = (state, inv) => (state.locations || []).find(location => location.id === inv?.location)
// 探索牌库洗混：与章节 behavior 的 mix() 同序（优先 api.shuffle，退化为 Fisher–Yates）。
export function mixIntoEntry(state, api, list) {
  if (typeof api?.shuffle === 'function') return api.shuffle([...list])
  const copy = [...list]
  const random = () => api?.random?.() ?? 0.5
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

// 第 115 轮：课外活动的实验体沿最短路走向目标地点（原 behavior.moveExperiment 的 BFS）。
export function moveExperimentToward(state, experiment, target) {
  const queue = [[experiment.location]]
  const visited = new Set([experiment.location])
  for (let index = 0; index < queue.length; index++) {
    const path = queue[index]
    if (path.at(-1) === target) {
      if (path.length > 1) experiment.location = path[1]
      return
    }
    const location = (state.locations || []).find(entry => entry.id === path.at(-1))
    for (const next of location?.connections || []) {
      if (!visited.has(next) || !state.locations.some(entry => entry.id === next)) continue
      visited.add(next)
      queue.push([...path, next])
    }
  }
}



// 第 116 轮：破碎永世（失落时代第五章）的共用读点。
// 混沌袋 + 封印区 + 支援上的封印标记计数（04334 / 04335 的发动条件）。
export function sealedSymbolCountInEntry(state, symbol) {
  let count = (state.chaosBag || []).filter(token => token === symbol).length
  for (const entry of state.chaos?.sealed || []) if (entry.token === symbol) count += 1
  for (const inv of state.investigators || []) {
    for (const asset of inv.assets || []) {
      for (const sealed of asset.sealed || []) if (sealed === symbol) count += 1
    }
  }
  return count
}

// 拉莱耶海岸：本地点上「每张卡牌（含自身）」的毁灭标记总数（04328 的隐藏值修正）。
export function locationDoomTotalInEntry(state, location) {
  let doom = location.doom || 0
  for (const enemy of (state.enemies || []).filter(entry => entry.location === location.id)) doom += enemy.doom || 0
  for (const attachment of location.attachments || []) doom += attachment.doom || 0
  for (const inv of (state.investigators || []).filter(entry => entry.location === location.id)) {
    doom += (inv.threat || []).reduce((sum, card) => sum + (card.doom || 0), 0)
    doom += (inv.assets || []).reduce((sum, card) => sum + (card.doom || 0), 0)
  }
  return doom
}

// 第 118 轮：命运之线的「在场幕牌堆」计数（与章节 actsInPlay 同源，直接读 actDecks）。
export function threadActDecksInPlay(state) {
  return Object.values(state.scenarioFlags?.actDecks || {}).filter(deck => deck && !deck.completed).length
}

// 第 118 轮：调查员线索总数回写（与引擎 locations.syncClues 同口径）。
export function syncCluesInEntry(state) {
  state.clues = (state.investigators || []).reduce((sum, inv) => sum + (inv.clues || 0), 0)
}

// 往事回声 03121/03122/03123 的强制效果（有线索放到敌人身上后翻成毁灭面）已随 P2-6 收口：
// 写入点是引擎原语 `moveClueToEnemy`（src/engine/enemy-clues.js），条目不再需要辅助函数。

// 「场上的毁灭标记总数」：密谋 + 敌人 + 地点 + 调查员的支援/威胁区。
// 与 carcosa-chaos.js 的 skull 计算同口径，供 03092 等卡复用。
export function doomInPlayInEntry(state) {
  return (state.doom || 0)
    + (state.enemies || []).reduce((sum, enemy) => sum + (enemy.doom || 0), 0)
    + (state.locations || []).reduce((sum, location) => sum + (location.doom || 0), 0)
    + (state.investigators || []).reduce((sum, inv) => sum
      + [...(inv.assets || []), ...(inv.threat || [])]
        .reduce((inner, card) => inner + (card.doom || 0), 0), 0)
}

// Single-sided encounter locations use their authored physical identity.
export function putRevealedPrintedLocation(state, inv, card, api) {
  api.placePrintedLocation(card.originalCode || card.code, { seat: inv.seat, reveal: true })
  return true
}

// Read-only mechanic queries available to individual encounter entries.
export { keysAt, keysHeldAtLocation, keysHeldByGroup } from '../../engine/scenario-keys.js'
export { barrierEdges, barrierCount, canPlaceBarrier } from '../../engine/edge-barriers.js'
export { effectiveFloodLevel, floodLevel } from '../../engine/flood.js'
export { locationLookCandidates } from '../../engine/location-look.js'
export { payablePoolTokens } from '../../engine/chaos-token-pool.js'
export { gridPosition, gridLocations } from '../../engine/grid-map.js'


import { keysAt as heldKeysQuery, keysHeldAtLocation as localHeldKeysQuery, keysHeldByGroup as groupKeysQuery } from '../../engine/scenario-keys.js'
export function keyedFlashbackAbility({ key, keyCount, flashback, requiresNoClues = true, label }) {
  return { kind: 'free', actionKind: 'activate', label,
    limit: { scope: 'perGame', owner: 'group' },
    criteria: ({ state, inv, source }) => (!requiresNoClues || source.clues === 0)
      && (key ? heldKeysQuery(state, 'investigator:'+inv.seat).includes(key) : groupKeysQuery(state).length >= keyCount),
    resolve: ({ inv, api }) => api.scenario.resolveFlashback(inv.seat, flashback) }
}

export function evadeTraitAndDrainLocation({ state, source, api }, { trait = 'Ancient One' } = {}) {
  for (const enemy of [...state.enemies]) if (enemy.traits?.includes(trait)) api.autoEvadeEnemy(enemy)
  api.water.set(source.id, 0)
  api.water.lock(source.id)
}

export function suspectEntry({ code, homes, label, skill = null, difficulty = 0, cost = {}, failureDamage = 0, failureHorror = 0 }) {
  return {
    code, scope: 'enemy', implemented: true,
    enemyRule: { revelationSpawn: { locationOriginalCodes: homes, cluesPerInvestigator: 1 } },
    abilities: [{
      kind: 'action', actionKind: 'parley', label, cost: { action: 1, ...cost },
      resolve: ({ state, inv, source, api }) => {
        const take = () => api.scenario.takeEnemyClues(source, inv.seat, 1, { victoryWhenEmpty: true })
        if (!skill) return take()
        api.test(inv.seat, skill, difficulty + enemyParleyDifficultyBonus(source, state.round), {
          source: { type: 'scenario', action: 'parley', code, name: source.name, ability: true },
          target: { kind: 'enemy', id: source.id }, actionKind: 'parley',
          resolve: result => {
            if (result.success) take()
            else {
              if (failureDamage) api.damage(inv.seat, failureDamage)
              if (failureHorror) api.horror(inv.seat, failureHorror)
            }
          },
        })
      },
    }],
  }
}

// Proposed shared factory for main integration. Not executed by worker.
export function symbolFailingRevelation({ code, skills, difficulty, token, onFailure }) {
  return (state, inv, card, api) => {
    const labels = { willpower: '意志', intellect: '智力', combat: '战力', agility: '敏捷' }
    const skill = skills.length === 1 ? skills[0] : api.choose({ kind: 'skill', seat: inv.seat, source: code,
      prompt: '选择本次显现检定的技能。', options: skills.map(id => ({ id, label: labels[id] })) })
    if (!skills.includes(skill)) return false
    api.test(inv.seat, skill, difficulty, result => {
      if (!result.success) onFailure({ state, inv, card, api, result })
    }, 0, { code, ability: true }, { autoFailOnTokens: [token] })
    return false
  }
}

export function localKeyFlashbackAbility({ keys, cluesPerInvestigator, flashback, label }) {
 return {kind:'free',actionKind:'activate',label,cost:{groupClues:({state})=>cluesPerInvestigator*state.numInvestigators},limit:{scope:'perGame',owner:'instance'},
  criteria:({state,source})=>keys.every(color=>localHeldKeysQuery(state,source.id).includes(color)),
  resolve:({inv,api})=>api.scenario.resolveFlashback(inv.seat,flashback)}
}

export function scenarioReferenceEntry({ code, scenarioRule }) {
 return {code,scope:'scenario',scenarioRule,abilities:[
  {kind:'free',actionKind:'activate',range:'anywhere',label:'拿取本地点的一把钥匙',criteria:({state,inv})=>canClaimKey(state,inv.seat),resolve:({inv,api})=>api.interactions.keys(inv.seat,'claimKey')},
  {kind:'free',actionKind:'activate',range:'anywhere',label:'将钥匙交给同地点调查员',criteria:({state,inv})=>canGiveKeys(state,inv.seat),resolve:({inv,api})=>api.interactions.keys(inv.seat,'giveKeys',{max:7})},
 ]}
}

export function defeatedSuspectAgendaAbility({ isKidnapper, recordValue, recordKey = 'outForBlood' }) {
  return { kind: 'forced', trigger: 'enemyDefeated',
    limit: { scope: 'perWindow', owner: 'instance' }, label: '击败嫌疑人：取得其线索并记录寻仇',
    criteria: ({ state, inv, context }) => context.accepted === true && context.sourceSeat === inv.seat
      && context.enemy?.traits?.some(trait => trait.toLowerCase() === 'suspect') && !isKidnapper(state, context.enemy),
    resolve: ({ state, inv, context, api }) => {
      api.enemyOutcomes.takeClues(context, inv.seat, 'all')
      api.recordSets.add(recordKey, recordValue(state, context.enemy))
    },
  }
}

// 印斯茅斯「猎鹰岬疑案」的印刷身份表：嫌疑人与藏身处卡号 ↔ 战役记录里写的角色名。
// 这是印刷卡面数据（不是某张卡的规则），放在共享窄工具里，条目只需要 import 这一个出口；
// 不允许再单开 roles.js 这类旁路模块（条目只允许 _shared.js / _lookup.js / matcher.js）。
export const SUSPECTS = { '07076': 'RobertFriendly', '07077': 'ZadokAllen', '07078': 'BrianBurnham',
  '07079': 'BarnabasMarsh', '07080': 'JoyceLittle', '07081': 'OtheraGilman' }
export const HIDEOUTS = { '07070': 'EsotericOrderOfDagon', '07071': 'SawboneAlley', '07072': 'ShorewardSlums',
  '07073': 'TheHouseOnWaterStreet', '07074': 'InnsmouthJail', '07075': 'NewChurchGreen' }
// 记录里既可能是卡号也可能是角色名，双向读回印刷卡号；未知值保持原样（返回 undefined）。
export const printedRole = (map, value) => Object.hasOwn(map, value) ? value
  : Object.keys(map).find(code => map[code] === value)
export const suspectCode = value => printedRole(SUSPECTS, value)
export const suspectRole = value => SUSPECTS[suspectCode(value)]
export const hideoutCode = value => printedRole(HIDEOUTS, value)
export const hideoutRole = value => HIDEOUTS[hideoutCode(value)]

// ---------------------------------------------------------------------------
// P7 · 印斯茅斯终章的两个沉睡古神：达贡（07330a/07330b）与海德拉（07331a/07331b）。
// 两张沉睡面只差名字与巢穴地点，两张苏醒面只差名字与子嗣卡号，因此四条条目由同一份
// 工厂生成（同句规则只写一次；印刷差异全部从参数来）。沉睡的免疫/不能攻击/不能交战由
// 引擎的 enemyRule.slumbering 读点统一执行，条目只写这张卡自己的印刷能力。
// ---------------------------------------------------------------------------

const ancientOnePrintedCode = entity => entity?.originalCode || entity?.code

// 「有钥匙的圣堂地点」数量：苏醒面的攻击值按这个数下降（钥匙不论是否已揭示）。
const keyedSanctumCount = state => (state.locations || []).filter(location => hasTrait(location, 'Sanctum')
  && heldKeysQuery(state, `location:${location.id}`).length > 0).length

// 沉睡面：调查阶段结束时，若调查员在该古神的巢穴且它未横置 → 在它上面放 1 毁灭；
// [action] 意志(4)：成功可横置它或移除 1 毁灭，失败至少 3 点则放 1 毁灭。
export function slumberingAncientOneEntry({ code, name, lairCode, lairName }) {
  const investigatorInLair = state => {
    const lair = (state.locations || []).find(location => ancientOnePrintedCode(location) === lairCode)
    return Boolean(lair) && state.investigators.some(inv => !inv.defeated && !inv.resigned && inv.location === lair.id)
  }
  return {
    code, scope: 'enemy', implemented: true,
    enemyRule: { slumbering: true },
    abilities: [{
      kind: 'forced', trigger: 'investigationPhaseEnds',
      limit: { scope: 'perWindow', owner: 'instance' },
      label: `调查阶段结束时：若调查员在${lairName}且${name}未横置，在${name}上放置1个毁灭`,
      criteria: ({ state, source }) => Boolean(source) && !source.exhausted && investigatorInLair(state),
      resolve: ({ source, api }) => { api.scenario.doomOn(source, 1) },
    }, {
      kind: 'action', actionKind: 'activate',
      label: `检定意志(4)：成功则横置${name}或移除1个毁灭；若失败至少3点则放置1个毁灭`,
      criteria: ({ inv, source }) => Boolean(inv && source) && inv.location === source.location,
      resolve: ({ state, inv, source, api }) => {
        api.test(inv.seat, 'willpower', 4, {
          source: { type: 'enemy', code, name, ability: true },
          testTarget: { kind: 'enemy', id: source.id, actionKind: 'activate' },
          actionKind: 'activate',
          resolve: result => {
            // 事务内可能换过 state 内容，回调里按 id 重新取实例。
            const current = (state.enemies || []).find(enemy => enemy.id === source.id)
            if (!current || current.defeated || current.removedFromGame) return
            if (!result.success) {
              // result 是原始检定结果（只有 result.summary 带 failedBy），统一走 failedBy 读法。
              if (failedBy(result, 4) >= 3) api.scenario.doomOn(current, 1)
              return
            }
            const options = []
            if (!current.exhausted) options.push({ id: 'exhaust', label: `横置${name}` })
            if ((current.doom || 0) > 0) options.push({ id: 'removeDoom', label: `从${name}上移除1个毁灭` })
            if (!options.length) return
            const pick = options.length === 1 ? options[0].id
              : api.choice({ kind: 'effect', source: code, seat: inv.seat,
                  prompt: `选择：横置${name}，或从${name}上移除1个毁灭。`, options })
            if (pick === 'exhaust') api.scenario.exhaustEnemy(current)
            else if (pick === 'removeDoom') api.removeDoomFromCard(current, 1)
          },
        })
      },
    }],
  }
}

// 苏醒面：猎手/庞大/反击由印刷文本解析；攻击值按「有钥匙的圣堂地点」数下降；
// 被躲避或受到伤害后，对场上一张该古神的子嗣做同样的事（多张时由触发者选择）。
export function awakenedAncientOneEntry({ code, name, broodCode, broodName }) {
  const chooseBrood = (state, api, seat, prompt) => {
    const copies = (state.enemies || []).filter(enemy => !enemy.defeated && !enemy.removedFromGame
      && ancientOnePrintedCode(enemy) === broodCode)
    if (!copies.length) return null
    if (copies.length === 1) return copies[0]
    const picked = api.choice({ kind: 'enemy', source: code, seat, prompt,
      options: copies.map(enemy => ({ id: enemy.id, label: enemy.name })) })
    return copies.find(enemy => enemy.id === picked) || copies[0]
  }
  return {
    code, scope: 'enemy', implemented: true,
    modifiers: [{ target: 'enemyFight', amount: ({ state }) => -keyedSanctumCount(state) }],
    abilities: [{
      kind: 'forced', trigger: 'enemyDamaged',
      limit: { scope: 'perWindow', owner: 'instance' },
      label: `${name}受到伤害后：对场上一张${broodName}造成等量伤害`,
      criteria: ({ source, context }) => Boolean(source && context?.enemy
        && context.enemy.id === source.id && (context.damage || 0) > 0),
      resolve: ({ state, inv, source, context, api }) => {
        const target = chooseBrood(state, api, context.seat ?? inv?.seat ?? state.campaign.leadSeat,
          `选择一张${broodName}：对它造成同样的伤害。`)
        if (target) api.damageEnemy(target, context.damage, context.seat ?? null, code)
      },
    }, {
      kind: 'forced', trigger: 'evadeSuccess',
      limit: { scope: 'perWindow', owner: 'instance' },
      label: `${name}被躲避后：对场上一张${broodName}也执行躲避`,
      criteria: ({ source, context }) => Boolean(source && context?.enemy && context.enemy.id === source.id),
      resolve: ({ state, inv, source, context, api }) => {
        const target = chooseBrood(state, api, context.seat ?? inv?.seat ?? state.campaign.leadSeat,
          `选择一张${broodName}：对它也执行躲避。`)
        if (target) api.autoEvadeEnemy(target)
      },
    }],
  }
}

