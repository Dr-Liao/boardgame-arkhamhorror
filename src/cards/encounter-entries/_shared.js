// 非玩家卡行为文件的共享窄工具。
//
// 这里的内容原来在 src/cards/encounter-abilities.js 顶部；拆分后由
// src/cards/encounter-entries/<归属目录>/<code>.js 按需 import。
// 只放跨卡复用的工具，不放任何一张卡的规则；某张卡的私有 helper 留在该卡文件里。
//
// 依赖方向：encounter-entries/<归属>/<code>.js → _shared.js → engine/matcher.js / cards-data.js。
// 条目文件不得 import 聚合入口或 engine.js。

import { hasTrait } from '../../engine/matcher.js'
import { ALL_CARDS } from '../cards-data.js'

export { hasTrait, ALL_CARDS }

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
    prompt: `选择要生成在村公所的 ${trait} 敌人。`,
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

export function connectPassagewaysInEntry(state) {
  const inPlay = state.scenario.passagewayLocations.filter(id => state.locations.some(location => location.id === id))
  for (const location of state.locations.filter(candidate => inPlay.includes(candidate.id))) {
    location.connections = [...new Set([...location.connections, ...inPlay.filter(id => id !== location.id)])]
  }
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
