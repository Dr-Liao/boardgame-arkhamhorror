// 诡镇奇谈：卡牌版 · 非玩家卡能力（Phase 3 · D1 内容通道）
//
// 这里写敌人 / 地点 / 幕与议程 / 剧情支援 / 威胁区遭遇卡的声明式行为。
// 与 src/cards/entries/<code>.js 是同一套描述子，只是条目的 `scope` 不是 'card'：
//   scope: 'enemy' | 'location' | 'act' | 'agenda' | 'storyAsset' | 'treachery'
//
// 为什么需要这个通道（重构路线 §5 D1）：
//   · 此前敌人与地点的能力只能写在 `content/campaigns/<campaign>/scenarios/<id>/behavior.js`
//     或 `encounter-rules.js` 的钩子里——同一张卡的规则在多个章节重复实现，
//     引擎里也留着 `enemy.code === '…'` 这样的分支；
//   · 现在这些能力写在卡号条目上：引擎按「场上实体」枚举（descriptorSources），
//     数值与布尔规则走 modifiers.js 的 entityModifierTotal / entityRuleActive。
//
// 可用的修正目标（modifiers.js 的 ENTITY_MODIFIER_TARGETS / ENTITY_RULE_TARGETS）：
//   enemyFight / enemyEvade / enemyHealth / locationShroud / locationClues
//   cannot:attack / cannot:beAttacked / cannot:beDefeated / cannot:beDamaged
//   cannot:opportunityAttack / ignore:revealText
//
// 修正的来源按「声明在谁身上」决定：敌人自己的条目总是生效；地点的条目作用于
// 「位于该地点的敌人」；当前幕/议程的条目作用于全场敌人。
// 条件与数值函数拿到的 ctx：{ state, source, entity, host, helpers }
//   entity = 被修正的实体（敌人/地点/…），source = 声明这条修正的卡，
//   helpers.remainingSanity(inv) / helpers.maxSanity(inv) 是引擎口径的读点。
//
// 约定：只写「这张卡自己的规则」。跨卡、跨章节的剧本流程仍然留在 scenario behavior；
// 有简化行为的条目必须写 simplified: true + note（见路线文档 §3 末条）。

import { hasTrait } from '../engine/matcher.js'
import { ALL_CARDS } from './cards-data.js'

// 沿连接图从 from 走一步，使得到 to 的距离最短（03097 的逐地点移动）。
function shortestNextStep(state, from, to) {
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
const victoryVengeance = state => (state?.victoryDisplay || [])
  .reduce((sum, card) => sum + Number(card.vengeance || 0), 0)

const actThreeIs = (state, value) => state?.scenarioFlags?.actThree === value

// 一个实体的印刷卡号（附属于别的卡时 originalCode 才是原卡号）。
const originalOf = entity => entity?.originalCode || entity?.code

// 第 55 轮：章节地点规则要用的两个查询（只读 state，不写）。
const activeInvestigators = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const investigatorAt = (state, locationId) => activeInvestigators(state).find(inv => inv.location === locationId)
const revealLead = (state, loc) => investigatorAt(state, loc.id) || state.investigators[state.campaign.leadSeat]
const scenarioLocationId = (state, code) => state.locations.find(loc => originalOf(loc) === code)?.id || null
// 第 83 轮：邪秽誓约的「记住事实」由地点条目直接写 scenarioFlags。
const rememberFact = (state, fact) => {
  state.scenarioFlags.remembered ||= []
  if (!state.scenarioFlags.remembered.includes(fact)) state.scenarioFlags.remembered.push(fact)
}

// 第 92 轮：边界之外古代地点的「团队每轮一次」行动 helper（从 behavior 复制）。
const isWeaknessCode = code => ['weakness', 'basicweakness'].includes(ALL_CARDS[code]?.subtype)
function teamOnce(state, key, scope = 'phase') {
  const flags = state.scenarioFlags ||= {}
  const bucket = (flags.teamOnce ||= {})
  const tag = `${key}:${state.round}:${scope === 'round' ? 'r' : state.phase}`
  if (bucket[tag]) return false
  bucket[tag] = true
  return true
}
function discoverAt(state, api, inv, location, amount) {
  if (!inv || !location) return 0
  const found = Math.min(Math.max(0, amount), location.clues || 0)
  if (found <= 0) return 0
  location.clues -= found
  api.gainClues(inv.seat, found)
  return found
}
function shuffleDeckWith(state, inv, api) {
  const random = () => api.random?.() ?? 0.5
  for (let index = inv.deck.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1))
    ;[inv.deck[index], inv.deck[target]] = [inv.deck[target], inv.deck[index]]
  }
}
// 第 109 轮：幽嘶深渊的追击区 helper（从 behavior 复制，供条目使用）。
function tfaPursuitEvade(state, entry) {
  const printed = Number(state.scenario.enemies?.[entry.code]?.evade || 0)
  const depth = Math.max(1, Number(state.scenarioFlags?.depthLevel || 1))
  return entry.code === '04298' ? printed + depth : printed
}
function tfaPlacePursuit(state, api) {
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
function addPermanentChaosTokens(state, token, amount) {
  state.chaosBag = [...(state.chaosBag || []), ...Array(amount).fill(token)]
  if (state.campaign) state.campaign.chaosBag = [...(state.campaign.chaosBag || []), ...Array(amount).fill(token)]
}

// 谢幕三张 2c 幕的背面（03047a/b/c）：不弃掉苍白面具下的男子，改为移动到前厅并留在场上。
// 关键点是 `defeatEnemy` / `discardEnemyCard` 已经先把敌人移出 state.enemies：
// 这里必须重新收录，否则敌人既不在场也不进胜利区（P0 审计的原始缺陷）。
// `enemy == null` 时只结算背面其余效果（尚未生成男子）。
function applyStrangerBack(state, code, enemy, api) {
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
function starlightTravelerEnters(state, enemy) {
  if (enemy.textBlanked && enemy.textBlanked.round === state.round && enemy.textBlanked.phase === state.phase) return
  const location = state.locations.find(item => item.id === enemy.location)
  if (location?.clues > 0) location.clues--
  enemy.doom = (enemy.doom || 0) + 1
}

// 02258 子嗣移动：朝目标地点沿最短路移动一步（第 61 轮从 later-behaviors 复制）。
function moveBroodToward(state, enemy, target, api) {
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
function chooseBroodRandomLocation(state, api) {
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
function summonHuntingHorror(state, location, api) {
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

function attachShadowSpawned(state, enemy, api) {
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
function essexPassengerCompartment(state, inv, api, code, { skill, needed, damage = 0, horror = 0, harmLabel }) {
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
function chooseStoryControllerEntry(state, code, api) {
  const seat = api.choose({
    kind: 'story', source: code, seat: state.campaign.leadSeat,
    prompt: '选择剧情资产的控制者。',
    options: activeInvestigators(state).map(inv => ({ id: String(inv.seat), label: inv.name })),
  })
  api.giveAsset(Number(seat), code)
}

// 从遭遇牌库/弃牌堆按特性生成敌人（第 63 轮从 later-behaviors 复制 chooseCandidate 逻辑）。
function chooseCandidateEntry(api, request, candidates, { key, label, cardCode } = {}) {
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

function spawnTraitEnemyAtVillage(state, loc, api, trait) {
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
function harbingerSpawn(state, enemy) {
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

function harbingerAfterSuccessfulTest(state, enemy, api) {
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
function moveOrganistAway(state, api) {
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
function chooseKeysInEntry(state, api, skills = ['combat', 'agility', 'intellect']) {
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

function stashRandomMonsterInEntry(state, api) {
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

function connectPassagewaysInEntry(state) {
  const inPlay = state.scenario.passagewayLocations.filter(id => state.locations.some(location => location.id === id))
  for (const location of state.locations.filter(candidate => inPlay.includes(candidate.id))) {
    location.connections = [...new Set([...location.connections, ...inPlay.filter(id => id !== location.id)])]
  }
}

// 「埃兹特里覆灭」的时间石室 / 古代遗物 / 预示者（第 7 批从章节 behavior 搬来）。
function doomLocation(state, code) {
  return state.locations.find(location => originalOf(location) === code)
}

function takeFromSetAsideInEntry(state, code) {
  const zones = (state.scenarioZones ||= {})
  const list = (zones.setAside ||= [])
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
}

function takeControlOfRelicInEntry(state, api) {
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

function chooseEntryOption(api, request, candidates, label = candidate => candidate.name || candidate.id) {
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]
  const key = candidate => String(candidate?.id ?? candidate?.seat ?? candidate?.code)
  const id = api.choose({ ...request, options: candidates.map(candidate => ({ id: key(candidate), label: label(candidate) })) })
  return candidates.find(candidate => key(candidate) === String(id)) || candidates[0]
}

function entryDistance(state, from, to) {  if (from === to) return 0
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

function formLocationLineInEntry(state, api) {  const entryway = doomLocation(state, '04060')
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

function spawnHarbingerAtDoomInEntry(state, api) {
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
function stashMonsterFromZones(state, api) {
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
const isLunaticEnemy = enemy => hasTrait(enemy, 'Lunatic') || hasTrait(enemy, 'Possessed')

// 第 114 轮：幽嘶深渊追击区域的蛇族判定（原 behavior 的 hasSerpentDefinition / serpentFight）。
const pursuitDefinitionOf = (state, code) => state.scenario?.enemies?.[code] || {}
const isPursuitSerpent = (state, code) => hasTrait(pursuitDefinitionOf(state, code), 'Serpent')
const pursuitFightOf = (state, code) => Number(pursuitDefinitionOf(state, code).fight || 0)

// 第 115 轮：荒莽密林（失落时代第一章）的共用读点。
// 中毒判定与章节 behavior 同口径（04102 中毒弱点，或引擎标记 poisoned）。
const isPoisonedInvestigator = inv => (inv?.threat || []).some(card => originalOf(card) === '04102')
  || inv?.poisoned === true
const locationOfInvestigator = (state, inv) => (state.locations || []).find(location => location.id === inv?.location)
// 探索牌库洗混：与章节 behavior 的 mix() 同序（优先 api.shuffle，退化为 Fisher–Yates）。
function mixIntoEntry(state, api, list) {
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
function moveExperimentToward(state, experiment, target) {
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
function sealedSymbolCountInEntry(state, symbol) {
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
function locationDoomTotalInEntry(state, location) {
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
function threadActDecksInPlay(state) {
  return Object.values(state.scenarioFlags?.actDecks || {}).filter(deck => deck && !deck.completed).length
}

// 第 118 轮：调查员线索总数回写（与引擎 locations.syncClues 同口径）。
function syncCluesInEntry(state) {
  state.clues = (state.investigators || []).reduce((sum, inv) => sum + (inv.clues || 0), 0)
}

export const NON_PLAYER_ABILITY_ENTRIES = [
  // -------------------------------------------------------------------------
  // 敌人
  // -------------------------------------------------------------------------
  // “狼人”德鲁（01137）：攻击时治愈他 1 点伤害。
  // 迁移自 enemies.js 的 `enemy.code === 'wolfManDrew'` 分支（REPORT.md §2.6 / 第 2 批）。
  // 非玩家条目的 code 用运行时实体 id（关卡定义里的 key），与既有 screechingByakhee 一致。
  {
    code: 'wolfManDrew',
    name: '“狼人”德鲁',
    scope: 'enemy',
    text: '强制 - 攻击时：治愈他 1 点伤害。',
    abilities: [{
      kind: 'forced', trigger: 'enemyAttack', silent: true,
      criteria: { when: ({ source, context }) => source?.id === context?.enemy?.id },
      resolve: ({ api, source }) => api.healEnemy(source, 1),
    }],
  },
  // 年幼的深潜者（01181）：与它交战时受到 1 点恐惧。
  // 迁移自 enemies.js 的 `enemy.code === 'youngDeepOne'` 分支。
  {
    code: 'youngDeepOne',
    name: '年幼的深潜者',
    scope: 'enemy',
    text: '强制 - 与它交战时：受到 1 点恐惧。',
    abilities: [{
      kind: 'forced', trigger: 'enemyEngaged', silent: true,
      criteria: { when: ({ source, context, inv }) => source?.id === context?.enemy?.id && inv?.seat === context?.seat },
      resolve: ({ api, inv, source }) => {
        api.info(`😱 「${source.name}」交战强制：${inv.name} 受到 1 点恐惧。`)
        api.horror(inv.seat, 1)
      },
    }],
  },
  // 黑山羊眷族（01180）：被击败时，它所在地点的每位调查员受到 1 点恐惧。
  // 迁移自 enemies.js 的 `enemy.code === 'goatSpawn'` 分支；窗口在胜利区结算之前。
  {
    code: 'goatSpawn',
    name: '黑山羊眷族',
    scope: 'enemy',
    text: '强制 - 被击败时：它所在地点的每位调查员受到 1 点恐惧。',
    abilities: [{
      kind: 'forced', trigger: 'enemyDefeated', silent: true,
      criteria: { when: ({ source, context }) => source?.id === context?.enemy?.id },
      resolve: ({ api, source }) => {
        for (const inv of api.investigatorsAt(source.location)) {
          api.info(`😱 「${source.name}」的临死反噬：${inv.name} 受到 1 点恐惧。`)
          api.horror(inv.seat, 1)
        }
      },
    }],
  },
  // 坚韧的黑山羊幼崽（01179）：回合结束时治愈它 2 点伤害。
  // 迁移自 turn.js 的 `enemy.code === 'relentlessDarkYoung'` 分支。
  {
    code: 'relentlessDarkYoung',
    name: '坚韧的黑山羊幼崽',
    scope: 'enemy',
    text: '强制 - 回合结束时：治愈它 2 点伤害。',
    abilities: [{
      kind: 'forced', trigger: 'enemyRoundEnd', silent: true,
      criteria: { when: ({ source, context }) => source?.id === context?.enemy?.id },
      resolve: ({ api, source }) => {
        api.healEnemy(source, 2)
        api.info(`💉 「${source.name}」治愈 2 点伤害。`)
      },
    }],
  },
  // -------------------------------------------------------------------------
  // 敌人卡面的特殊规则（原 card-rules.js 的 ENEMY_RULE_FLAGS，REPORT.md 第 3 批）
  // -------------------------------------------------------------------------
  // 猎手夜魇（01172 / huntingNightgaunt）：负面标记双倍结算。
  { code: '01172', name: '猎手夜魇', scope: 'enemy', text: '负面标记双倍结算。', enemyRule: { doubleNegative: true } },
  { code: 'huntingNightgaunt', name: '猎手夜魇', scope: 'enemy', text: '负面标记双倍结算。', enemyRule: { doubleNegative: true } },
  // 02094：用远程/枪械/法术武器攻击它时难度 -3。
  { code: '02094', name: '02094', scope: 'enemy', text: '用远程、枪械或法术武器攻击它时难度 -3。', enemyRule: { rangedAttackDifficultyReduction: 3 , prey: 'lowestIntellect'} },
  // 02182：与它交战期间不能移动。
  { code: '02182', name: '02182', scope: 'enemy', text: '与它交战期间不能移动。', enemyRule: { blocksMovementWhileEngaged: true } },
  // 02103：用近战武器攻击它时，武器被摧毁。
  { code: '02103', name: '02103', scope: 'enemy', text: '用近战武器攻击它时，武器被摧毁。', enemyRule: { destroysMeleeWeapon: true , prey: 'lowestWillpower'} },
  // 01177 / yithianObserver：攻击时随机弃 1 张手牌。
  { code: '01177', name: '伊斯观察者', scope: 'enemy', text: '攻击时随机弃 1 张手牌；无手牌则伤害与恐惧各 +1。', enemyRule: { discardRandomOnAttack: true } },
  { code: 'yithianObserver', name: '伊斯观察者', scope: 'enemy', text: '攻击时随机弃 1 张手牌；无手牌则伤害与恐惧各 +1。', enemyRule: { discardRandomOnAttack: true } },
  // 尖叫的拜亚基：与你交战时，若你剩余神智 ≤ 4，它的战斗/躲避 +1。
  // 迁移自 engine.js 的 `enemy.code === 'screechingByakhee'` 分支（Phase 3 D1）。
  {
    code: 'screechingByakhee',
    name: '尖叫的拜亚基',
    scope: 'enemy',
    text: '与你交战时，若你的剩余神智不超过 4，它的战斗与躲避 +1。',
    modifiers: [
      {
        target: 'enemyFight', amount: 1,
        condition: { when: ({ state, entity, helpers }) => entity.engagedSeat != null
          && helpers.remainingSanity(state.investigators[entity.engagedSeat]) <= 4 },
      },
      {
        target: 'enemyEvade', amount: 1,
        condition: { when: ({ state, entity, helpers }) => entity.engagedSeat != null
          && helpers.remainingSanity(state.investigators[entity.engagedSeat]) <= 4 },
      },
    ],
  },
  // 埃兹特里的守卫者（04086）：04048「搜索遗迹」时不能攻击也不能被攻击；
  // 04049「守备森严的遗迹」时战斗与躲避 +1。
  // 迁移自 theUntamedWilds 的 enemyCannotAttack / enemyCannotBeAttacked / enemyStatModifier。
  {
    code: '04086', implemented: true,
    name: '埃兹特里的守卫者',
    scope: 'enemy',
    text: '搜索遗迹时不能攻击也不能被攻击；守备森严的遗迹时战斗与躲避 +1。',
    enemyRule: { spawnAnyEmpty: true }, spawnAncientFirst: true,
    modifiers: [
      { target: 'cannot:attack', condition: { when: ({ state }) => actThreeIs(state, 'search') } },
      { target: 'cannot:beAttacked', condition: { when: ({ state }) => actThreeIs(state, 'search') } },
      { target: 'enemyFight', amount: 1, condition: { when: ({ state }) => actThreeIs(state, 'guarded') } },
      { target: 'enemyEvade', amount: 1, condition: { when: ({ state }) => actThreeIs(state, 'guarded') } },
    ],
  },
  // 羽翼蛇族（04209b）：不能被击败，也不发动借机攻击。
  // 关卡定义里的实例字段（cannotBeDefeated/noOpportunityAttack）仍在；
  // 这里给出卡面声明，使同一张卡在别的章节生成时也遵守同一规则。
  {
    code: '04209b',
    name: '羽翼蛇族',
    scope: 'enemy',
    text: '不能被击败。不发动借机攻击。',
    modifiers: [
      { target: 'cannot:beDefeated' },
      { target: 'cannot:opportunityAttack' },
    ],
  },
  // 兄弟会教徒（04095）：它身上每有 1 个毁灭标记，战斗与躲避 +1。
  // 迁移自 theForgottenAge/encounter-rules.js 的 enemyStatModifier 分支。
  {
    code: '04095', implemented: true,
    name: '兄弟会教徒',
    scope: 'enemy',
    text: '它身上每有 1 个毁灭标记，它的战斗与躲避 +1。对你发动攻击时放置 1 个毁灭。',
    enemyRule: { doomOnAttacked: 1 },
    modifiers: [
      { target: 'enemyFight', amount: ({ entity }) => entity.doom || 0 },
      { target: 'enemyEvade', amount: ({ entity }) => entity.doom || 0 },
    ],
  },
  // 蟑螂群（03103）：战斗值等于所在地点的帷幕（含帷幕修正）。
  // 迁移自 thePathToCarcosa/encounter-rules.js 的 enemyStatModifier 分支。
  {
    code: '03103', implemented: true,
    name: '蟑螂群',
    scope: 'enemy',
    text: '它的战斗值等于所在地点的帷幕（含帷幕修正）。',
    modifiers: [{
      target: 'enemyFight',
      amount: ({ state, entity }) => {
        const location = (state.locations || []).find(candidate => candidate.id === entity.location)
        return (location?.shroud || 0) + (location?.shroudMod || 0) - (entity.fight || 0)
      },
    }],
  },
  // 潜行的拜亚基（03222）：横置时战斗 -3。
  {
    code: '03222', implemented: true,
    name: '潜行的拜亚基',
    scope: 'enemy',
    text: '它横置时战斗 -3。',
    modifiers: [{
      target: 'enemyFight', amount: -3,
      condition: { when: ({ entity }) => entity.exhausted === true },
    }],
  },
  // 哈斯塔的傀儡（03096）：调查阶段，它的战斗值获得本轮累积的傀儡加值。
  {
    code: '03096', implemented: true,
    name: '哈斯塔的傀儡',
    scope: 'enemy',
    text: '调查阶段，它的战斗值获得本轮累积的加值。',
    modifiers: [{
      target: 'enemyFight',
      amount: ({ state, entity }) => (state.phase === 'investigation'
        ? (entity.puppetFightBonuses || [])
          .filter(bonus => bonus.investigationRound === state.round)
          .reduce((sum, bonus) => sum + bonus.amount, 0)
        : 0),
    }],
    enemyScript: {
      onEngage(state, enemy, inv, api) {
        const choice = api.choose({
          kind: 'encounter', source: '03096', seat: inv.seat,
          prompt: '哈斯塔的傀儡与你交战：选择承受1点恐惧，或令其本调查阶段战斗+3。',
          options: [{ id: 'horror', label: '承受1点恐惧' }, { id: 'fight', label: '本调查阶段战斗+3' }],
        })
        if (choice === 'horror') api.horror(inv.seat, 1)
        else {
          const investigationRound = ['enemy', 'upkeep'].includes(state.phase) ? state.round + 1 : state.round
          enemy.puppetFightBonuses ||= []
          enemy.puppetFightBonuses.push({ amount: 3, investigationRound })
        }
      },
    },
  },
  // -------------------------------------------------------------------------
  // 地点
  // -------------------------------------------------------------------------
  // 万蛇据点（04072）：此处的每个蛇族敌人战斗 +1。
  // 迁移自 theUntamedWilds / heartOfTheEldersPart1 的 enemyStatModifier 分支。
  {
    code: '04072',
    name: '万蛇据点',
    scope: 'location',
    text: '此处的每个[[蛇族]]敌人战斗 +1。强制 - 在你在万蛇据点调查或探索后，如果你已中毒：受到 1 点伤害。',
    modifiers: [{
      target: 'enemyFight', amount: 1,
      condition: { when: ({ entity }) => hasTrait(entity, 'Serpent') },
    }],
    // 第 115 轮：调查/探索后的中毒伤害从 theUntamedWilds 的 behavior 分支迁来。
    locationRule: {
      afterExplore({ inv, api }) {
        if (isPoisonedInvestigator(inv)) api.damage(inv.seat, 1)
      },
      afterTest({ inv, result, api }) {
        if (result.source?.label !== '调查' || !isPoisonedInvestigator(inv)) return
        api.damage(inv.seat, 1)
      },
    },
  },
  // 毒牙神庙（04074）：胜利区每有 1 点复仇点数，此处帷幕 +1。
  // 迁移自 theUntamedWilds / heartOfTheEldersPart1 的 locationShroudModifier 分支。
  {
    code: '04074',
    name: '毒牙神庙',
    scope: 'location',
    text: '胜利区每有 1 点复仇点数，此处帷幕 +1。',
    modifiers: [{
      target: 'locationShroud',
      amount: ({ state }) => victoryVengeance(state),
    }],
  },
  // 墓地（01133）：进入后意志(3)检定，失败二选一「受到 2 点恐惧 / 移动到河岸城」。
  // 迁移自 movement.js 的 `loc.id === 'graveyard'` 分支（REPORT.md §2.1）。
  {
    code: '01133',
    name: '墓地',
    scope: 'location',
    text: '强制 - 你进入墓地后：意志（3）检定，失败须受到 2 点恐惧或移动到河岸城。',
    locationRule: {
      onEnter: {
        test: { skill: 'willpower', difficulty: 3 },
        failChoice: {
          prompt: '墓地检定失败：选择受到 2 点恐惧或移动到河岸城。',
          options: [
            { id: 'horror', label: '受到 2 点恐惧', log: '😱 「墓地」检定失败：{name} 受到 2 点恐惧。', effect: { type: 'takeHorror', amount: 2, silent: true } },
            { id: 'move', label: '移动到河岸城', requiresLocation: 'rivertown', effect: { type: 'moveInvestigator', destination: 'rivertown' } },
          ],
        },
      },
    },
  },
  // 扭曲的道路（01151）：离开时智力(3)检定，失败取消本次移动。
  // 迁移自 movement.js 的 `prevLoc.id === 'twistingPaths'` 分支（REPORT.md §2.1）。
  {
    code: '01151',
    name: '阿卡姆密林 · 扭曲的道路',
    scope: 'location',
    text: '强制 - 离开时：智力（3）检定，失败取消本次移动。',
    locationRule: {
      onLeave: { test: { skill: 'intellect', difficulty: 3 }, cancelMessage: '🌀 「扭曲的道路」：{name} 迷路了，移动被取消。' },
    },
  },
  // 仪式地（01156）：回合结束时线索补至调查员人数的 2 倍。
  {
    code: '01156',
    name: '仪式地',
    scope: 'location',
    text: '强制 - 回合结束时，若线索少于调查员人数的 2 倍，补至 2 倍。',
    locationRule: { onRoundEnd: { cluesPerInvestigator: 2 } },
  },
  // 假面猎手（01121b）：交战时不能发现或花费线索。
  {
    code: '01121b',
    name: '假面猎手',
    scope: 'enemy',
    text: '你与假面猎手交战时，不能发现或花费线索。',
    enemyRule: { blocksCluesWhileEngaged: true, blocksCluesMessage: '蒙面猎手' },
  },
  // 东城区（01132）：在此地打出盟友支援费用 -2。
  {
    code: '01132',
    name: '东城区',
    scope: 'location',
    text: '你位于东城区时，你打出每张盟友支援的费用 -2。',
    locationRule: { playDiscount: { cardType: 'asset', trait: 'ally', amount: 2 } },
  },
  // -------------------------------------------------------------------------
  // 诡计
  // -------------------------------------------------------------------------
  // 错误指示（01136）：没有线索时获得涌动。
  // 迁移自 treachery-tokens.js 的 `t.code === 'falseLead'` 分支；标记放条目，不写关卡定义（避免改 state 指纹）。
  {
    code: 'falseLead',
    name: '错误指示',
    scope: 'treachery',
    text: '显现 - 如果你没有线索，错误指示获得涌动。否则智力（4）检定，每低于难度 1 点，将你的 1 个线索放到所在地点。',
    surgeIfNoClues: true,
  },
  // 乘着黑暗之翼（01169?）：失败惩罚的 kind 在卡面数据里是卡名，这里映射成通用 kind。
  // 引擎的 applyPenalty 不再认识具体卡名。
  {
    code: 'onWingsOfDarkness',
    name: '乘着黑暗之翼',
    scope: 'treachery',
    text: '显现 - 敏捷（4）检定。失败受到 1 点伤害与 1 点恐惧，与每个非夜魇敌人解除交战，并被带到中心地点。',
    penaltyKind: 'damageHorrorDisengageAndMoveCentral',
  },
  // -------------------------------------------------------------------------
  // 卡号级规则（原 card-rules.js，REPORT.md 第 3 批）
  // -------------------------------------------------------------------------
  // 不洁之地（02088）：使调查员身上的盟友文本空白，显现时放进威胁区。
  {
    code: '02088', implemented: true, name: '不洁之地', scope: 'treachery',
    text: '你控制的所有盟友的文本被视为空白。', blanksTraits: ['ally'],
    // 回合结束意志（3）检定：引擎 runThreatEndTurn 统一结算，内容层不再逐卡循环。
    threatEffect: { endTurnTest: { skill: 'willpower', difficulty: 3 }, cannotPlayAllies: true, blanksAllies: true },
    encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      api.threat(inv.seat, card.originalCode || card.code)
      return true
    },
  },
  // 中毒（04102）：一张会进入牌组的威胁；战役补给可花 XP 移除。
  // 第 123 轮：`poisonWeakness` 让 src/campaign/campaign-effects.js 不再写死这个卡号。
  {
    code: '04102', implemented: true, name: '中毒', scope: 'treachery', text: '中毒弱点。', poisonThreat: true,
    poisonWeakness: true, flags: { poisoned: true }, treacheryRule: { permanent: true },
    encounterResolve(state, inv, card, api) {
      api.poison(inv.seat)
      return false
    },
  },
  // 死寂之夜（02043）：整理阶段手牌上限 -3。
  { code: '02043', name: '死寂之夜', scope: 'agenda', text: '整理阶段你的手牌上限 -3。', agendaHandSizePenalty: 3,
    // 第 115 轮：密谋二的显现（放置宿舍、移动实验体或生成实验体）从课外活动的 behavior 迁来。
    agendaRule: {
      onReveal(state, agenda, api) {
        api.place('dormitories')
        const experiment = state.enemies.find(enemy => nonPlayerEntryFor(originalOf(enemy))?.enemyScript?.experiment)
        if (!experiment) { api.spawn('02058', 'scienceBuilding'); return }
        moveExperimentToward(state, experiment, 'dormitories')
      },
    } },
  // 奥恩图书馆（02050）：在此调查额外花 1 行动。
  { code: '02050', name: '奥恩图书馆', scope: 'location', text: '在此地点调查额外花费 1 行动。', investigateExtraActions: 1 },
  // 忍气吞声（02089）：地点离场时按计数器把这张遭遇卡放回遭遇弃牌堆。
  {
    code: '02089', implemented: true, name: '忍气吞声', scope: 'treachery', text: '地点计数器型障碍。',
    locationCounter: 'sordidAndSilent',
    encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv) {
      const location = state.locations.find(item => item.id === inv.location)
      location.sordidAndSilent = (location.sordidAndSilent || 0) + 1
      return true
    },
  },
  // 02219 伊本巴奇之粉末：剧情资产，允许从战役牌组打出（第 60 轮）。
  {
    code: '02219', scope: 'storyAsset',
    assetRule: { powder: true }, name: '伊本巴奇之粉末', scenarioPlayable: true,
    cluesFromSurvivors: ['drHenryArmitage', 'professorWarrenRice', 'drFrancisMorgan', 'zebulonWhateley', 'earlSawyer'],
  },
  // 珍品店（04142）：位于此处时打出遗物支援费用 -2。
  { code: '04142', name: '珍品店', scope: 'location', text: '位于此处时打出 [[遗物]] 支援的费用 -2。', relicDiscountLocation: true },
  // 另一个次元（02320）：地点被移出游戏时的默认去向。
  { code: '02320', name: '另一个次元', scope: 'location', text: '地点被移出游戏时的默认去向。', relocateDestination: true },
  // 彼端的世界（04318）：没有可生成地点时，翻探索牌库放一个地点。
  {
    code: '04318', name: '彼端的世界', scope: 'act', text: '敌人没有可生成地点时，翻探索牌库直到地点。',
    placesLocationForEmptySpawn: true,
    // 第 116 轮：背面（把放在一边的时间之窗洗入探索牌库）从章节 behavior 迁来。
    actRule: {
      onReveal(state, act, api, hooks) {
        const pocket = hooks.pocket()
        hooks.removeSetAsideLocation(pocket)
        if (!(state.explorationDeck || []).includes(pocket)) {
          state.explorationDeck = [...(state.explorationDeck || []), pocket]
          state.scenarioFlags.pocketInDeck = true
        }
        hooks.shuffleInPlace()
        api.info?.('🕳️ 时间之窗被洗入探索牌库。')
      },
    },
  },
  // 苍白面具下的男子（03059）：被击败时推进战役记录。
  {
    code: '03059', name: '苍白面具下的男子', scope: 'enemy', text: '生成 - 距离所有调查员最远的地点。', pallidMask: true,
    spawnFarthestFromAll: true,
    enemyScript: {
      pallidMask: true,
      encounterAction(state, inv, enemy) {
        return {
          action: 'encounterAction', actionKind: 'investigate', rule: 'investigatePallidMask',
          enemyId: enemy.id, actions: 1, label: '调查苍白面具下的男子（本地点帷幕+2）',
        }
      },
    },
  },
  // 奥术屏障（02102）：地点计数器型障碍。引擎按 `locationBarrier.counter` 找规则，
  // 检定难度、取消/继续选项与「弃牌库顶 N 张」都由这张卡声明（REPORT.md §9 第 1 批）。
  {
    code: '02102', implemented: true,
    name: '奥术屏障',
    scope: 'treachery',
    text: '放置到当前地点。离开/进入带此障碍的地点时，意志(4)检定；失败可以取消移动，或弃掉牌库顶 5 张牌继续。',
    locationCounter: 'arcaneBarriers',
    locationBarrier: {
      counter: 'arcaneBarriers',
      label: '奥术屏障',
      test: { skill: 'willpower', difficulty: 4 },
      prompt: '奥术屏障：取消移动，或弃掉牌库顶 5 张牌继续移动。',
      options: [
        { id: 'cancel', label: '取消移动' },
        { id: 'mill', label: '弃掉 5 张牌继续移动', mill: 5 },
      ],
    },
    encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const location = state.locations.find(item => item.id === inv.location)
      location.arcaneBarriers = (location.arcaneBarriers || 0) + 1
      return true
    },
  },
  // 第 7 批：从 content/campaigns/thePathToCarcosa/card-data.js 的三张表搬来的卡面规则。
  // 隐藏卡（03084a–d / 03186 / 03187 / 03340–03342）。
  { code: '03084a', implemented: true, scope: 'treachery', hiddenRule: { cannotCommitTypes: ['skill'], discard: { actions: 2 } } },
  { code: '03084b', implemented: true, scope: 'treachery', hiddenRule: { maxMovesPerTurn: 1, discard: { actions: 2 } } },
  { code: '03084c', implemented: true, scope: 'treachery', hiddenRule: { cannotTriggerFree: true, discard: { actions: 2 } } },
  { code: '03084d', implemented: true, scope: 'treachery', hiddenRule: { cannotPlayTypes: ['event'], discard: { actions: 2 } } },
  { code: '03186', scope: 'treachery', encounterResolveCampaigns: ['carcosa'], hiddenRule: { cannotFightTraits: ['Lunatic'] },
    encounterResolve(state, inv) { inv.hand.push('03186'); inv.hiddenCards ||= []; inv.hiddenCards.push('03186'); return true } },
  { code: '03187', scope: 'treachery', encounterResolveCampaigns: ['carcosa'], hiddenRule: { cannotTriggerLocationAbilities: true },
    encounterResolve(state, inv) { inv.hand.push('03187'); inv.hiddenCards ||= []; inv.hiddenCards.push('03187'); return true } },
  { code: '03340', scope: 'treachery', hiddenRule: { allowCommit: true, autoFailOnCommit: true, killAtHorrorOverSanityMultiplier: 2 } },
  { code: '03341', scope: 'treachery', hiddenRule: { killAtHorrorOverSanityMultiplier: 2, discard: { actions: 1, resources: 5 } } },
  { code: '03342', scope: 'treachery', hiddenRule: { killAtHorrorOverSanityMultiplier: 2, discard: { actions: 1, damageInvestigator: 2 } } },
  // 威胁区卡（03225 / 03226）。
  {
    code: '03225', implemented: true, scope: 'treachery', threatEffect: { playCostIncrease: 1, consumeResourceAfterPlay: true },
    encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      let placed = false
      api.test(inv.seat, 'willpower', 5, result => {
        if (result.success) return
        api.threat(inv.seat, '03225', {
          resources: Math.max(1, result.difficulty - result.value),
          threatEffect: { playCostIncrease: 1, consumeResourceAfterPlay: true },
        })
        placed = true
      })
      return placed
    },
  },
  {
    code: '03226', implemented: true, scope: 'treachery', threatEffect: { extraActionCost: ['move', 'fight', 'evade'], endTurnTest: { skill: 'willpower', difficulty: 3 } },
    encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      api.threat(inv.seat, '03226', {
        threatEffect: { extraActionCost: ['move', 'fight', 'evade'], endTurnTest: { skill: 'willpower', difficulty: 3 } },
      })
      return true
    },
  },
  // 敌人猎物规则（03086 / 03089 / 03099）。
  {
    code: '03086', implemented: true, scope: 'enemy', enemyRule: { prey: 'lowestSanity' },
    enemyScript: {
      onHunterMove(state, enemy, api) {
        let moved = 0
        const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        if (!active.length) return true
        const remainingSanity = inv => (inv.sanity || 0)
          + (inv.assets || []).reduce((sum, asset) => sum + (ALL_CARDS[asset.code]?.sanity || 0), 0)
          - (inv.horror || 0)
        const prey = active.reduce((best, inv) => remainingSanity(inv) < remainingSanity(best) ? inv : best)
        while (enemy.location !== prey.location) {
          const next = api.hunterStep(enemy, { targets: [prey] })
          if (!next || next === enemy.location) break
          api.moveEnemy(enemy, next)
          moved++
        }
        if (moved > 1) enemy.skipAttackRound = state.round
        return true
      },
    },
  },
  {
    code: '03089', implemented: true, scope: 'enemy', enemyRule: { prey: 'mostHorror' },
    enemyScript: {
      onEvade(state, inv, enemy, result, api) {
        if (result?.success && result.value - result.difficulty <= 2) api.horror(inv.seat, 1)
      },
    },
  },
  {
    code: '03099', implemented: true, scope: 'enemy', enemyRule: { prey: 'mostClues' },
    enemyScript: {
      onAttackResolved(state, enemy, inv, api) {
        if (inv.clues < 1) return
        api.spendClues(inv.seat, 1)
        enemy.clues = (enemy.clues || 0) + 1
      },
      onDefeated(state, enemy, api) {
        if (!enemy.clues) return false
        const inv = state.investigators[enemy.defeatedBy]
        if (inv) api.gainClues(inv.seat, enemy.clues)
        enemy.clues = 0
        return false
      },
    },
  },
  // 第 7 批：从 content/campaigns/theForgottenAge/card-data.js 的两张表搬来的卡面规则。
  { code: '04052', scope: 'enemy', enemyRule: {"parley":{"skill":"intellect","difficulty":4}} },
  {
    code: '04062', scope: 'enemy', enemyRule: { healthPerInvestigator: 10, vengeance: 5, retaliateWhileExhausted: true },
    enemyScript: {
      onSpawn(state, enemy) { harbingerSpawn(state, enemy) },
      onAttackSuccess(state, inv, enemy, api) { harbingerAfterSuccessfulTest(state, enemy, api) },
      onEvade(state, inv, enemy, result, api) {
        if (result?.success !== false) harbingerAfterSuccessfulTest(state, enemy, api)
      },
    },
  },
  {
    code: '04078', implemented: true, scope: 'enemy', enemyRule: { prey: 'poisoned', vengeance: 1 },
    enemyScript: {
      onAttackResolved(state, enemy, inv, api, attack) {
        if ((attack ? attack.damage > 0 : true) && !api.isPoisoned?.(inv.seat)) api.poison(inv.seat)
      },
    },
  },
  {
    code: '04079', implemented: true, scope: 'enemy', enemyRule: { vengeance: 2 },
    enemyScript: { onAttackResolved(state, enemy, inv) { inv.tfaNoReadyRound = state.round } },
  },
  { code: '04084', implemented: true, scope: 'enemy', enemyRule: {"victory":1}, enemySpawnRule: { vengeanceThresholds: { retaliate: 1, hunter: 2, damageReduction: 3 } } },
  // 第 7 批：核心遭遇卡在失落时代牌堆里的显现规则（原来写在 TFA encounter-rules.js）。
  {
    code: '01170', implemented: true, scope: 'enemy', enemyRule: { retaliate: true, spawnAnyEmpty: true, mythosEndDoom: 1 },
    encounterResolveCampaigns: ['tfa'],
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      const active = state.investigators.filter(entry => !entry.defeated && !entry.resigned)
      const empty = state.locations.filter(entry => !active.some(owner => owner.location === entry.id))
      if (!empty.length) { api.drawEncounter(inv.seat); return false }
      const target = empty.length === 1 ? empty[0].id : api.choose({
        kind: 'target', source: code, seat: inv.seat,
        prompt: '密会巫师：选择生成它的无人地点。',
        options: empty.map(entry => ({ id: entry.id, label: entry.name })),
      })
      api.spawn(code, empty.some(entry => entry.id === target) ? target : empty[0].id)
      return false
    },
  },
  { code: '04259', scope: 'enemy', enemyRule: {"prey":"mostHand"} },
  { code: '04122b', scope: 'enemy', enemyRule: {"victory":1},
    // 第 118 轮：生成时接管古代遗物（命运之线的剧情敌人）。
    enemyScript: {
      onSpawn(state, enemy, api) {
        if (state.relicOfAges?.enemyId === enemy.id) return
        state.relicOfAges = { code: '04061', location: enemy.location, enemyId: enemy.id }
        const name = (state.locations || []).find(entry => entry.id === enemy.location)?.name || enemy.location
        api?.info?.(`🏺 古代遗物附属到敌人（「${name}」）。`)
      },
    } },
  { code: '04130b', scope: 'enemy', enemyRule: {"victory":1},
    // 第 118 轮：生成时被敌人带走。
    enemyScript: {
      onSpawn(state, enemy, api) {
        if (state.scenarioFlags?.alejandro?.enemyId === enemy.id) return
        state.scenarioFlags ||= {}
        state.scenarioFlags.alejandro = { code: '04051', location: enemy.location, enemyId: enemy.id }
        api?.info?.('🧭 亚历山卓·维拉被敌人带走。')
      },
    } },
  { code: '04137b', scope: 'enemy', enemyRule: {"victory":1},
    // 第 118 轮：生成时成为伊塔卡的猎物。
    enemyScript: {
      onSpawn(state, enemy) {
        const flags = (state.scenarioFlags ||= {})
        flags.ichtacasPrey ||= []
        if (!flags.ichtacasPrey.includes(enemy.id)) flags.ichtacasPrey.push(enemy.id)
      },
    } },
  { code: '04186', scope: 'enemy', enemyRule: {"victory":2,"vengeance":2} },
  { code: '04187', scope: 'enemy', enemyRule: {"victory":1,"vengeance":1} },
  { code: '04219', scope: 'enemy', enemyRule: {"victory":1} },
  { code: '04220', scope: 'enemy', enemyRule: {"vengeance":2, "prey":"nearestMouth"} },
  { code: '04296', scope: 'enemy', enemyRule: {"victory":5} },
  { code: '04337', scope: 'enemy', enemyRule: {"immobile":true} },
  { code: '04297', scope: 'enemy', enemyRule: {"vengeance":1} },
  { code: '04298', scope: 'enemy', enemyRule: {"victory":2} },
  {
    code: '04094', implemented: true, scope: 'treachery', treacheryRule: {"sideArea":true},
    encounterResolve(state, inv, card, api) {
      state.scenarioFlags ||= {}
      state.scenarioFlags.deepDark = Number(state.scenarioFlags.deepDark || 0) + 1
      state.scenarioFlags.deepDarkClaims = {}
      api.info?.('一片漆黑开始生效：每位调查员每轮从单个地点最多发现 1 个线索。')
      return true
    },
  },
  {
    code: '04089', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true},
    threatAction: { rule: 'escapeEntombed', label: '逃出墓穴', skills: ['agility', 'combat'], difficulty: 4, target: 'threat', skillLabels: { agility: '检定敏捷(4)逃出墓穴', combat: '检定战斗(4)逃出墓穴' } },
    encounterResolve(state, inv, card, api) {
      if ((inv.threat || []).some(item => originalOf(item) === '04089')) {
        api.drawEncounter(inv.seat)
        return false
      }
      api.threat(inv.seat, '04089', { noMove: true, noDisengage: true })
      return true
    },
  },
  {
    code: '04097', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true},
    threatAction: { rule: 'discardWordsOfPower', label: '花 2 个行动弃掉力量真言', actions: 2, target: 'threat', noTest: true },
    encounterResolve(state, inv, card, api) {
      if ((inv.threat || []).some(item => originalOf(item) === '04097')) {
        api.drawEncounter(inv.seat)
        return false
      }
      api.threat(inv.seat, '04097', { blockDoomEnemyDamage: true, blockCluesHere: true })
      return true
    },
  },
  {
    code: '04099', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true},
    encounterResolve(state, inv, card, api) {
      if ((inv.threat || []).some(item => originalOf(item) === '04099')) {
        api.drawEncounter(inv.seat)
        return false
      }
      const poisoned = (inv.threat || []).some(item => originalOf(item) === '04102') || inv.poisoned === true
      api.threat(inv.seat, '04099', { blankItemAssets: true, forcedRoundEndDiscard: true })
      if (poisoned) api.drawEncounter(inv.seat)
      return true
    },
  },
  {
    code: '04077', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true},
    threatAction: { rule: 'endVoiceOfTheJungle', label: '检定意志(3)驱散丛林之声', skills: ['willpower'], difficulty: 3, target: 'threat' },
    encounterResolve(state, inv, card, api) {
      if ((inv.threat || []).some(item => originalOf(item) === '04077')) {
        api.drawEncounter(inv.seat)
        return false
      }
      api.threat(inv.seat, '04077', { forcedEndTurnHorror: 1 })
      return true
    },
  },
  {
    code: '04085', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true},
    threatAction: { rule: 'endCurseOfYig', label: '检定意志(2+复仇)摆脱伊格的诅咒', skills: ['willpower'], difficulty: 2, target: 'threat', vengeance: true },
    encounterResolve(state, inv, card, api) {
      if ((inv.threat || []).some(item => originalOf(item) === '04085')) {
        api.drawEncounter(inv.seat)
        return false
      }
      api.threat(inv.seat, '04085', {
        threatEffect: { statModifiers: { combat: -1 }, healthModifier: -1 },
        grantedTrait: 'Serpent',
      })
      inv.traits = [...new Set([...(inv.traits || []), 'Serpent'])]
      return true
    },
  },
  { code: '04189', scope: 'treachery', treacheryRule: {"threatArea":true} },
  { code: '04190', scope: 'treachery', treacheryRule: {"threatArea":true} },
  {
    code: '04214', scope: 'treachery', treacheryRule: { threatArea: true },
    // 第 120 轮：同一卡号既是遭遇卡又是幕卡；能力层一个卡号只能注册一个条目，
    // 所以幕的结算规则也挂在这个条目上（引擎只对幕读 actRuleFor，两边互不干扰）。
    actRule: {
      onReveal(state, act, api) {
        api.finish(state.campaign?.records?.theInvestigatorsRescuedAlejandro ? 'r1' : 'r2')
      },
    },
  },
  { code: '04261', scope: 'treachery', treacheryRule: {"threatArea":true,"threat":{"noDrawAction":true},"surge":false} },
  {
    code: '01164', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true,"threat":{"extraActionCost":["move","fight","evade"],"endTurnTest":{"skill":"willpower","difficulty":3}}},
    encounterResolve(state, inv, card, api) {
      if ((inv.threat || []).some(item => originalOf(item) === '01164')) { api.drawEncounter(inv.seat); return false }
      api.threat(inv.seat, '01164')
      return true
    },
  },
  {
    code: '01165', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true,"threat":{"cannotPlay":["asset","event"],"roundEndDiscard":true}},
    encounterResolve(state, inv, card, api) {
      if ((inv.threat || []).some(item => originalOf(item) === '01165')) { api.drawEncounter(inv.seat); return false }
      api.threat(inv.seat, '01165')
      return true
    },
  },
  // 第 7 批：从 content/campaigns/theDunwichLegacy/card-data.js 的逐卡分支搬来的规则。
  {
    code: '02092', scope: 'treachery', threatEffect: { mods: { allSkills: -1 } }, implemented: true, flags: { afterTestDiscard: true },
    encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      api.threat(inv.seat, card.originalCode || card.code)
      return true
    },
  },
  { code:"02058",scope:"enemy",enemyRule:{healthPerPlayerBonus:3},enemyScript:{experiment:true,onPhaseStart(state,enemy){ enemy.exhausted=false }}},
  {
    code: '02323', scope: 'enemy', enemyRule: { healthPerPlayerBonus: 6, cannotEvade: true, cannotOpportunityAttack: true },
    // 第 114 轮：跨卡身份查询（dunwich-chaos 的石板标记）用条目标志，不再写死卡号。
    flags: { yogSothoth: true },
    enemyScript: {
      onDefeated(state, enemy, api) {
        if (state.scenario?.id === 'lostInTimeAndSpace'
          && originalOf(state.agendas[state.agendaIndex] || {}) === '02315') api.finish('r3')
      },
    },
  },
  { code:"02087",scope:"enemy",enemyRule:{prey:"fewestHand"},enemyScript:{wizard:true}},
  { code:"02078",scope:"enemy",enemyRule:{prey:"highestIntellect"},flags:{pitBoss:true}},
  {
    code: '02104', scope: 'enemy', enemyRule: { prey: 'lowestAgility' },
    enemyScript: { onAttackStarted(state, enemy, inv, api) { api.discardTop(inv.seat, 2) } },
  },
  { code:"02095",scope:"enemy",enemyRule:{prey:"lowestAgility"},enemySpawnRule:{spawnMode:"farthest"}},
  { code: '02086', scope: 'enemy', enemySpawnRule: { spawnMode: 'mostClues' } },
  {
    code: '02224', scope: 'enemy', enemySpawnRule: { spawnMode: 'empty' },
    enemyScript: {
      onDefeated(state, enemy, api) {
        const locations = state.locations.filter(loc => loc.clues > 0)
        if (!locations.length) return
        const seat = enemy.defeatedBy ?? state.campaign.leadSeat
        const chosen = api.choose({ kind: 'location', source: '02224', seat,
          prompt: '（可选）选择任意一个有线索的地点，发现 1 个线索。',
          options: [{ id: 'skip', label: '不发现线索' }, ...locations.map(loc => ({ id: loc.id, label: loc.name }))] })
        if (chosen === 'skip') return
        const location = locations.find(item => item.id === chosen)
        if (location) { location.clues--; api.gainClues(seat, 1) }
      },
    },
  },
  {
    code: '02183', scope: 'enemy', enemySpawnRule: { spawnMode: 'nextTrain' },
    enemyScript: { onSpawn(state, enemy) { enemy.exhausted = true } },
  },
  {
    code: '02294', scope: 'enemy', enemyRule: { alteredHerald: true },
    enemySpawnRule: { spawnMode: 'original', spawnFrom: '02282' },
  },
  {
    code: '02295', scope: 'enemy', enemySpawnRule: { spawnMode: 'nearestAltered' },
    enemyScript: {
      onAttackResolved(state, enemy, inv) {
        if (inv.defeated) state.campaign.investigators[inv.seat].status = 'killed'
      },
    },
  },
  {
    code: '02329', scope: 'enemy', enemySpawnRule: { spawnMode: 'extradimensional' },
    enemyScript: {
      onSpawn(state, enemy) { starlightTravelerEnters(state, enemy) },
      onMove(state, enemy) { starlightTravelerEnters(state, enemy) },
    },
  },
  {
    code: '02330', scope: 'enemy', enemySpawnRule: { spawnMode: 'original', spawnFrom: '02320' },
    enemyScript: {
      onAttackStarted(state, enemy, inv) {
        if (inv.discard.length > 10) enemy.doom = (enemy.doom || 0) + 1
      },
    },
  },
  {
    code: '02098', scope: 'enemy',
    enemyScript: {
      onAttackResolved(state, enemy, inv) {
        if (enemy.textBlanked && enemy.textBlanked.round === state.round && enemy.textBlanked.phase === state.phase) return
        inv.resources = Math.max(0, inv.resources - 1)
      },
    },
  },
  // 第 7 批：课外活动（敦威治第一章）的幕/密谋/地点/敌人脚本从 behavior.js 搬来。
  {
    code: '02045', scope: 'act',
    actRule: { onReveal(state, act, api) { state.encounterDeck.push('02060'); api.shuffleDiscard() } },
  },
  {
    code: '02046', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        api.place('alchemyLabs')
        if (state.agendaIndex < 2 && !state.enemies.some(enemy => enemy.code === '02058')) api.spawn('02058', 'alchemyLabs')
        const done = state.campaign.scenarioResults?.some(result => result.scenarioId === 'theHouseAlwaysWins')
        if (done) {
          state.scenarioZones.underLocations ||= {}
          state.scenarioZones.underLocations.alchemyLabs = '02059'
        } else if (!state.scenarioZones.removed?.includes('02059')) {
          state.scenarioZones.removed ||= []
          state.scenarioZones.removed.push('02059')
          state.scenarioZones.concoctionClaimed = true
        }
      },
    },
  },
  { code: '02047', scope: 'act', actRule: { onReveal(state, act, api) { api.finish('r3') } } },
  {
    code: '02042', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
          if (inv.discard.length >= 5) api.horror(inv.seat, inv.discard.length >= 10 ? 2 : 1)
        }
        const done = state.campaign.scenarioResults?.some(result => result.scenarioId === 'theHouseAlwaysWins')
        if (done) state.scenarioFlags.advanceDirectlyToAgenda = '02043'
      },
    },
  },
  {
    code: '02044', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.horror(inv.seat, 3)
        api.finish('r4')
      },
    },
  },
  {
    code: '02049', scope: 'location',
    locationRule: { onTurnEnd(state, loc, api, inv) { api.discardTop(inv.seat, inv.horror) } },
  },
  {
    code: '02053', scope: 'location',
    locationRule: { onTurnEnd(state, loc, api, inv) { api.discardTop(inv.seat, 1) } },
  },
  {
    code: '02056', scope: 'location',
    locationRule: {
      onTestFail(state, loc, api, inv, result) {
        if (result.skill === 'willpower') api.damage(inv.seat, 1)
      },
    },
  },
  // 第 63 轮：bloodOnTheAltar 的村公所 / 教堂揭示时从遭遇牌堆生成对应特性敌人。
  {
    code: '02208', scope: 'location',
    locationRule: {
      onReveal(state, loc, api) { spawnTraitEnemyAtVillage(state, loc, api, 'Humanoid') },
    },
  },
  {
    code: '02211', scope: 'location',
    locationRule: {
      onReveal(state, loc, api) { spawnTraitEnemyAtVillage(state, loc, api, 'Nightgaunt') },
    },
  },
  // 第 59 轮：敦威治后段章节的地点「检定失败」规则（entry 由 tests.js 统一派发）。
  {
    code: '02133', scope: 'location',
    locationRule: {
      onTestFail(state, loc, api, inv, result) {
        if (result.source?.label !== '调查' || !inv.assets.length) return
        const choice = api.choose({ kind: 'target', source: originalOf(loc), seat: inv.seat,
          prompt: '选择弃掉一张受你控制的支援卡。',
          options: inv.assets.map(asset => ({ id: asset.id, label: asset.name || ALL_CARDS[asset.code]?.nameZh || asset.code })) })
        api.discardAsset(inv.seat, choice)
      },
    },
  },
  {
    code: '02135', scope: 'location',
    locationRule: {
      onTestFail(state, loc, api, inv, result) {
        if (result.source?.label === '调查') inv.actionsLeft = Math.max(0, inv.actionsLeft - 1)
      },
    },
  },
  {
    code: '02136', scope: 'location',
    locationRule: {
      onTestFail(state, loc, api, inv, result) {
        if (result.source?.label === '调查') api.horror(inv.seat, 1)
      },
    },
  },
  // 第 55 轮：敦威治后段章节的地点「揭示时 / 进入时」规则从 later-behaviors.js 搬来。
  {
    code: '02132', scope: 'location',
    locationRule: { onEnter: { effect(state, loc, api, inv) { api.endTurn(inv.seat) } } },
  },
  {
    code: '02134', scope: 'location',
    locationRule: { onEnter: { effect(state, loc, api, inv) { api.discardRandom(inv.seat, 2) } } },
  },
  {
    code: '02173', scope: 'location',
    locationRule: {
      onReveal(state, loc, api) {
        const investigator = investigatorAt(state, loc.id)
        if (!investigator) return
        for (const pile of [state.encounterDeck, state.encounterDiscard]) {
          const index = pile.indexOf('02182')
          if (index >= 0) {
            pile.splice(index, 1)
            state.encounterDeck.push('02182')
            api.drawEncounter(investigator.seat)
            break
          }
        }
        api.shuffleEncounterDeck()
      },
    },
  },
  {
    code: '02176', scope: 'location',
    locationRule: {
      onReveal(state, loc, api) {
        const investigator = investigatorAt(state, loc.id)
        if (!investigator) return
        for (const pile of [state.encounterDeck, state.encounterDiscard]) {
          const index = pile.indexOf('02182')
          if (index >= 0) {
            pile.splice(index, 1)
            state.encounterDeck.push('02182')
            api.drawEncounter(investigator.seat)
            break
          }
        }
        api.shuffleEncounterDeck()
      },
    },
  },
  {
    code: '02177', scope: 'location',
    locationRule: {
      onReveal(state, loc, api) {
        const investigator = investigatorAt(state, loc.id)
        if (!investigator) return
        for (let index = 0; index < 3; index++) api.drawEncounter(investigator.seat)
      },
    },
  },
  {
    code: '02285', scope: 'location',
    locationRule: {
      onReveal(state, loc, api) {
        const lead = revealLead(state, loc)
        if (lead && !lead.actionsLeft) api.horror(lead.seat, 2)
      },
    },
  },
  {
    code: '02286', scope: 'location',
    locationRule: {
      onReveal(state, loc, api) {
        const lead = revealLead(state, loc)
        if (lead) api.discardTop(lead.seat, 2 * lead.actionsLeft)
      },
    },
  },
  {
    code: '02287', scope: 'location',
    locationRule: {
      onReveal(state, loc) { loc.doom = (loc.doom || 0) + state.numInvestigators },
    },
  },
  {
    code: '02288', scope: 'location',
    locationRule: {
      onReveal(state, loc, api) {
        const lead = revealLead(state, loc)
        if (lead) api.endTurn(lead.seat)
      },
    },
  },
  {
    code: '02289', scope: 'location',
    locationRule: {
      onReveal(state, loc, api) {
        while (state.encounterDeck.length) {
          const drawn = state.encounterDeck.pop()
          if (state.scenario.enemies[drawn]) { api.spawn(drawn, loc.id); break }
          state.encounterDiscard.push(drawn)
        }
      },
    },
  },
  {
    code: '02290', scope: 'location',
    locationRule: {
      onReveal(state, loc, api) {
        const lead = revealLead(state, loc)
        if (lead && !lead.actionsLeft) api.damage(lead.seat, 2)
      },
    },
  },
  {
    code: '02291', scope: 'location',
    locationRule: {
      onReveal(state, loc, api) {
        const lead = revealLead(state, loc)
        if (lead && !lead.actionsLeft) api.discardTop(lead.seat, 5)
      },
    },
  },
  {
    code: '02292', scope: 'location',
    locationRule: {
      onReveal(state, loc, api) {
        const lead = revealLead(state, loc)
        if (lead) api.horror(lead.seat, lead.actionsLeft)
      },
    },
  },
  // 第 70 轮：博物馆/火车地点的调查限制。
  {
    code: '02130', scope: 'location',
    locationRule: {
      investigationError(state, inv) {
        return inv.resources <= 4 ? '资源不足 5，无法调查管理办公室' : null
      },
    },
  },
  {
    code: '02131', scope: 'location',
    locationRule: {
      investigationError(state, inv) {
        return inv.hand.length <= 4 ? '手牌不足 5，无法调查管理办公室' : null
      },
    },
  },
  {
    code: '02137', scope: 'location',
    locationRule: {
      investigationError(state, inv, loc) {
        return state.enemies.some(enemy => enemy.code === '02141' && enemy.location === loc.id)
          ? '恐惧猎手在此，无法调查' : null
      },
    },
  },
  {
    code: '02174', scope: 'location',
    locationRule: {
      investigationError() { return '会客车厢不能调查' },
      actions({ state, inv, loc, add }) {
        add('parlorClue', '支付 3 资源，发现会客车厢 1 个线索',
          inv.resources < 3 ? `需要 3 资源（当前 ${inv.resources}）`
            : !(loc?.clues > 0) ? '会客车厢已经没有线索' : null)
      },
    },
  },
  // 第 72 轮：博物馆入口/教堂不能获得资源；火车两节车厢的场景行动。
  {
    code: '02126', scope: 'location',
    locationRule: { canGainResources: false },
  },
  {
    code: '02206', scope: 'location',
    locationRule: { canGainResources: false },
  },
  {
    code: '02172', scope: 'location',
    locationRule: {
      actions({ state, add }) {
        if (!state.scenarioFlags.stolePassengersLuggage) add('stealLuggage', '拿走旅客行李：获得 3 资源')
      },
    },
  },
  // 第 68 轮：Essex County Express 的五节旅客车厢。
  {
    code: '02167', scope: 'location',
    locationRule: {
      onEnter: { effect(state, loc, api, inv) { essexPassengerCompartment(state, inv, api, '02167', { skill: 'agility', needed: 2, damage: 2, harmLabel: '受到 2 伤害' }) } },
    },
  },
  {
    code: '02168', scope: 'location',
    locationRule: {
      onEnter: { effect(state, loc, api, inv) { essexPassengerCompartment(state, inv, api, '02168', { skill: 'combat', needed: 2, damage: 2, harmLabel: '受到 2 伤害' }) } },
    },
  },
  {
    code: '02169', scope: 'location',
    locationRule: {
      onEnter: { effect(state, loc, api, inv) { essexPassengerCompartment(state, inv, api, '02169', { skill: 'willpower', needed: 2, horror: 2, harmLabel: '受到 2 恐惧' }) } },
    },
  },
  {
    code: '02170', scope: 'location',
    locationRule: {
      onEnter: { effect(state, loc, api, inv) { essexPassengerCompartment(state, inv, api, '02170', { skill: 'intellect', needed: 2, horror: 2, harmLabel: '受到 2 恐惧' }) } },
    },
  },
  {
    code: '02171', scope: 'location',
    locationRule: {
      onEnter: { effect(state, loc, api, inv) { essexPassengerCompartment(state, inv, api, '02171', { skill: 'wild', needed: 1, damage: 1, horror: 1, harmLabel: '受到 1 伤害与 1 恐惧' }) } },
    },
  },
  {
    code: '02249', scope: 'location',
    locationRule: { turnEndDamage: 1 },
  },
  {
    code: '02205', scope: 'location',
    locationRule: {
      onInvestigateFail(state, inv, loc) {
        if ((loc.clues || 0) <= 0) return
        loc.clues--
        loc.doom = (loc.doom || 0) + 1
      },
    },
  },
  {
    code: '02204', scope: 'location',
    locationRule: { enemyEvadeModifier: 1 },
  },
  {
    code: '02244', scope: 'location',
    locationRule: { enemyEvadeModifier: -1 },
  },
  {
    code: '02245', scope: 'location',
    locationRule: { enemyEvadeModifier: -1 },
  },
  {
    code: '02216', scope: 'enemy',
    enemyRule: { cannotOpportunityAttack: true },
  },
  {
    code: '02324', scope: 'location',
    locationRule: {
      onDraw(state, loc, api, seat, meta) {
        // 涌动只在从遭遇牌库抽取时结算；从弃牌堆放入场不触发。
        if (meta?.fromDiscard) return
        api.drawEncounter(seat)
      },
    },
  },
  {
    code: '02327', scope: 'location',
    locationRule: {
      onDraw(state, loc, api, seat) {
        const inv = state.investigators[seat]
        const index = inv.discard.findLastIndex(card => ALL_CARDS[card]?.traits?.includes('Madness'))
        if (index >= 0) api.drawDiscard(seat, index)
      },
      onLeave: {
        test: { skill: 'willpower', difficulty: 2 },
        cancelMessage: '🌀 「雅哈格勒之阶」：意志检定失败，移动被取消。',
        onFail(state, loc, api) {
          api.remove(loc.id)
          state.encounterDeck.push('02327')
          api.shuffleEncounterDeck()
        },
      },
    },
  },
  // 第 78 轮：血祭地窖底下翻出的密室与钥匙。
  {
    code: '02214', scope: 'location',
    onFound(state, inv, api, { sourceLocation }) {
      const chamberId = scenarioLocationId(state, '02214') || 'location02214'
      api.place(chamberId)
      const chamber = state.locations.find(loc => loc.id === chamberId)
      if (!chamber) return
      if (sourceLocation && !sourceLocation.connections.includes(chamber.id)) sourceLocation.connections.push(chamber.id)
      if (sourceLocation && !chamber.connections.includes(sourceLocation.id)) chamber.connections.push(sourceLocation.id)
    },
  },
  {
    code: '02254', scope: 'storyAsset',
    assetRule: { formula: true },
  },
  {
    code: '02215', scope: 'storyAsset',
    assetRule: { chamberKey: true },
    onFound(state, inv, api) { api.giveAsset(inv.seat, '02215') },
  },
  {
    code: '02325', scope: 'location',
    locationRule: {
      onDraw(state, loc, api, seat) { api.discardRandom(seat, 1) },
      onCluesRemoved(state, loc, api) {
        if ((loc.clues || 0) > 0) return
        api.remove(loc.id)
        state.encounterDiscard.push('02325')
        api.info?.('「菱柱瀑布」上的最后 1 个线索被移除，它被弃掉。')
      },
    },
  },
  {
    code: '02326', scope: 'location',
    locationRule: {
      onDraw(state, loc, api, seat) {
        const inv = state.investigators[seat]
        inv.resources = Math.max(0, inv.resources - 2)
      },
      onLeave: {
        effect(state, loc, api, inv) {
          const choice = api.choose({ kind: 'location', source: '02326', seat: inv.seat,
            prompt: '离开无尽之桥：放置 1 个毁灭，或弃掉它？',
            options: [{ id: 'doom', label: '放置 1 个毁灭' }, { id: 'discard', label: '弃掉无尽之桥' }] })
          if (choice === 'doom') loc.doom = (loc.doom || 0) + 1
          else {
            api.remove(loc.id)
            state.encounterDiscard.push(originalOf(loc))
          }
        },
      },
    },
  },
  {
    code: '02328', scope: 'location',
    locationRule: {
      onDraw(state, loc, api, seat) {
        const index = state.encounterDiscard.findLastIndex(code =>
          ALL_CARDS[code]?.traits?.includes('Hex') || state.scenario.treacheries[code]?.traits?.includes('Hex'))
        if (index >= 0) api.drawEncounterDiscard(seat, index)
      },
    },
  },
  // 第 56 轮：敦威治后段章节的幕/密谋「揭示时」规则从 later-behaviors.js 搬来。
  // 章节入口在 later-behaviors 里先查条目，再走未迁移的旧分支。
  {
    code: '02119', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const horror = state.enemies.find(enemy => enemy.code === '02141')
        if (horror) horror.doom++
        else summonHuntingHorror(state, scenarioLocationId(state, '02127') || 'location02127', api)
        api.shuffleDiscard()
      },
    },
  },
  {
    code: '02120', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const horror = state.enemies.find(enemy => enemy.code === '02141')
        if (horror) horror.doom++
        else summonHuntingHorror(state, scenarioLocationId(state, '02127') || 'location02127', api)
        api.shuffleDiscard()
      },
    },
  },
  {
    code: '02121', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of activeInvestigators(state)) api.defeat(inv, 'damage')
        api.finish('noResolution')
      },
    },
  },
  {
    code: '02160', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const loc of state.scenarioZones.train.splice(0, 1)) api.devourLocation(loc)
        for (const inv of activeInvestigators(state)) inv.clues = 0
        state.clues = 0
      },
    },
  },
  {
    code: '02161', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const loc of state.scenarioZones.train.splice(0, 1)) api.devourLocation(loc)
        for (const inv of activeInvestigators(state)) inv.clues = 0
        state.clues = 0
      },
    },
  },
  {
    code: '02162', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const loc of state.scenarioZones.train.splice(0, 2)) api.devourLocation(loc)
        for (const inv of activeInvestigators(state)) inv.clues = 0
        state.clues = 0
      },
    },
  },
  {
    code: '02163', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const loc of state.scenarioZones.train.splice(0, 2)) api.devourLocation(loc)
        for (const inv of activeInvestigators(state)) inv.clues = 0
        state.clues = 0
      },
    },
  },
  {
    code: '02164', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of activeInvestigators(state)) api.defeat(inv, 'horror')
        api.finish('r2')
      },
    },
  },
  {
    code: '02196', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const zones = state.scenarioZones
        if (zones.sacrifices.length >= 3) {
          const index = Math.floor(api.random() * zones.sacrifices.length)
          zones.sacrificed.push(zones.sacrifices.splice(index, 1)[0])
        }
      },
    },
  },
  {
    code: '02197', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const zones = state.scenarioZones
        if (zones.sacrifices.length >= 2) {
          const index = Math.floor(api.random() * zones.sacrifices.length)
          zones.sacrificed.push(zones.sacrifices.splice(index, 1)[0])
        }
      },
    },
  },
  {
    code: '02198', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of activeInvestigators(state)) inv.resigned = true
        api.finish('noResolution')
      },
    },
  },
  {
    code: '02237', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const zones = state.scenarioZones
        api.shuffleDiscard()
        if (!zones.brood.remaining) return
        zones.brood.remaining--
        zones.setAside.splice(zones.setAside.indexOf('02255'), 1)
        const location = chooseBroodRandomLocation(state, api).id
        const enemy = api.spawn('02255', location)
        if (enemy) enemy.health = 1 + state.numInvestigators
      },
    },
  },
  {
    code: '02238', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const zones = state.scenarioZones
        api.shuffleDiscard()
        if (!zones.brood.remaining) return
        zones.brood.remaining--
        zones.setAside.splice(zones.setAside.indexOf('02255'), 1)
        const location = state.investigators[state.campaign.leadSeat].location
        const enemy = api.spawn('02255', location)
        if (!enemy) return
        enemy.health = 1 + state.numInvestigators
        for (const inv of activeInvestigators(state).filter(item => item.location === location)) {
          api.test(inv.seat, 'agility', 4, result => { if (!result.success) api.attack(enemy, inv) })
        }
      },
    },
  },
  {
    code: '02239', scope: 'agenda',
    agendaRule: { onReveal(state, agenda, api) { api.finish('r1') } },
  },
  {
    code: '02275', scope: 'agenda',
    agendaRule: { onReveal(state, agenda, api) { api.shuffleDiscard() } },
  },
  {
    code: '02276', scope: 'agenda',
    agendaRule: { onReveal(state, agenda, api) { api.finish('r2') } },
  },
  {
    code: '02312', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        api.shuffleDiscard()
        api.drawEncounterLocation(state.campaign.leadSeat)
        if (state.campaign.records.theInvestigatorsFailedToSaveTheStudents) {
          for (const inv of activeInvestigators(state)) api.horror(inv.seat, 1)
        }
      },
    },
  },
  {
    code: '02313', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        api.shuffleDiscard()
        api.drawEncounterLocation(state.campaign.leadSeat)
        for (const inv of activeInvestigators(state)) {
          const count = (state.campaign.records.sacrificedToYogSothoth || []).length
          if (count) api.test(inv.seat, 'willpower', count, result => {
            if (!result.success) api.damage(inv.seat, Math.max(0, count - result.value))
          })
        }
      },
    },
  },
  {
    code: '02314', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const origin = scenarioLocationId(state, '02321') || scenarioLocationId(state, '02320') || 'location02320'
        const enemy = api.spawn('02323', origin)
        if (enemy) enemy.health = 4 + 6 * state.numInvestigators
      },
    },
  },
  {
    code: '02315', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const enemy = state.enemies.find(item => item.code === '02323')
        if (enemy) for (const inv of activeInvestigators(state)) api.attack(enemy, inv)
        // 换回同一张卡，保持 4a 在场上。
        state.agendas[state.agendaIndex] = { ...agenda }
      },
    },
  },
  {
    code: '02166', scope: 'act',
    actRule: {
      objective(state, { empty }) { return empty('02175') },
      onReveal(state, act, api) { api.finish('r1') },
    },
  },
  {
    code: '02200', scope: 'act',
    actRule: {
      objective(state, { empty }) { return empty('02214') },
      finish: {
        when(state) { return state.victoryDisplay.some(card => originalOf(card) === '02216') },
        resolution: 'r1',
      },
      onReveal(state, act, api) {
        api.finish(state.investigators.some(inv => inv.assets.some(asset => asset.code === '02140')) ? 'r2' : 'r3')
      },
    },
  },
  {
    code: '02241', scope: 'act',
    actRule: {
      objective(state) {
        return !state.scenarioZones.brood.remaining && !state.enemies.some(enemy => enemy.code === '02255')
      },
      onReveal(state, act, api) { api.finish('r2') },
    },
  },
  {
    code: '02277', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        for (const loc of state.locations) loc.clues = 0
        api.reveal(scenarioLocationId(state, '02283') || 'location02283')
      },
    },
  },
  {
    code: '02281', scope: 'act',
    actRule: { onReveal(state, act, api) { api.finish('r1') } },
  },
  {
    code: '02316', scope: 'act',
    actRule: {
      onReveal(state, act, api) { api.place(scenarioLocationId(state, '02321') || 'location02321') },
    },
  },
  {
    code: '02318', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        api.remove(scenarioLocationId(state, '02321') || 'location02321')
        api.place(scenarioLocationId(state, '02322') || 'location02322')
      },
    },
  },
  {
    code: '02319', scope: 'act',
    actRule: { onReveal(state, act, api) { api.finish('r1') } },
  },
  // 第 58 轮：敦威治 `actReveal` 剩余可纯 `api` 表达的分支。
  {
    code: '02122', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        api.reveal(scenarioLocationId(state, '02127') || 'location02127')
        if (state.scenarioFlags.brokeMuseumDoor) {
          state.acts[1] = { ...state.scenario.acts.find(item => originalOf(item) === '02124') }
          return
        }
        const seat = api.choose({
          kind: 'story', source: '02139', seat: state.campaign.leadSeat,
          prompt: '选择剧情资产的控制者。',
          options: activeInvestigators(state).map(inv => ({ id: String(inv.seat), label: inv.name })),
        })
        api.giveAsset(Number(seat), '02139')
      },
    },
  },
  {
    code: '02123', scope: 'act',
    actRule: {
      objective(state, { entered }) { return entered('02137') },
      onReveal(state, act, api) {
        summonHuntingHorror(state, scenarioLocationId(state, '02137') || 'location02137', api)
      },
    },
  },
  {
    code: '02124', scope: 'act',
    actRule: {
      objective(state, { entered }) { return entered('02137') },
      onReveal(state, act, api) {
        chooseStoryControllerEntry(state, '02138', api)
        summonHuntingHorror(state, scenarioLocationId(state, '02137') || 'location02137', api)
      },
    },
  },
  {
    code: '02125', scope: 'act',
    actRule: {
      objective(state, { empty }) { return empty('02137') },
      onReveal(state, act, api) {
        const choice = api.choose({
          kind: 'story', source: act.originalCode || act.code, seat: state.campaign.leadSeat,
          prompt: '如何处置死灵之书？',
          options: [{ id: 'r1', label: '销毁' }, { id: 'r2', label: '保管' }],
        })
        api.finish(choice)
      },
    },
  },
  {
    code: '02165', scope: 'act',
    actRule: {
      objective(state, { entered }) { return entered('02175') },
      onReveal(state, act, api) {
        const inv = activeInvestigators(state)
          .find(item => item.location === (scenarioLocationId(state, '02175') || 'location02175'))
        if (!inv) return
        const skill = api.choose({
          kind: 'story', source: act.originalCode || act.code, seat: inv.seat,
          prompt: '如何越过煤水车？',
          options: [{ id: 'agility', label: '敏捷（3）：躲避' }, { id: 'combat', label: '战斗（3）：承受高温' }],
        })
        api.test(inv.seat, skill, 3, result => {
          if (!result.success) api.trauma(inv.seat, skill === 'agility' ? 'mental' : 'physical', 1)
        })
      },
    },
  },
  {
    code: '02199', scope: 'act',
    actRule: {
      objective(state, { entered }) { return entered('02214') },
      onReveal(state, act, api) {
        for (const loc of state.locations) api.reveal(loc.id)
        const chamber = state.locations.find(item =>
          item.id === (scenarioLocationId(state, '02214') || 'location02214'))
        const total = state.locations.reduce((sum, loc) => sum + loc.clues, 0)
          + state.investigators.reduce((sum, inv) => sum + inv.clues, 0)
        for (const loc of state.locations) loc.clues = 0
        for (const inv of state.investigators) inv.clues = 0
        state.clues = 0
        if (!chamber) return
        chamber.clues = total
        api.spawn('02216', chamber.id)
      },
    },
  },
  {
    code: '02240', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        for (const inv of activeInvestigators(state)) api.giveAsset(inv.seat, '02254')
        state.scenarioZones.setAside = state.scenarioZones.setAside.filter(code => code !== '02254')
        if ((state.campaign.records.sacrificedToYogSothoth || []).includes('02040')) state.doom++
      },
    },
  },
  {
    code: '02278', scope: 'act',
    actRule: {
      objective(state, { entered }) { return entered('02284') },
      onReveal() {},
      cluesOnReveal: 0,
    },
  },
  {
    code: '02279', scope: 'act',
    actRule: {
      objective(state, { entered }) { return entered('02284') },
      onReveal(state, act, api) {
        api.spawn('02293', scenarioLocationId(state, '02284') || 'location02284')
      },
      cluesOnReveal: 0,
    },
  },
  {
    code: '02280', scope: 'act',
    actRule: {
      objective(state, { entered }) { return entered('02284') },
      onReveal(state, act, api) {
        const enemy = api.spawn('02293', scenarioLocationId(state, '02284') || 'location02284')
        if (enemy) enemy.damageTaken = state.numInvestigators
      },
      cluesOnReveal: 0,
    },
  },
  {
    code: '02317', scope: 'act',
    actRule: {
      objective(state, { entered }) { return entered('02321') },
      onReveal() {},
    },
  },
  // 第 115 轮：课外活动（敦威治第一章）的地点场景行动。
  // 行动文案与结算仍留在章节 behavior（只按 move.rule 分派），这里声明「这个地点提供哪些行动」。
  {
    code: '02051', scope: 'location',
    locationRule: { scenarioActions: ['unionHeal'] },
  },
  {
    code: '02054', scope: 'location',
    locationRule: {
      scenarioActions: ['rescueRice'], facultyOfficeReveal: true,
      entryError(state, location) {
        return location.revealed ? null : '通往教师办公室的门锁住了。你不能移动进入教师办公室。'
      },
    },
  },
  {
    code: '02057', scope: 'location',
    locationRule: {
      scenarioActions: ['searchConcoction'],
      entryError(state, location) {
        return location.revealed ? null : '通往炼金实验室的门锁住了。你不能移动进入炼金实验室。'
      },
    },
  },
  // 第 7 批：俱乐部 Always Wins（敦威治第二章）的幕/密谋脚本。
  {
    code: '02066', scope: 'act',
    actRule: {
      // 第 115 轮：「歪打正着」允许作弊改判混乱标记（读者在章节 behavior.chaosTokenRevealed）。
      allowsCheating: true,
      onReveal(state, act, api) {
        api.place('darkenedHall')
        if (state.agendaIndex !== 0) return
        const code = api.discardUntilEnemy(state.currentSeat ?? state.campaign.leadSeat,
          def => (def.traits || []).some(trait => String(trait).toLowerCase() === 'criminal'))
        if (code) api.spawn(code, 'darkenedHall')
      },
    },
  },
  {
    code: '02067', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const university = state.campaign.scenarioResults?.some(result => result.scenarioId === 'extracurricularActivity')
        if (university) {
          api.storyAsset('02079', 'cloverClubBar')
          for (const pile of [state.encounterDeck, state.scenarioZones.clubAside || []]) {
            const index = pile.findIndex(code => ALL_CARDS[code]?.encounterCode === 'hideous_abominations'
              && ALL_CARDS[code]?.type === 'enemy')
            if (index < 0) continue
            api.spawn(pile.splice(index, 1)[0], 'cloverClubBar')
            break
          }
          state.acts.splice(2, 1)
        } else {
          api.storyAsset('02080', 'vipArea')
          state.acts.splice(3, 1)
        }
      },
    },
  },
  {
    code: '02068', scope: 'act',
    actRule: {
      // 第 115 轮：孤注一掷的剧情角色与撤退结局（读者在 theHouseAlwaysWins 的 behavior）。
      guestAsset: '02080', guestResignedResolution: 'r2',
      onReveal(state, act, api) { api.finish('r1') },
    },
  },
  {
    code: '02069', scope: 'act',
    actRule: {
      guestAsset: '02079', guestResignedResolution: 'r3',
      onReveal(state, act, api) { api.finish('r1') },
    },
  },
  {
    code: '02063', scope: 'agenda',
    agendaRule: {
      // 第 115 轮：章节 behavior 从这两条数据读「罪犯获得冷漠」「伤害罪犯立即推进」。
      criminalAloof: true,
      criminalDamagedAdvancesAgenda: true,
      onReveal(state, agenda, api) {
        for (const enemy of state.enemies) {
          if (enemy.traits?.some(trait => trait.toLowerCase() === 'criminal')) enemy.aloof = false
        }
        api.shuffleDiscard()
        if (state.campaign.scenarioResults?.some(result => result.scenarioId === 'extracurricularActivity')) {
          state.scenarioFlags.advanceDirectlyToAgenda = '02064'
        }
      },
    },
  },
  {
    code: '02064', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const aside = state.scenarioZones.clubAside || []
        const candidates = aside.filter(code => ALL_CARDS[code]?.encounterCode === 'hideous_abominations'
          && ALL_CARDS[code]?.type === 'enemy')
        if (candidates.length) {
          const code = candidates[Math.floor(api.random() * candidates.length)]
          aside.splice(aside.indexOf(code), 1)
          api.spawn(code, 'cloverClubLounge')
        }
        state.encounterDeck.push(...aside.splice(0))
        api.shuffleDiscard()
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned && item.location === 'laBellaLuna')) {
          inv.location = 'cloverClubLounge'
        }
        for (const enemy of state.enemies.filter(item => item.location === 'laBellaLuna')) enemy.location = 'cloverClubLounge'
        api.remove('laBellaLuna')
      },
    },
  },
  {
    code: '02065', scope: 'agenda',
    agendaRule: {
      // 第 115 轮：敌军阶段开始时弃掉与异形同地点的罪犯（读者在章节 behavior）。
      discardsCriminalsWithAbomination: true,
      onReveal(state, agenda, api) { api.finish('r4') },
    },
  },
  // 第 115 轮：百赌百胜的地点/敌人/剧情资产规则（读者在 theHouseAlwaysWins 的 behavior）。
  // 画廊（02075）：在此调查失败后失去 2 资源。
  { code: '02075', scope: 'location', locationRule: { investigateFailLosesResources: 2 } },
  // VIP 区（02076）：在此时补给阶段不能抽取卡牌或获得资源。
  { code: '02076', scope: 'location', locationRule: { skipsUpkeepIncome: true } },
  // 俱乐部赌场管理员（02078）的 enemyRule 已在上面的敌人清单声明，这里只补身份标志。
  // 彼得·克劳佛（02079）：敌军阶段开始时无人控制则受到 1 点伤害；[free] 横置自动躲避罪犯。
  { code: '02079', scope: 'storyAsset', flags: { peterClover: true } },
  // 佛朗西斯·摩尔根博士（02080）的 assetRule.morgan 已在 entries/02080.js 声明。
  // 第 7 批：卡尔克萨第一章「谢幕」的幕/密谋脚本。
  {
    code: '03046', scope: 'act', flags: { firstAct: true },
    actRule: {
      // 第 114 轮：幕一的目标从条目读（chapter definition 不再按卡号分支）。
      objective: { type: 'clues', perInvestigator: 3 },
      onReveal(state, act, api) {
        const pool = [...state.scenarioFlags.lobbyDoorways, ...state.scenarioFlags.backstageDoorways]
        const id = pool.length ? pool[Math.min(pool.length - 1, Math.floor(api.random() * pool.length))] : null
        if (!id) throw new Error('没有可用于生成苍白面具下的男子的放在一边地点')
        for (const key of ['lobbyDoorways', 'backstageDoorways']) {
          const index = state.scenarioFlags[key].indexOf(id)
          if (index >= 0) state.scenarioFlags[key].splice(index, 1)
        }
        api.place(id)
        api.spawn('03059', id)
      },
    },
  },
  { code: '03048', scope: 'act', flags: { escapeAct: true }, actRule: { onReveal(state) { state.scenarioFlags.hazardTests = {} } } },
  {
    code: '03044', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const victory = state.victoryDisplay.findIndex(card => (card.originalCode || card.code) === '03060')
        if (victory >= 0) state.victoryDisplay.splice(victory, 1)
        if (!state.enemies.some(enemy => enemy.code === '03060')) api.spawn('03060', 'theatre')
      },
    },
  },
  {
    code: '03045', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.horror(inv.seat, 100)
        if (state.status === 'playing') api.finish('noResolution')
      },
    },
  },
  // 第 7 批：卡尔克萨「苍白面具」的幕/密谋脚本。
  {
    code: '03243', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const tomb = state.locations.find(location => location.originalCode === '03257')
        if (!tomb) throw new Error('暗影坟墓尚未进入游戏')
        state.scenarioFlags.tombLocationId = tomb.id
        api.spawn('03059', tomb.id)
        const records = state.campaign.records ||= {}
        if (!(records.vipsSlain || []).includes('03067')) api.spawn('03067b', state.scenarioFlags.startLocationId)
      },
    },
  },
  {
    code: '03244', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const defeated = state.scenarioFlags.actTwoAdvancedWith === 'defeat'
        const records = state.campaign.records ||= {}
        const key = defeated ? 'conviction' : 'doubt'
        records[key] = Number(records[key] || 0) + 2
        const stranger = state.enemies.find(enemy => enemy.code === '03059')
        if (stranger) {
          state.enemies.splice(state.enemies.indexOf(stranger), 1)
          state.scenarioZones.removed.push('03059')
        }
        const nextCode = defeated ? '03245' : '03246'
        state.acts = [
          ...state.acts.slice(0, 2),
          structuredClone(state.scenario.acts.find(card => card.originalCode === nextCode)),
        ]
      },
    },
  },
  { code: '03245', scope: 'act', actRule: { onReveal(state, act, api) { api.finish('r1') } } },
  { code: '03246', scope: 'act', actRule: { onReveal(state, act, api) { api.finish('r2') } } },
  {
    code: '03241', scope: 'agenda',
    agendaRule: { onReveal(state, agenda, api) { api.spawn('03241b', state.scenarioFlags.startLocationId) } },
  },
  {
    code: '03242', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
          api.trauma(inv.seat, 'physical', 1)
          api.defeat(inv, 'physical')
        }
      },
    },
  },
  // 第 7 批：卡尔科萨「真相幻影」的幕/密谋脚本。
  {
    code: '03204', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const code = act.originalCode
        const withClues = state.scenarioFlags.actOneAdvancedWith !== 'doom'
        const convictionRoute = code === '03205'
        const leadLocation = state.investigators[state.campaign.leadSeat]?.location
        const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        const distances = state.locations.map(location => ({
          id: location.id,
          score: Math.min(...active.map(inv => api.locationDistance(location.id, [inv.location])).filter(value => value >= 0)),
        }))
        const maximum = Math.max(...distances.map(item => item.score))
        const farthest = distances.filter(item => item.score === maximum)
        const far = farthest.length === 1 ? farthest[0].id : api.choose({
          kind: 'location', source: code, seat: state.campaign.leadSeat,
          prompt: '选择离所有调查员最远的地点生成风琴手。',
          options: farthest.map(item => ({ id: item.id, label: api.locationName(item.id) })),
        })
        if (!withClues) for (const inv of active) api.horror(inv.seat, 2)
        if ((convictionRoute && withClues) || (!convictionRoute && !withClues)) {
          api.spawn(state.scenarioFlags.organistCode, far)
        } else {
          api.spawn(state.scenarioFlags.organistCode, leadLocation)
        }
      },
    },
  },
  {
    code: '03205', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const code = act.originalCode
        const withClues = state.scenarioFlags.actOneAdvancedWith !== 'doom'
        const convictionRoute = code === '03205'
        const leadLocation = state.investigators[state.campaign.leadSeat]?.location
        const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        const distances = state.locations.map(location => ({
          id: location.id,
          score: Math.min(...active.map(inv => api.locationDistance(location.id, [inv.location])).filter(value => value >= 0)),
        }))
        const maximum = Math.max(...distances.map(item => item.score))
        const farthest = distances.filter(item => item.score === maximum)
        const far = farthest.length === 1 ? farthest[0].id : api.choose({
          kind: 'location', source: code, seat: state.campaign.leadSeat,
          prompt: '选择离所有调查员最远的地点生成风琴手。',
          options: farthest.map(item => ({ id: item.id, label: api.locationName(item.id) })),
        })
        if (!withClues) for (const inv of active) api.horror(inv.seat, 2)
        if ((convictionRoute && withClues) || (!convictionRoute && !withClues)) {
          api.spawn(state.scenarioFlags.organistCode, far)
        } else {
          api.spawn(state.scenarioFlags.organistCode, leadLocation)
        }
      },
    },
  },
  {
    code: '03206', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        api.finish(state.campaign.records?.youIntrudedOnASecretMeeting ? 'r2' : 'r1')
      },
    },
  },
  {
    code: '03207', scope: 'act',
    actRule: {
      // 第 119 轮：幕背面提供「跟踪阴影」团队行动（内容层按这个标志展开）。
      shadowAction: true,
      onReveal(state, act, api) {
        api.finish(state.campaign.records?.youIntrudedOnASecretMeeting ? 'r2' : 'r1')
      },
    },
  },
  {
    code: '03201', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
          for (const enemy of state.enemies.filter(candidate => candidate.engagedSeat === inv.seat)) enemy.engagedSeat = null
          const location = state.locations.find(candidate => candidate.id === inv.location)
          const choices = (location?.connections || []).filter(id => state.locations.some(candidate => candidate.id === id))
          if (!choices.length) continue
          const answer = api.choose({
            kind: 'location', source: agenda.originalCode, seat: inv.seat, canSkip: true,
            prompt: '拂晓：你可以移动到一个连接地点。',
            options: [{ id: 'skip', label: '留在原地' }, ...choices.map(id => ({ id, label: api.locationName(id) }))],
          })
          if (answer !== 'skip') api.moveInvestigator(inv.seat, answer)
        }
        moveOrganistAway(state, api)
      },
    },
  },
  {
    code: '03202', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
          for (const enemy of state.enemies.filter(candidate => candidate.engagedSeat === inv.seat)) enemy.engagedSeat = null
          const location = state.locations.find(candidate => candidate.id === inv.location)
          const choices = (location?.connections || []).filter(id => state.locations.some(candidate => candidate.id === id))
          if (!choices.length) continue
          const answer = api.choose({
            kind: 'location', source: agenda.originalCode, seat: inv.seat, canSkip: true,
            prompt: '拂晓：你可以移动到一个连接地点。',
            options: [{ id: 'skip', label: '留在原地' }, ...choices.map(id => ({ id, label: api.locationName(id) }))],
          })
          if (answer !== 'skip') api.moveInvestigator(inv.seat, answer)
        }
        moveOrganistAway(state, api)
        const records = state.campaign.records || {}
        if (!(records.vipsSlain || []).includes('03066') && !state.enemies.some(enemy => enemy.code === '03066b')) {
          api.spawn('03066b', 'montparnasse')
        }
      },
    },
  },
  {
    code: '03203', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const records = state.campaign.records || {}
        if (Number(records.doubt || 0) >= Number(records.conviction || 0)) { api.finish('r3'); return }
        // 卡背：确信高于疑惑时直接推进到场景 2b（不要先翻 2a 的背面）。
        const index = state.acts.findIndex(act => act?.stage === '2b')
        if (index >= 0) state.actIndex = index
        else api.advanceAct()
      },
    },
  },
  // 第 7 批：卡尔克萨「不可言说的誓言」的部分幕/密谋脚本。
  { code: '03165', scope: 'act', actRule: { onReveal(state, act, api) { api.spawn('03182b', 'danielsCell') } } },
  {
    code: '03167', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        api.finish(state.scenarioFlags.tookKeysByForce ? 'r2' : 'r3')
      },
    },
  },
  {
    code: '03162', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.defeat(inv, null)
        const resigned = state.investigators.some(inv => inv.resigned)
        api.finish(resigned ? (state.scenarioFlags.tookKeysByForce ? 'r2' : 'r3') : 'r1')
      },
    },
  },
  {
    code: '03163', scope: 'act',
    actRule: { onReveal(state, act, api) { chooseKeysInEntry(state, api) } },
  },
  {
    code: '03164', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const atCell = state.investigators.filter(inv => !inv.defeated && !inv.resigned && inv.location === 'danielsCell')
        const seat = atCell.length === 1 ? atCell[0].seat : Number(api.choose({
          kind: 'storyAsset', source: '03182a', seat: state.campaign.leadSeat,
          prompt: '选择一位位于丹尼尔牢房的调查员控制丹尼尔。',
          options: atCell.map(inv => ({ id: String(inv.seat), label: inv.name })),
        }))
        api.giveAsset(seat, '03182a')
        state.encounterDeck.push(...state.scenarioZones.underAct.splice(0))
        api.shuffleDiscard()
      },
    },
  },
  {
    code: '03166', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const underAct = state.scenarioZones.underAct.splice(0)
        const discardedMonsters = state.encounterDiscard.filter(code =>
          state.scenario.enemies[code]?.traits?.includes('Monster')).length
        if (underAct.length + discardedMonsters >= 3) {
          state.encounterDeck.push(...underAct)
          api.shuffleDiscard()
          const index = state.encounterDeck.findLastIndex(code =>
            state.scenario.enemies[code]?.traits?.includes('Monster'))
          if (index >= 0) {
            const monster = state.encounterDeck.splice(index, 1)[0]
            const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
            const lowest = Math.min(...active.map(inv => inv.willpower))
            const candidates = active.filter(inv => inv.willpower === lowest)
            const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choose({
              kind: 'target', source: '03166', seat: state.campaign.leadSeat,
              prompt: '选择一位意志最低的调查员抽取怪物。',
              options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
            }))
            api.spawn(monster, state.investigators[seat].location)
          }
        } else {
          state.encounterDeck.push(...underAct)
          api.shuffleDiscard()
        }
      },
    },
  },
  {
    code: '03160', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        state.encounterDeck.push(...state.scenarioZones.lunatics.splice(0))
        api.shuffleDiscard()
        stashRandomMonsterInEntry(state, api)
      },
    },
  },
  {
    code: '03161', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const monsters = state.scenarioZones.monsters
        if (monsters.length) {
          state.encounterDeck.push(monsters.splice(Math.floor(api.random() * monsters.length), 1)[0])
          api.shuffleEncounterDeck()
        }
        if (!(state.campaign.records.vipsSlain || []).includes('03065')) api.spawn('03065b', 'garden')
      },
    },
  },
  // 第 7 批：卡尔克萨「往事回声」的历史房间 + 幕/密谋脚本。
  // 第 119 轮：历史房间自己的场景行动与修正也在这里声明（章节 behavior 只做通用分派）。
  {
    code: '03128', scope: 'location', historicalRoom: true,
    locationRule: {
      actions({ state, inv, location, moves }) {
        const meetingRoomKey = `meetingRoom:${inv.seat}`
        if (state.scenarioFlags?.[meetingRoomKey] === state.round) return
        const readyAlly = (inv.assets || []).some(asset => !asset.exhausted
          && ALL_CARDS[asset.code]?.traits?.some(trait => trait.toLowerCase() === 'ally'))
        moves.push({ action: 'scenarioAction', rule: 'meetingRoomAlly',
          label: '横置一名盟友，在会议室发现1个线索',
          reason: location.clues > 0
            ? readyAlly ? null : '需要一名未横置的[[盟友]]支援'
            : '会议室已经没有线索' })
      },
    },
  },
  { code: '03129', scope: 'location', historicalRoom: true },
  { code: '03130', scope: 'location', historicalRoom: true },
  { code: '03132', scope: 'location', historicalRoom: true },
  { code: '03133', scope: 'location', historicalRoom: true },
  {
    code: '03134', scope: 'location', historicalRoom: true,
    locationRule: {
      actions({ state, moves }) {
        if (state.scenarioFlags.readingRoomRound === state.round) return
        moves.push({ action: 'scenarioAction', rule: 'readingRoom', label: '调查阅览室，将敌人上的毁灭转为线索',
          reason: state.enemies.some(enemy => (enemy.doom || 0) > 0) ? null : '场上没有带毁灭的敌人' })
      },
    },
  },
  { code: '03136', scope: 'location', historicalRoom: true },
  {
    code: '03137', scope: 'location', historicalRoom: true,
    // 第 119 轮：皮博迪先生在此地点时帷幕 -2（原 locationShroudModifier 分支）。
    modifiers: [{
      target: 'locationShroud', amount: -2,
      condition: { when: ({ state, entity }) => (state.investigators || []).some(inv =>
        inv.location === entity.id && (inv.assets || []).some(asset => nonPlayerEntryFor(originalOf(asset))?.assetRule?.peabody)) },
    }],
  },
  { code: '03138', scope: 'location', historicalRoom: true },
  // 追猎恐魔的转交已在 theLastKing behavior；石丸春子（03067b）：
  // 强制 - 你通过攻击以外的效果对她造成伤害后，抽取遭遇牌库顶 1 张。
  {
    code: '03067b', scope: 'enemy', implemented: true,
    name: '石丸春子',
    text: '猎手。强制 - 你通过攻击以外的效果对石丸春子造成伤害后：抽取遭遇牌库顶 1 张卡牌。',
    enemyScript: {
      onDamaged(state, enemy, api, seat) {
        // 攻击伤害来自攻击检定（source.enemyId 指向该敌人），不触发。
        if (state.skillTest?.source?.enemyId === enemy.id) return
        if (!Number.isInteger(seat)) return
        api.drawEncounter(seat)
      },
    },
  },
  // 塞巴斯蒂安·莫罗（附身，03068b）：该敌人的攻击不能被取消。
  {
    code: '03068b', scope: 'enemy', implemented: true,
    name: '塞巴斯蒂安·莫罗（附身）',
    text: '该敌人的攻击不能被取消。',
    enemyRule: { attacksCannotBeCancelled: true },
  },
  // 皮博迪先生（03141）：剧情资产身份标志（03137 的帷幕修正与行动都读它）。
  { code: '03141', scope: 'storyAsset', assetRule: { peabody: true } },
  // 附身宣誓者（03140）：密谋 2 之前免疫伤害；被击败时进胜利区并进入结局 3；敌军阶段开始累积毁灭。
  {
    code: '03140', scope: 'enemy',
    enemyScript: {
      onDamaged(state, enemy) {
        if (state.actIndex < 2) enemy.damageTaken = 0
      },
      onDefeated(state, enemy, api) {
        if (!state.victoryDisplay.some(card => card.id === enemy.id)) {
          state.victoryDisplay.push({ ...structuredClone(enemy), originalCode: '03140', victory: 2 })
        }
        api.finish('r3')
        return true
      },
      onPhaseStart(state, enemy, api) {
        if (!enemy.exhausted) enemy.doom = (enemy.doom || 0) + 1
        else {
          const answer = api.choose({
            kind: 'enemy', source: enemy.id, seat: state.campaign.leadSeat,
            prompt: '附身宣誓者：重整它，或在其上放置 1 个毁灭标记。',
            options: [{ id: 'ready', label: '重整附身宣誓者' }, { id: 'doom', label: '放置 1 毁灭' }],
          })
          if (answer === 'ready') enemy.exhausted = false
          else enemy.doom = (enemy.doom || 0) + 1
        }
      },
    },
  },
  // 追寻者（03144）：神话阶段结束时把所在地点的 1 个线索移到它身上；不能则放 1 毁灭。
  {
    code: '03144', scope: 'enemy',
    enemyScript: {
      onMythosEnd(state, enemy) {
        const location = (state.locations || []).find(candidate => candidate.id === enemy.location)
        if (location?.clues > 0) {
          location.clues--
          enemy.clues = (enemy.clues || 0) + 1
        } else enemy.doom = (enemy.doom || 0) + 1
      },
    },
  },
  // 误入歧途（03145）：把 1 个线索移到异教徒身上，或在当前议程放 1 个毁灭。
  {
    code: '03145', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const code = originalOf(card)
      const cultists = (state.enemies || []).filter(enemy => enemy.traits?.includes('Cultist'))
      const options = [{ id: 'agenda', label: '在当前议程放置 1 个毁灭' }]
      if (inv.clues > 0) {
        options.unshift(...cultists.map(enemy => ({ id: enemy.id, label: `将 1 个线索移到${enemy.name}` })))
      }
      const answer = api.choose({ kind: 'encounter', source: code, seat: inv.seat, prompt: '误入歧途', options })
      const enemy = cultists.find(candidate => candidate.id === answer)
      if (enemy) {
        inv.clues--
        enemy.doom = (enemy.doom || 0) + 1
      } else state.doom++
      return false
    },
  },
  // 追随者找到前路（03146）：带毁灭的异教徒把毁灭转移到当前议程；否则从遭遇牌库找出一个异教徒。
  {
    code: '03146', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const cultists = (state.enemies || []).filter(enemy =>
        enemy.traits?.includes('Cultist') && (enemy.doom || 0) > 0)
      if (cultists.length) {
        let moved = 0
        for (const enemy of cultists) {
          moved += enemy.doom || 0
          enemy.doom = 0
        }
        // 毁灭搬到密谋上后立即检查推进。
        if (moved) api.addDoom(moved)
      } else {
        // 卡面：遭遇牌库和遭遇弃牌堆都可以查找（弃牌堆优先，最后抽出）。
        const piles = [state.encounterDeck, state.encounterDiscard]
        let enemyCode = null
        for (const pile of piles) {
          const index = (pile || []).findLastIndex(candidate =>
            state.scenario?.enemies?.[candidate]?.traits?.includes('Cultist'))
          if (index >= 0) {
            enemyCode = pile.splice(index, 1)[0]
            break
          }
        }
        if (enemyCode) {
          api.spawn(enemyCode, inv.location)
          api.shuffleEncounterDeck()
        }
      }
      return false
    },
  },
  {
    code: '03124', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        for (const location of state.locations.filter(candidate => candidate.revealed
          && NON_PLAYER_ABILITY_ENTRIES.some(entry => entry.code === originalOf(candidate) && entry.historicalRoom))) {
          const max = location.maxClues ?? (location.cluesPerInvestigator || 0) * state.numInvestigators
          location.clues = Math.min(max || Infinity, (location.clues || 0) + state.numInvestigators)
        }
      },
    },
  },
  {
    code: '03125', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        for (const location of state.locations.filter(candidate => candidate.revealed
          && NON_PLAYER_ABILITY_ENTRIES.some(entry => entry.code === originalOf(candidate) && entry.historicalRoom))) {
          const max = location.maxClues ?? (location.cluesPerInvestigator || 0) * state.numInvestigators
          location.clues = Math.min(max || Infinity, (location.clues || 0) + state.numInvestigators)
        }
        const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        const seat = active.length === 1 ? active[0].seat : Number(api.choose({
          kind: 'storyAsset', source: '03141', seat: state.campaign.leadSeat,
          prompt: '选择一位调查员控制皮博迪先生。',
          options: active.map(inv => ({ id: String(inv.seat), label: inv.name })),
        }))
        api.giveAsset(seat, '03141')
        api.place('hiddenLibrary')
        connectPassagewaysInEntry(state)
      },
    },
  },
  {
    code: '03126', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const answer = api.choose({
          kind: 'story', source: act.id, seat: state.campaign.leadSeat,
          prompt: '如何处置黑玛瑙扣环？',
          options: [{ id: 'r1', label: '拿走它' }, { id: 'r2', label: '留在原处' }],
        })
        api.finish(answer)
      },
    },
  },
  { code: '03121', scope: 'agenda', doomPerInvestigator: true, doomPerInvestigatorAmount: 2, skipMythosDoom: true,
    agendaRule: { onReveal(state, agenda, api) { api.shuffleDiscard() } } },
  {
    code: '03122', scope: 'agenda', doomPerInvestigator: true, doomPerInvestigatorAmount: 2, skipMythosDoom: true,
    agendaRule: {
      onReveal(state, agenda, api) {
        api.spawn('03140', 'entryHall')
        const records = state.campaign.records || {}
        if (!(records.vipsSlain || []).includes('03068')) api.spawn('03068b', 'entryHall')
      },
    },
  },
  { code: '03123', scope: 'agenda', doomPerInvestigator: true, doomPerInvestigatorAmount: 3, skipMythosDoom: true,
    agendaRule: { onReveal(state, agenda, api) { api.finish('r4') } } },
  // 第 7 批：卡尔克萨终章「暗淡的卡尔克萨」的幕/密谋脚本。
  {
    code: '03320', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        if (!state.enemies.some(enemy => enemy.code === '03059')) api.spawn('03059', 'palaceOfTheKing')
      },
    },
  },
  {
    code: '03321a', scope: 'act',
    flags: { noClueDiscovery: true, pallidMaskActVersion: 1 },
    actRule: {
      // 背面（推进到 3a 时结算）：移除男子、给领队 03321b、生成褴褛之王。
      onAdvance(state, act, api) {
        const man = state.enemies.find(enemy => enemy.code === '03059')
        if (man) api.removeEnemyFromGame(man)
        if (!state.investigators.some(inv => inv.assets.some(asset => asset.code === '03321b'))) {
          api.giveAsset(state.campaign.leadSeat, '03321b', { cannotLeavePlay: true, sanityModifier: -2 })
        }
        api.spawn('03334', 'palaceOfTheKing')
      },
    },
  },
  {
    code: '03322a', scope: 'act',
    flags: { noClueDiscovery: true, pallidMaskActVersion: 2 },
    actRule: {
      onAdvance(state, act, api) {
        const man = state.enemies.find(enemy => enemy.code === '03059')
        if (man) api.removeEnemyFromGame(man)
        const spawned = api.spawn('03332', 'palaceOfTheKing')
        // 卡背：哈斯塔视为在场，但不在任何地点（战斗/躲避仍通过剧情能力处理）。
        if (spawned) {
          spawned.location = null
          spawned.engagedSeat = null
          spawned.noLocation = true
        }
      },
    },
  },
  {
    code: '03323a', scope: 'act',
    flags: { noClueDiscovery: true, pallidMaskActVersion: 3 },
    actRule: {
      onAdvance(state, act, api) {
        const man = state.enemies.find(enemy => enemy.code === '03059')
        const location = man?.location || 'palaceOfTheKing'
        if (man) api.removeEnemyFromGame(man)
        api.spawn('03333', location)
      },
    },
  },
  {
    code: '03324', scope: 'act', flags: { flipCarcosaAct: true },
    actRule: {
      onComplete(state, act, api) {
        const defeated = state.scenarioFlags.defeatedHastur
        api.finish(defeated === '03334' ? 'r1' : defeated === '03332' ? 'r2' : 'r3')
      },
    },
  },
  {
    code: '03317', scope: 'agenda',
    agendaRule: {
      // 背面：四选一。1/2 检定失败后必须改选尚未选过的选项；3/4 直接推进。
      onReveal(state, agenda, api) {
        const chosen = new Set()
        const investigators = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        for (let guard = 0; guard < 4; guard++) {
          const options = []
          if (!chosen.has('willpower')) options.push({ id: 'willpower', label: '任意调查员检定[意志](4)，成功则推进' })
          if (!chosen.has('intellect')) options.push({ id: 'intellect', label: '任意调查员检定[智识](4)，成功则推进' })
          options.push({ id: 'horror', label: '这不可能是真的：每位调查员受到 2 点恐惧并推进' })
          options.push({ id: 'faint', label: '调查员们昏倒：推进并在新密谋上放置 1 个毁灭' })
          const answer = options.length === 1 ? options[0].id : api.choose({
            kind: 'story', source: '03317', seat: state.campaign.leadSeat ?? 0,
            prompt: '疯狂漩涡：选择挣脱幻觉的方式。', options,
          })
          if (answer === 'horror') {
            for (const inv of investigators) api.horror(inv.seat, 2)
            return
          }
          if (answer === 'faint') {
            api.info?.('调查员们昏倒，过了一会儿才清醒过来。')
            api.addDoom(1)
            return
          }
          const skill = answer === 'intellect' ? 'intellect' : 'willpower'
          const seat = investigators.length === 1 ? investigators[0].seat : Number(api.choose({
            kind: 'investigator', source: '03317', seat: state.campaign.leadSeat ?? 0,
            prompt: `选择进行[${skill === 'willpower' ? '意志' : '智识'}](4)检定的调查员。`,
            options: investigators.map(inv => ({ id: String(inv.seat), label: inv.name })),
          }))
          const tester = state.investigators[seat] || investigators[0]
          let success = false
          api.test(tester.seat, skill, 4, result => { success = result?.success === true })
          if (success) {
            api.info?.(`${tester.name} 检定成功，挣脱了幻觉。`)
            return
          }
          chosen.add(skill)
          api.info?.(`${tester.name} 检定失败，必须选择另一个尚未选择过的选项。`)
        }
      },
    },
  },
  {
    code: '03318', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        if (!state.enemies.some(enemy => enemy.code === '03088')) api.spawn('03088', 'palaceOfTheKing')
        api.shuffleDiscard()
      },
    },
  },
  {
    code: '03319', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const records = state.campaign.records || {}
        api.finish(Number(records.conviction || 0) >= Number(records.doubt || 0) ? 'r4' : 'r5')
      },
    },
  },
  // 第 7 批：敦威治共享诡计的显现规则从 encounter-rules.js 搬来。
  // 每个条目只声明自己这张卡的结算；战役入口仍由 encounter-rules 的 resolveEncounter 分派。
  {
    code: '02081', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      for (const seat of state.scenarioFlags.hadDrink || []) {
        const target = state.investigators[seat]
        if (target && !target.defeated && !target.resigned) target.actionsLeft = Math.max(0, target.actionsLeft - 1)
      }
      api.drawEncounter(inv.seat)
      return { placed: false, surgeHandled: true }
    },
  },
  {
    code: '02082', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const criminals = state.enemies.filter(enemy => enemy.location === inv.location && enemy.traits?.includes('Criminal'))
      if (criminals.length) for (const enemy of criminals) enemy.doom = (enemy.doom || 0) + 1
      else inv.resources = Math.max(0, inv.resources - 2)
      return false
    },
  },
  {
    code: '02083', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'willpower', 5, result => {
        if (!result.success) api.discardTop(inv.seat, Math.max(0, 5 - result.value))
      })
      return false
    },
  },
  {
    code: '02084', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'], flags: { deckEmptiedRemove: true },
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      const exists = inv.threat.some(t => t.code === code)
      if (!exists) api.threat(inv.seat, code)
      // 牌库为空的强制（原 encounter-rules.deckEmptied）：弃掉本卡并受到 10 点伤害。
      if (!inv.deck?.length && !inv.defeated && !inv.resigned) {
        const index = inv.threat.findIndex(t => t.code === code)
        if (index >= 0) {
          inv.threat.splice(index, 1)
          state.encounterDiscard.push(code)
          api.damage(inv.seat, 10)
        }
      }
      api.drawEncounter(inv.seat)
      return { placed: !exists, surgeHandled: true }
    },
  },
  {
    code: '02085', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      const attached = state.scenarioFlags.lightOfAforgomon || []
      const options = ['act', 'agenda'].filter(type => !attached.some(item => item.type === type
        && item.index === state[type === 'act' ? 'actIndex' : 'agendaIndex']))
      if (!options.length) return false
      const chosen = options.length === 1 ? options[0] : api.choose({ kind: 'encounter', source: code, seat: inv.seat,
        prompt: '将亚弗戈蒙之光附属到当前密谋或当前场景（每张限 1 张）。',
        options: ['agenda', 'act'].filter(type => options.includes(type))
          .map(type => ({ id: type, label: type === 'act' ? '当前场景' : '当前密谋' })) })
      state.scenarioFlags.lightOfAforgomon = [...attached,
        { type: chosen, index: state[chosen === 'act' ? 'actIndex' : 'agendaIndex'] }]
      return true
    },
  },
  {
    code: '02091', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'willpower', 2 + inv.damage, result => { if (!result.success) api.horror(inv.seat, 2) })
      return false
    },
  },
  {
    code: '02093', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const token = state.chaosBag[Math.floor(api.random() * state.chaosBag.length)]
      if (['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token)) api.horror(inv.seat, 2)
      else if (/^[+-]?\d+$/.test(token) && Number(token) <= 0) api.damage(inv.seat, 1)
      return false
    },
  },
  {
    code: '02096', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    treacheryRule: { attachedHorror: true },
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      const enemies = state.enemies.filter(enemy => enemy.traits?.includes('Abomination'))
      if (!enemies.length) { api.drawEncounter(inv.seat); return false }
      const enemyId = enemies.length === 1 ? enemies[0].id : api.choose({
        kind: 'target', source: code, seat: inv.seat, prompt: '选择一只憎恶，治疗其全部伤害并附属变异野兽。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })) })
      const chosen = enemies.find(enemy => enemy.id === enemyId)
      if (!chosen) throw new Error('必须选择一只憎恶')
      chosen.damageTaken = 0
      chosen.attachedTreacheries = [...(chosen.attachedTreacheries || []), code]
      return true
    },
  },
  {
    code: '02099', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const enemies = state.enemies.filter(enemy => enemy.engagedSeat == null && enemy.traits?.includes('Criminal'))
      if (!enemies.length) api.drawEncounter(inv.seat)
      for (const enemy of enemies) {
        api.moveEnemy(enemy, api.stepToward(enemy.location, inv.location))
        if (enemy.engagedSeat === inv.seat) api.attack(enemy, inv)
      }
      return false
    },
  },
  {
    code: '02100', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      const assets = inv.assets.filter(asset => !state.scenario.storyAssets?.[asset.code]
        && !ALL_CARDS[asset.code]?.permanent)
      if (!assets.length) return false
      const choice = api.choose({ kind: 'target', source: code, seat: inv.seat,
        prompt: '选择一张非剧情支援洗入牌库，然后弃掉牌库顶 3 张。',
        options: assets.map(asset => ({ id: asset.id, label: ALL_CARDS[asset.code]?.nameZh || asset.code })) })
      const returned = api.shuffleAssetIntoDeck(inv.seat, choice)
      if (api.discardTop(inv.seat, 3).includes(returned)) api.horror(inv.seat, 2)
      return false
    },
  },
  {
    code: '02101', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      const key = `terrorFromBeyond:${state.round}:${state.phase}`
      const needed = state.scenarioFlags[key] >= 2 ? 2 : 1
      const labels = { asset: '支援', event: '事件', skill: '技能' }
      const types = Object.keys(labels)
      const options = needed === 1 ? types.map(type => ({ id: type, label: labels[type] }))
        : [['asset', 'event'], ['asset', 'skill'], ['event', 'skill']].map(pair => ({ id: pair.join(','),
          label: pair.map(type => labels[type]).join('与') }))
      const answer = api.choose({ kind: 'encounter', source: code, seat: inv.seat,
        prompt: `世外诡影：选择 ${needed} 种牌型，所有调查员弃掉手中对应卡牌。`, options })
      const chosen = new Set(answer.split(','))
      for (const target of state.investigators.filter(other => !other.defeated && !other.resigned)) {
        const discarded = target.hand.filter(item => chosen.has(ALL_CARDS[item]?.type))
        target.hand = target.hand.filter(item => !chosen.has(ALL_CARDS[item]?.type))
        target.discard.push(...discarded)
      }
      return false
    },
  },
  {
    code: '01176', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'willpower', 4, result => {
        if (result.success) return
        api.horror(inv.seat, 2)
        if (!inv.defeated && !inv.resigned) api.drawMadnessWeakness(inv.seat)
      })
      return false
    },
  },
  {
    code: '03085', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      if (inv.horror >= 3) inv.actionsLeft = Math.max(0, inv.actionsLeft - 1)
      return false
    },
  },
  {
    code: '03087', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'agility', 6, result => {
        if (result.success) return
        const count = Math.max(0, result.difficulty - result.value)
        const revealed = state.encounterDeck.splice(Math.max(0, state.encounterDeck.length - count))
        const cardOf = candidate => ALL_CARDS[typeof candidate === 'string'
          ? candidate : candidate?.originalCode || candidate?.code]
        api.info?.(`拜亚基的猎杀：揭示遭遇牌库顶 ${revealed.length} 张——${revealed.map(code =>
          cardOf(code)?.nameZh || code).join('、') || '（空）'}。`)
        const byakhees = revealed.filter(candidate => cardOf(candidate)?.traits?.includes('Byakhee'))
        const omens = revealed.filter(candidate => cardOf(candidate)?.traits?.includes('Omen'))
        if (omens.length) {
          api.info?.(`征兆诡计「${omens.map(code => cardOf(code)?.nameZh || code).join('、')}」出现，${inv.name} 受到 1 点恐惧。`)
          api.horror(inv.seat, 1)
        }
        let chosen = null
        if (byakhees.length === 1) chosen = byakhees[0]
        else if (byakhees.length > 1) {
          const answer = api.choose({
            kind: 'card', source: '03087', seat: inv.seat,
            prompt: '选择一张被揭示的[[拜亚基]]敌人并抽取它。',
            options: byakhees.map((code, index) => ({
              id: String(index), cardCode: code,
              label: cardOf(code)?.nameZh || code,
            })),
          })
          chosen = byakhees[Number(answer)] || byakhees[0]
        }
        const rest = revealed.filter(candidate => candidate !== chosen)
        state.encounterDeck.push(...rest)
        api.shuffleEncounterDeck()
        if (chosen) {
          // 「抽取」= 作为遭遇卡结算（生成并交战），不是洗回牌库。
          state.encounterDeck.push(chosen)
          api.info?.(`拜亚基的猎杀：${inv.name} 抽取「${cardOf(chosen)?.nameZh || chosen}」。`)
          api.drawEncounter(inv.seat)
        }
      })
      return true
    },
  },
  {
    code: '03090', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'intellect', 4, result => {
        if (result.success) return
        const deficit = Math.max(1, result.difficulty - result.value)
        const choice = api.choose({
          kind: 'encounter', source: '03090', seat: inv.seat,
          prompt: '黑星升起：选择在当前议程放置 1 毁灭，或承受等同失败差值的恐惧。',
          options: [{ id: 'doom', label: '在当前议程放置 1 毁灭' },
            { id: 'horror', label: `承受 ${deficit} 恐惧` }],
        })
        if (choice === 'doom') api.addDoom(1)
        else api.horror(inv.seat, deficit)
      })
      return false
    },
  },
  // 第 84 轮：古代地点的帷幕修正。
  {
    code: '04176', scope: 'location',
    locationRule: {
      shroudModifier(state, location, inv) {
        return inv && (inv.maxHealth ?? 0) - (inv.damage || 0) <= 3 ? -2 : 0
      },
    },
  },
  {
    code: '04183', scope: 'location',
    locationRule: {
      shroudModifier(state, location, inv) {
        return inv && (inv.maxSanity ?? 0) - (inv.horror || 0) <= 3 ? -2 : 0
      },
    },
  },
  {
    code: '04180', scope: 'location',
    locationRule: {
      shroudModifier(state, location) {
        return state.enemies.some(enemy => enemy.location === location.id && enemy.exhausted) ? -3 : 0
      },
    },
  },
  {
    code: '04181', scope: 'location',
    locationRule: { shroudModifier(state, location) { return location.resources || 0 } },
  },
  {
    code: '04182', scope: 'location',
    locationRule: { shroudModifier(state, location, inv) { return 2 * (inv?.actionsLeft || 0) } },
  },
  {
    code: '04185', scope: 'location',
    locationRule: { shroudModifier(state, location, inv) { return -(inv?.assets?.length || 0) } },
  },
  { code: '04292', scope: 'location', flags: { vengeanceShroud: true } },
  // 第 109 轮：幽嘶深渊的四个密谋揭示。
  {
    code: '04279', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        tfaPlacePursuit(state, api)
        const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        const withCanteen = active.filter(inv => api.checkSupplies(inv.seat, 'canteen'))
        if (!withCanteen.length) return
        const holder = withCanteen.length === 1 ? withCanteen[0] : state.investigators[Number(api.choose({
          kind: 'investigator', source: '04279', seat: state.campaign.leadSeat,
          prompt: '谁带水壶？该调查员决定是否收集这种奇怪的液体。',
          options: withCanteen.map(inv => ({ id: String(inv.seat), label: inv.name })),
        }))] || withCanteen[0]
        const answer = api.choose({
          kind: 'story', source: '04279', seat: holder.seat,
          prompt: '这可能有用。要不要收集这种奇怪的液体？',
          options: [{ id: 'collect', label: '收集（记住“收集了一种奇怪的液体”）' },
            { id: 'leave', label: '我不靠近它半步' }],
        })
        if (answer !== 'collect') return
        const flags = (state.scenarioFlags ||= {})
        flags.collectedAStrangeLiquid = true
        api.privateInfo?.(holder.seat, '你在剧本日志里记住：你“收集了一种奇怪的液体”。')
      },
    },
  },
  {
    code: '04280', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        tfaPlacePursuit(state, api)
        const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        if (!active.length) return
        const seat = active.length === 1 ? active[0].seat : Number(api.choose({
          kind: 'investigator', source: '04280', seat: state.campaign.leadSeat,
          prompt: '队长指定一位调查员担任队伍的侦查员。',
          options: active.map(inv => ({ id: String(inv.seat), label: inv.name })),
        }))
        const scout = state.investigators[seat] && !state.investigators[seat].defeated
          ? state.investigators[seat] : active[0]
        if (api.hasSupply?.(scout.seat, 'rope') ?? api.checkSupplies(scout.seat, 'rope')) {
          api.info?.(`侦查员 ${scout.name} 带着绳索，轻松爬上石崖。`)
          return
        }
        const skill = String(api.choose?.({
          kind: 'skill', source: '04280', seat: scout.seat,
          prompt: '攀爬石崖：选择用战斗或敏捷检定(5)。',
          options: [{ id: 'combat', label: '战斗(5)' }, { id: 'agility', label: '敏捷(5)' }],
        }) || 'combat') === 'agility' ? 'agility' : 'combat'
        api.test(scout.seat, skill, 5, result => {
          if (!result.success) api.trauma(scout.seat, 'physical', 1)
        }, 0, { label: '攀爬石崖', ability: true })
      },
    },
  },
  // 第 113 轮：最后之王的两张遭遇。
  {
    code: '03082', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const bystanders = state.storyAssets.filter(asset => ['03076a', '03077', '03078', '03079', '03080'].includes(asset.code))
      const options = [{ id: 'harm', label: '受到1点伤害和1点恐惧' }]
      if (inv.clues > 0 && bystanders.length) {
        options.unshift(...bystanders.map(asset => ({
          id: asset.id,
          label: `将1个线索放到${asset.name}`,
        })))
      }
      const choice = options.length === 1 ? 'harm' : api.choose({
        kind: 'target', source: '03082', seat: inv.seat,
        prompt: '盛宴：选择将线索放到一名旁人上，或受到伤害和恐惧。',
        options,
      })
      if (choice === 'harm') {
        api.damage(inv.seat, 1)
        api.horror(inv.seat, 1)
      } else {
        const guest = bystanders.find(asset => asset.id === choice)
        if (guest) {
          api.spendClues(inv.seat, 1)
          guest.clues = (guest.clues || 0) + 1
        }
      }
      return false
    },
  },
  {
    code: '03083', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state) {
      state.scenarioFlags.toughCrowd.push('03083')
      return true
    },
  },
  // 第 112 轮：最后之王两个会客室。
  { code: '03071', scope: 'location', flags: { afterParley: 'resources' } },
  { code: '03072', scope: 'location', flags: { afterParley: 'draw' } },
  {
    code: '04278', scope: 'agenda',
    agendaRule: { onReveal(state, agenda, api) { tfaPlacePursuit(state, api) } },
  },
  {
    code: '04281', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const zones = (state.scenarioZones ||= {})
        if (zones.harbingerAside) {
          zones.pursuit ||= []
          zones.pursuit.push(zones.harbingerAside)
          delete zones.harbingerAside
        }
        tfaPlacePursuit(state, api)
      },
    },
  },
  {
    code: '04282', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        tfaPlacePursuit(state, api)
        const zones = (state.scenarioZones ||= {})
        const index = (zones.setAside || []).indexOf('04296')
        if (index < 0) return
        zones.setAside.splice(index, 1)
        const start = state.scenarioFlags?.depthStartLocation
        const enemy = api.spawn('04296', start)
        if (enemy) api.info?.(`伊格在「${start}」现身。`)
        else zones.setAside.push('04296')
      },
      onDoomPlaced(state, payload, api) {
        if (!payload?.agenda) return
        const flags = (state.scenarioFlags ||= {})
        flags.furyDoomPlaced ||= {}
        const key = String(state.agendaIndex)
        flags.furyDoomPlaced[key] = (flags.furyDoomPlaced[key] || 0) + (payload.amount || 0)
        if (flags.furyDoomPlaced[key] < 3) return
        if (flags.furyDoomThird) return
        flags.furyDoomThird = true
        tfaPlacePursuit(state, api)
      },
    },
  },
  {
    code: '04283', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        tfaPlacePursuit(state, api)
        state.scenarioFlags ||= {}
        state.scenarioFlags.redDepthsOngoing = true
        state.scenarioZones ||= {}
        state.scenarioZones.pursuitReminders ||= []
        const reminder = agenda.originalCode || agenda.code
        if (!state.scenarioZones.pursuitReminders.includes(reminder)) state.scenarioZones.pursuitReminders.push(reminder)
        api.info?.('赤红深渊：此后每次在本密谋上放置毁灭，都会把追击中的敌人放出来（放到追击区作提醒）。')
      },
      onDoomPlaced(state, payload, api) {
        if (payload?.agenda) tfaPlacePursuit(state, api)
      },
    },
  },
  // 第 107 轮：幽嘶深渊的收尾密谋。
  { code: '04284', scope: 'agenda', agendaRule: { onReveal(state, agenda, api) { api.finish('r1') } } },
  // 第 106 轮：黑星升起的垮塌台阶与两个密谋行动。
  { code: '03289', scope: 'location', flags: { stairsTrait: 'omen' } },
  { code: '03288', scope: 'location', flags: { northTower: true } },
  { code: '03290', scope: 'location', flags: { stairsTrait: 'cultist' } },
  {
    code: '03291', scope: 'location', implemented: true, flags: { abbeyChurch: true },
    locationRule: {
      onReveal(state, location, api) {
        for (const id of ['choeurGothique', 'knightsHall', 'cloister', 'chapelOfStAubert', 'abbeyTower']) api.place(id)
      },
    },
  },
  {
    code: '03283', scope: 'location',
    locationRule: {
      actions({ state, moves }) {
        const decks = state.scenarioFlags.agendaDecks || {}
        const agendaDoom = Object.values(decks).some(deck => deck.doom > 0)
        moves.push({ action: 'scenarioAction', rule: 'shiftAgendaDoom', actions: 2,
          label: '花费2行动，将1个毁灭移到另一密谋并放置2个线索',
          reason: agendaDoom ? null : '“a”“c”两张密谋上都没有毁灭' })
      },
    },
  },
  {
    code: '03292', scope: 'location',
    locationRule: {
      // 第 114 轮：行动脚本只留通用实现，密谋牌堆与治愈类型由条目的数据声明。
      choeurGothique: { deck: 'a', heal: 'damage' },
      actions({ state, moves }) {
        if (state.scenarioFlags.choeurGothiqueUsed) return
        moves.push({ action: 'scenarioAction', rule: 'choeurGothiqueHeal',
          label: '在“a”密谋放置1毁灭，治愈2点伤害' })
      },
    },
  },
  {
    code: '03293', scope: 'location',
    locationRule: {
      choeurGothique: { deck: 'c', heal: 'horror' },
      actions({ state, moves }) {
        if (state.scenarioFlags.choeurGothiqueUsed) return
        moves.push({ action: 'scenarioAction', rule: 'choeurGothiqueHeal',
          label: '在“c”密谋放置1毁灭，治愈2点恐惧' })
      },
    },
  },
  // 第 105 轮：黑星升起的墙/塔与两个敌人身份。
  { code: '03285', scope: 'location', flags: { wall: true } },
  { code: '03287', scope: 'location', flags: { tower: true } },
  { code: '03088', scope: 'enemy', flags: { spawnGuard: true }, enemyRule: { harmStrategy: 'fillOne' } },
  { code: '03069b', scope: 'enemy', flags: { ashleigh: true } },
  // 第 104 轮：谢幕的排练室。
  { code: '03057', scope: 'location', flags: { overSuccessHorror: true } },
  // 第 103 轮：敦威治共享遭遇的顶层身份标志（不进入 state 哈希）。
  { code: '02090', scope: 'enemy', flags: { nightgaunt: true } },
  // 第 101 轮：谢幕的三张幕背面（使者被击败后的危险）。
  {
    code: '03047a', scope: 'act',
    actRule: {
      onEmissaryDefeated(state, enemy, api) {
        applyStrangerBack(state, '03047a', enemy, api)
        return true
      },
      onEmissaryDiscarded(state, enemy, api) {
        applyStrangerBack(state, '03047a', enemy, api)
        api.advanceAct()
        return true
      },
    },
  },
  {
    code: '03047b', scope: 'act',
    actRule: {
      onEmissaryDefeated(state, enemy, api) {
        applyStrangerBack(state, '03047b', enemy, api)
        return true
      },
      onEmissaryDiscarded(state, enemy, api) {
        applyStrangerBack(state, '03047b', enemy, api)
        api.advanceAct()
        return true
      },
    },
  },
  {
    code: '03047c', scope: 'act',
    actRule: {
      onEmissaryDefeated(state, enemy, api) {
        applyStrangerBack(state, '03047c', enemy, api)
        return true
      },
      onEmissaryDiscarded(state, enemy, api) {
        applyStrangerBack(state, '03047c', enemy, api)
        api.advanceAct()
        return true
      },
    },
  },
  // 第 100 轮：谢幕的使者。
  { code: '03060', scope: 'enemy', enemyScript: { emissary: true } },
  // 第 99 轮：最后之王的舞厅出口与餐厅。
  {
    code: '03070', scope: 'location',
    locationRule: {
      actions({ moves }) {
        moves.push({ action: 'scenarioAction', rule: 'leaveParty', label: '撤退：带着已找到的情报离开庄园' })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'leaveParty') return false
        state.actClues = Number(state.actClues || 0) + inv.clues
        api.spendClues(inv.seat, inv.clues)
        api.resign(inv.seat)
        return true
      },
    },
  },
  {
    code: '03075', scope: 'location',
    locationRule: {
      actions({ inv, moves }) {
        moves.push({ action: 'scenarioAction', rule: 'diningRoomHeal', label: '治愈1点恐惧并揭示一个混乱标记',
          reason: inv.horror > 0 ? null : '没有需要治愈的恐惧' })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'diningRoomHeal') return false
        inv.horror = Math.max(0, inv.horror - 1)
        const token = api.revealToken()
        if (['skull', 'autofail'].includes(token)) {
          api.horror(inv.seat, 1)
          const location = state.locations.find(item => item.id === inv.location)
          if (location) location.doom = (location.doom || 0) + 1
        }
        return true
      },
    },
  },
  // 第 99 轮：最后之王的敌人身份（黛安娜 / 乔丹 / 镜像）。
  { code: '03081', scope: 'enemy', enemyScript: { dianne: true } },
  { code: '03066b', scope: 'enemy', enemyScript: { jordan: true } },
  { code: '03065b', scope: 'enemy', enemyScript: { reality: true } },
  // 第 98 轮：黑星升起的回廊 / 骑士大厅。
  {
    code: '03294', scope: 'location',
    locationRule: {
      actions({ state, location, moves }) {
        if (state.scenarioFlags.foundGuide) return
        moves.push({ action: 'scenarioAction', actionKind: 'parley', rule: 'findGuide',
          label: '谈判：检定意志（3），寻找向导',
          reason: location.clues === 0 ? null : `需要先取走回廊的全部线索（还剩 ${location.clues} 个）` })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'findGuide') return false
        const location = state.locations.find(item => item.id === inv.location)
        if (!location || location.clues > 0 || state.scenarioFlags.foundGuide) {
          throw new Error('回廊能力当前不可用')
        }
        api.test(inv.seat, 'willpower', 3, result => {
          if (result.success) state.scenarioFlags.foundGuide = true
        })
        return true
      },
    },
  },
  {
    code: '03295', scope: 'location',
    locationRule: {
      actions({ state, location, moves }) {
        if (state.scenarioFlags.foundTowerKey) return
        moves.push({ action: 'scenarioAction', actionKind: 'investigate', rule: 'findTowerKey',
          label: '使用敏捷调查骑士大厅，寻找塔楼钥匙',
          reason: location.clues === 0 ? null : `需要先取走骑士大厅的全部线索（还剩 ${location.clues} 个）` })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'findTowerKey') return false
        const location = state.locations.find(item => item.id === inv.location)
        if (!location || location.clues > 0 || state.scenarioFlags.foundTowerKey) {
          throw new Error('骑士大厅能力当前不可用')
        }
        const difficulty = location.shroud + (location.shroudMod || 0) + (state.fogMod || 0)
        api.test(inv.seat, 'agility', difficulty, result => {
          if (result.success) state.scenarioFlags.foundTowerKey = true
        }, 0, { action: 'investigate', label: '骑士大厅寻找塔楼钥匙' })
        return true
      },
    },
  },
  // 第 97 轮：边界之外的场景/密谋翻面（04165/04167/04164）。
  {
    code: '04165', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const flags = (state.scenarioFlags ||= {})
        const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        const seat = flags.ancientPlacerSeat ?? active[0]?.seat
        if (seat == null) return
        api.test(seat, 'willpower', 4, result => {
          if (result.success) return
          api.info?.('🌫️ 穿过界限的冲击让你心神不宁：从收藏中找出一张基础疯狂/损伤弱点洗入牌库。')
          api.addBasicWeakness?.(seat, ['madness', 'injury'])
        })
      },
    },
  },
  {
    code: '04167', scope: 'act',
    actRule: { onReveal(state, act, api) { api.finish('r1') } },
  },
  {
    code: '04164', scope: 'agenda',
    agendaRule: { onReveal(state, agenda, api) { api.finish('r2') } },
  },
  // 第 95 轮：邪秽誓约的病人拘禁室与地窖入口。
  {
    code: '03177', scope: 'location',
    locationRule: {
      entryError(state, location) {
        if (location.revealed || state.actIndex >= 1) return null
        return '通往地下室走廊的门锁住了。你不能进入地下室走廊。'
      },
      onReveal(state, location, api) {
        if (state.scenarioFlags.cellsPlaced) return
        state.scenarioFlags.cellsPlaced = true
        const cells = ['danielsCell', 'occupiedCell', 'drearyCell', 'familiarCell']
        for (let i = cells.length - 1; i > 0; i--) {
          const j = Math.floor((api.random?.() ?? 0.5) * (i + 1))
          ;[cells[i], cells[j]] = [cells[j], cells[i]]
        }
        for (const id of cells) api.place(id)
      },
    },
  },
  {
    code: '03178', scope: 'location',
    locationRule: {
      onReveal(state, location, api) {
        const act = state.acts?.[state.actIndex]
        const code = act?.originalCode || act?.code
        if (code === '03164' || code === '03165') api.advanceAct()
      },
    },
  },
  // 第 94 轮：谢幕的群鼠后台。
  {
    code: '03058', scope: 'location',
    locationRule: {
      onReveal(state, location, api) {
        const copies = state.numInvestigators >= 3 ? 2 : 1
        for (let count = 0; count < copies; count++) {
          let found = false
          for (const pile of [state.encounterDeck, state.encounterDiscard]) {
            const index = pile.findIndex(code => code === 'swarmOfRats' || code === '01159')
            if (index < 0) continue
            const enemy = api.spawn(pile.splice(index, 1)[0], location.id)
            if (enemy) api.engage(enemy, state.currentSeat)
            found = true
            break
          }
          if (!found) break
        }
        api.shuffleEncounterDeck()
      },
    },
  },
  // 第 94 轮：幽嘶深渊的岌岌可危的悬崖。
  {
    code: '04289', scope: 'location',
    locationRule: {
      beforeExplore(state, inv, api) {
        const tests = [['willpower', 4], ['agility', 3], ['combat', 2]]
        const outcome = { died: false }
        const run = index => {
          api.test(inv.seat, tests[index][0], tests[index][1], result => {
            if (result.success) { outcome.died = false; return }
            if (index + 1 < tests.length) { run(index + 1); return }
            outcome.died = true
            api.info?.(`岌岌可危的悬崖：${inv.name} 三次检定全部失败，坠入深渊身亡。`)
            api.defeat(inv, 'killed')
            const record = state.campaign?.investigators?.[inv.seat]
            if (record) record.status = 'killed'
          }, 0, { label: '岌岌可危的悬崖', ability: true })
        }
        run(0)
        return !outcome.died
      },
    },
  },
  // 第 93 轮：谢幕的门厅/售票处/休息室/化妆间。
  {
    code: '03054', scope: 'location',
    locationRule: {
      actions({ state, moves }) {
        if (state.scenarioFlags.boxOfficeUsed) return
        moves.push({ action: 'scenarioAction', rule: 'stealBoxOffice', label: '从售票处取得5资源' })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'stealBoxOffice') return false
        if (state.scenarioFlags.boxOfficeUsed) throw new Error('本场游戏已从售票处取过资源')
        state.scenarioFlags.boxOfficeUsed = true
        state.scenarioFlags.stoleFromBoxOffice = true
        inv.resources += 5
        return true
      },
    },
  },
  {
    code: '03055', scope: 'location',
    locationRule: {
      actions({ moves }) {
        moves.push({ action: 'scenarioAction', rule: 'greenRoomInvestigate', label: '调查演员休息室（本次智识+3，之后弃掉全部手牌）' })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'greenRoomInvestigate') return false
        const location = state.locations.find(item => item.id === inv.location)
        api.test(inv.seat, 'intellect', (location?.shroud || 0) + (location?.shroudMod || 0), result => {
          if (result.success && location.clues > 0) {
            location.clues--
            api.gainClues(inv.seat, 1)
          }
          inv.discard.push(...inv.hand.splice(0))
        }, 3, { type: 'scenario', label: '调查', code: '03055' })
        return true
      },
    },
  },
  {
    code: '03056', scope: 'location',
    locationRule: {
      actions({ inv, moves }) {
        moves.push({ action: 'scenarioAction', rule: 'dressingRoomHeal', actions: 3,
          label: '花费3行动，治愈3点恐惧', reason: inv.horror > 0 ? null : '没有需要治愈的恐惧' })
      },
      performAction(state, inv, move) {
        if (move.rule !== 'dressingRoomHeal') return false
        inv.horror = Math.max(0, inv.horror - 3)
        return true
      },
    },
  },
  // 第 92 轮：边界之外四张古代地点的「团队每轮一次」发现线索行动。
  {
    code: '04175', scope: 'location',
    locationRule: {
      ancientAction: {
        label: '♻️ 把弃牌堆的一张弱点洗回牌库：发现本地点的 2 个线索（团队每轮一次）',
        available(state, inv) { return (inv.discard || []).some(isWeaknessCode) },
        perform(state, inv, api, location) {
          if (!teamOnce(state, '04175clue', 'round')) { api.info?.('本轮的团队次数已用完。'); return false }
          const candidates = [...new Set((inv.discard || []).filter(isWeaknessCode))]
          const chosen = candidates.length === 1 ? candidates[0] : api.choose({
            kind: 'card', source: '04175', seat: inv.seat,
            prompt: '选择一张要洗回牌库的弱点卡牌。',
            options: candidates.map(code => ({ id: code, label: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code })),
          })
          const index = (inv.discard || []).indexOf(chosen)
          if (index < 0) return false
          inv.discard.splice(index, 1)
          inv.deck.push(chosen)
          shuffleDeckWith(state, inv, api)
          discoverAt(state, api, inv, location, 2)
          return true
        },
      },
    },
  },
  {
    code: '04177', scope: 'location',
    locationRule: {
      ancientAction: {
        label: '🌑 在一个敌人上放置 1 个毁灭：发现本地点的 2 个线索（团队每轮一次）',
        available(state) { return state.enemies.some(enemy => !enemy.defeated) },
        perform(state, inv, api, location) {
          if (!teamOnce(state, '04177clue', 'round')) { api.info?.('本轮的团队次数已用完。'); return false }
          const candidates = state.enemies.filter(enemy => !enemy.defeated)
          if (!candidates.length) return false
          const chosenId = candidates.length === 1 ? candidates[0].id : api.choose({
            kind: 'enemy', source: '04177', seat: inv.seat, prompt: '选择要放置 1 个毁灭标记的敌人。',
            options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
          })
          const enemy = candidates.find(item => item.id === chosenId)
          if (!enemy || !api.doomOn?.(enemy, 1)) return false
          discoverAt(state, api, inv, location, 2)
          return true
        },
      },
    },
  },
  {
    code: '04178', scope: 'location',
    locationRule: {
      ancientAction: {
        label: '🃏 弃掉你所有手牌：发现本地点的 2 个线索（团队每轮一次）',
        available(state, inv) { return (inv.hand || []).length >= 3 },
        perform(state, inv, api, location) {
          if (!teamOnce(state, '04178clue', 'round')) { api.info?.('本轮的团队次数已用完。'); return false }
          if ((inv.hand || []).length < 3) return false
          inv.discard.push(...inv.hand)
          inv.hand = []
          discoverAt(state, api, inv, location, 2)
          return true
        },
      },
    },
  },
  {
    code: '04184', scope: 'location',
    locationRule: {
      ancientAction: {
        label: '📖 如果你牌库内没有剩余卡牌：发现圣林所有的线索',
        available(state, inv) { return (inv.deck || []).length === 0 },
        perform(state, inv, api, location) {
          if ((inv.deck || []).length > 0) return false
          discoverAt(state, api, inv, location, location.clues || 0)
          return true
        },
      },
    },
  },
// 第 91 轮：边界之外的大教堂与查普尔特佩克公园。
  {
    code: '04169', scope: 'location',
    locationRule: {
      actions({ moves }) {
        moves.push({ action: 'scenarioAction', rule: 'studyCathedral', label: '📖 受到 1 点恐惧：抽 2 张牌' })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'studyCathedral') return false
        api.horror(inv.seat, 1)
        api.drawCards(inv.seat, 2)
        return true
      },
    },
  },
  {
    code: '04170', scope: 'location',
    locationRule: {
      onTestFail(state, loc, api, inv, result) {
        if (!result?.success && result?.skill === 'willpower') api.horror(inv.seat, 1)
      },
    },
  },
  // 第 90 轮：黑星升起的礼拜堂 / 修道院塔楼。
  {
    code: '03296', scope: 'location',
    locationRule: {
      investigationError(state, inv) {
        return (inv.maxSanity || inv.sanity || 0) - (inv.horror || 0) > 3 ? '剩余神智必须为3点或更少' : null
      },
      actions({ moves }) {
        moves.push({ action: 'scenarioAction', rule: 'takeChapelHorror', label: '受到最多3点恐惧' })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'takeChapelHorror') return false
        const amount = Number(api.choose({
          kind: 'harm', source: '03296', seat: inv.seat, prompt: '选择受到多少点恐惧。',
          options: Array.from({ length: 4 }, (_, value) => ({ id: String(value), label: `${value}点恐惧` })),
        }))
        if (amount) api.horror(inv.seat, amount)
        return true
      },
    },
  },
  {
    code: '03298', scope: 'location',
    locationRule: {
      investigationError(state, inv) { return inv.hand.length ? '必须没有手牌' : null },
      actions({ inv, moves }) {
        moves.push({ action: 'scenarioAction', rule: 'discardTowerCards', label: '弃掉最多3张手牌',
          reason: inv.hand.length ? null : '需要至少 1 张手牌' })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'discardTowerCards') return false
        if (!inv.hand.length) return false
        const amount = Number(api.choose({
          kind: 'discard', source: '03298', seat: inv.seat, prompt: '选择弃掉多少张手牌。',
          options: Array.from({ length: Math.min(3, inv.hand.length) + 1 }, (_, value) =>
            ({ id: String(value), label: `${value}张` })),
        }))
        if (amount) api.discardChosen(inv.seat, amount, '03298')
        return true
      },
    },
  },
  // 第 89 轮：邪秽誓约的丹尼尔（先生）与附身形态。
  {
    code: '03182a', scope: 'storyAsset',
    assetRule: { daniel: true },
    // 卡面两条强制：恐惧未全部分配给他 → 受到 1 点伤害；离场 → 从游戏中移除。
    horrorOverflowDamage: 1,
    removeFromGameOnLeave: true,
  },
  {
    code: '03182b', scope: 'enemy',
    enemyRule: { prey: 'highestCombat' },
    enemyScript: { danielPossessed: true },
  },
  // 第 88 轮：课外活动的炼金试剂 / 爵士乐 / 实验体身份。
  {
    code: '02059', scope: 'storyAsset',
    assetRule: { reagent: true },
  },
  {
    code: '02060', scope: 'storyAsset',
    assetRule: { jazz: true },
  },
  // 第 87 轮：幽嘶深渊的坍塌通道、被遗弃的仪式场所与两张遭遇。
  {
    code: '04293', scope: 'location',
    locationRule: {
      beforeExplore(state, inv, api) {
        if (api.hasSupply?.(inv.seat, 'pickaxe') ?? api.checkSupplies?.(inv.seat, 'pickaxe')) return true
        const location = state.locations.find(item => item.id === inv.location)
        if (location) location.doom = (location.doom || 0) + 1
        api.info?.(`坍塌的通道：${inv.name} 没有鹤嘴锄，此地点放置 1 点毁灭。`)
        return true
      },
    },
  },
  {
    code: '04294', scope: 'location',
    locationRule: {
      shroudModifier(state) { return Math.max(1, Number(state.scenarioFlags?.depthLevel || 1)) },
    },
  },
  {
    code: '04300', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'agility', 1 + Math.max(1, Number(state.scenarioFlags?.depthLevel || 1)), result => {
        if (!result.success) api.damage(inv.seat, 2)
      })
      return false
    },
  },
  {
    code: '04301', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'willpower', 1 + Math.max(1, Number(state.scenarioFlags?.depthLevel || 1)), result => {
        if (!result.success) api.horror(inv.seat, 2)
      })
      return false
    },
  },
  // 第 86 轮：克苏鲁的帷幕（curtainCall）门厅/后台揭示与剧院离开伤害。
  {
    code: '03050', scope: 'location',
    locationRule: {
      actions({ moves }) {
        moves.push({ action: 'scenarioAction', rule: 'lobbyDraw', actions: 2, label: '花费2行动，抽取3张牌' })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'lobbyDraw') return false
        api.drawCards(inv.seat, 3)
        return true
      },
      onReveal(state, location, api) {
        const pool = state.scenarioFlags.lobbyDoorways || []
        for (let count = 0; count < 2 && pool.length; count++) {
          const id = pool.splice(Math.floor(api.random() * pool.length), 1)[0]
          api.place(id)
        }
      },
    },
  },
  {
    code: '03052', scope: 'location', flags: { backstage: true },
    locationRule: {
      onReveal(state, location, api) {
        const pool = state.scenarioFlags.backstageDoorways || []
        for (let count = 0; count < 2 && pool.length; count++) {
          const id = pool.splice(Math.floor(api.random() * pool.length), 1)[0]
          api.place(id)
        }
      },
    },
  },
  {
    code: '03051', scope: 'location',
    locationRule: {
      onLeave: { effect(state, loc, api, inv) { if (inv.location === 'theatre') api.damage(inv.seat, 2) } },
    },
  },
  // 第 85 轮：最后之王的五名贵宾（storyAsset）。
  {
    code: '03076a', scope: 'storyAsset',
    assetRule: { parley: { skill: 'intellect', difficulty: 3, label: '与康斯坦丝谈判（智识3）' } },
  },
  {
    code: '03077', scope: 'storyAsset',
    assetRule: {
      parley: {
        skill: 'intellect', difficulty: 2, label: '与乔丹谈判（需10资源，智识2）',
        shortfall(state, inv) { return inv.resources < 10 ? `需要 10 个资源（当前 ${inv.resources}）` : null },
      },
    },
  },
  {
    code: '03078', scope: 'storyAsset',
    assetRule: {
      parley: {
        skill: 'willpower', difficulty: 2, label: '与春子谈判（需6张手牌，意志2）',
        shortfall(state, inv) { return inv.hand.length < 6 ? `需要 6 张手牌（当前 ${inv.hand.length}）` : null },
      },
    },
  },
  {
    code: '03079', scope: 'storyAsset',
    assetRule: { parley: { skill: 'willpower', difficulty: 3, label: '与塞巴斯蒂安谈判（意志3）' } },
  },
  {
    code: '03080', scope: 'storyAsset',
    assetRule: { parley: { label: '聆听阿什莉演唱，取得1个线索', actions: 2, autoSuccess: true } },
  },
  // 第 83 轮：邪秽誓约的六个「记忆事实」地点与医务室。
  {
    code: '03172', scope: 'location',
    locationRule: {
      entryError(state, location) {
        if (location.revealed || state.actIndex >= 1) return null
        return '通往厨房的门锁住了。你不能进入厨房。'
      },
      actions({ state, location, moves }) {
        if ((state.scenarioFlags.remembered || []).includes('setAFireInTheKitchen')) return
        moves.push({ action: 'scenarioAction', rule: 'kitchenFire', label: '检定意志（2），在厨房放火',
          reason: (location?.clues || 0) === 0 ? null : `需要先取走厨房的线索（还剩 ${location.clues || 0} 个）` })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'kitchenFire') return false
        api.test(inv.seat, 'willpower', 2, result => { if (result.success) rememberFact(state, 'setAFireInTheKitchen') })
        return true
      },
    },
  },
  {
    code: '03175', scope: 'location',
    locationRule: {
      actions({ state, inv, location, moves }) {
        if ((state.scenarioFlags.remembered || []).includes('incitedAFightAmongstThePatients')) return
        moves.push({ action: 'scenarioAction', rule: 'yardFight', label: '受到 1 点伤害，煽动病人互相攻击',
          reason: (location?.clues || 0) > 0 ? `需要先取走院子的线索（还剩 ${location.clues || 0} 个）`
            : inv.damage < inv.maxHealth ? null : '伤害已满，无法再承受 1 点伤害' })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'yardFight') return false
        api.damage(inv.seat, 1)
        rememberFact(state, 'incitedAFightAmongstThePatients')
        return true
      },
    },
  },
  {
    code: '03176', scope: 'location',
    locationRule: {
      entryError(state, location) {
        if (location.revealed || state.actIndex >= 1) return null
        return '通往花园的门锁住了。你不能进入花园。'
      },
      actions({ state, inv, location, moves }) {
        if (!(state.scenarioFlags.remembered || []).includes('distractedTheGuards')) {
          moves.push({ action: 'scenarioAction', rule: 'gardenGuards', label: '检定敏捷（2），分散守卫注意力',
            reason: (location?.clues || 0) === 0 ? null : `需要先取走花园的线索（还剩 ${location.clues || 0} 个）` })
        }
        if (originalOf(state.acts[state.actIndex] || {}) === '03167') {
          moves.push({ action: 'scenarioAction', rule: 'escapeGarden', label: '从花园撤退',
            reason: state.enemies.some(enemy => enemy.location === inv.location && !enemy.exhausted)
              ? '同地点还有未横置的敌人，需要先躲避或击败' : null })
        }
      },
      performAction(state, inv, move, api) {
        if (move.rule === 'gardenGuards') {
          api.test(inv.seat, 'agility', 2, result => { if (result.success) rememberFact(state, 'distractedTheGuards') })
          return true
        }
        if (move.rule === 'escapeGarden') { api.resign(inv.seat); return true }
        return false
      },
    },
  },
  {
    code: '03179', scope: 'location',
    locationRule: {
      actions({ state, moves }) {
        if ((state.scenarioFlags.remembered || []).includes('releasedADangerousPatient')) return
        moves.push({ action: 'scenarioAction', rule: 'occupiedCell', label: '检定战斗（2），释放危险病人' })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'occupiedCell') return false
        api.test(inv.seat, 'combat', 2, result => { if (result.success) rememberFact(state, 'releasedADangerousPatient') })
        return true
      },
    },
  },
  {
    code: '03180', scope: 'location',
    locationRule: {
      actions({ state, moves }) {
        if ((state.scenarioFlags.remembered || []).includes('knowTheGuardsPatrols')) return
        moves.push({ action: 'scenarioAction', rule: 'drearyCell', label: '检定智识（2），获知守卫巡逻路线' })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'drearyCell') return false
        api.test(inv.seat, 'intellect', 2, result => { if (result.success) rememberFact(state, 'knowTheGuardsPatrols') })
        return true
      },
    },
  },
  {
    code: '03181', scope: 'location',
    locationRule: {
      actions({ state, moves }) {
        if ((state.scenarioFlags.remembered || []).includes('recalledTheWayOut')) return
        moves.push({ action: 'scenarioAction', rule: 'familiarCell', label: '检定意志（等同恐惧），想起出去的路' })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'familiarCell') return false
        api.test(inv.seat, 'willpower', inv.horror, result => { if (result.success) rememberFact(state, 'recalledTheWayOut') })
        return true
      },
    },
  },
  {
    code: '03174', scope: 'location',
    locationRule: {
      actions({ state, moves }) {
        if (state.scenarioFlags.infirmaryRound === state.round) return
        moves.push({ action: 'scenarioAction', rule: 'infirmary', label: '使用医务室' })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'infirmary') return false
        state.scenarioFlags.infirmaryRound = state.round
        const answer = api.choose({
          kind: 'location', source: '03174', seat: inv.seat, prompt: '选择医务室的治疗。',
          options: [{ id: 'damage', label: '治疗 1 伤害，受到 1 直接恐惧' }, { id: 'horror', label: '治疗 1 恐惧，受到 1 直接伤害' }],
        })
        if (answer === 'damage') {
          inv.damage = Math.max(0, inv.damage - 1)
          api.directHorror(inv.seat, 1)
        } else {
          inv.horror = Math.max(0, inv.horror - 1)
          api.directDamage(inv.seat, 1)
        }
        return true
      },
    },
  },
  {
    code: '03091', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    treacheryRule: {
      attachmentAction(state, inv, location, attachmentIndex) {
        return {
          action: 'encounterAction', actionKind: 'investigate', rule: 'clearSpiresOfCarcosa',
          locationId: location.id, attachmentIndex, actions: 1,
          label: '调查卡尔克萨尖柱：成功后移除地点上的 1 个毁灭',
          reason: (location.doom || 0) > 0 ? null : '此地点上没有毁灭',
        }
      },
    },
    encounterResolve(state, inv, card, api, { location }) {
      location.doom = (location.doom || 0) + 2
      location.attachments ||= []
      location.attachments.push({
        id: `spires:${state.round}:${state.moveCount}:${location.attachments.length}`,
        code: '03091', originalCode: '03091',
      })
      return true
    },
  },
  {
    code: '03092', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const doom = state.doom + state.locations.reduce((sum, location) => sum + (location.doom || 0), 0)
        + state.enemies.reduce((sum, enemy) => sum + (enemy.doom || 0), 0)
      if (!doom) {
        api.drawEncounter(inv.seat)
        return false
      }
      api.test(inv.seat, 'willpower', doom, result => {
        if (!result.success) api.discardRandom(inv.seat, 2)
      })
      return false
    },
  },
  {
    code: '03094', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    treacheryRule: {
      attachmentAction(state, inv, location, attachmentIndex) {
        return {
          action: 'encounterAction', rule: 'discardSpiritsTorment',
          locationId: location.id, attachmentIndex, actions: 1,
          label: '将 1 个线索放回地点，弃掉怨灵作祟',
          reason: inv.clues > 0 ? null : '需要花费 1 个线索',
        }
      },
    },
    encounterResolve(state, inv, card, api, { location }) {
      location.attachments ||= []
      location.attachments.push({
        id: `torment:${state.round}:${state.moveCount}:${location.attachments.length}`,
        code: '03094', originalCode: '03094',
      })
      location.haunted = true
      return true
    },
  },
  {
    code: '03097', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const code = card?.originalCode || card?.code
      const possessed = state.enemies.filter(enemy => enemy.traits?.includes('Possessed'))
      if (!possessed.length) {
        api.drawEncounter(inv.seat)
        return false
      }
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        // 最近的附身敌人：按连接图距离取最小，并列时由玩家选择。
        const distances = new Map()
        const queue = [inv.location]
        distances.set(inv.location, 0)
        while (queue.length) {
          const current = queue.shift()
          const location = state.locations.find(candidate => candidate.id === current)
          for (const next of location?.connections || []) {
            if (distances.has(next) || !state.locations.some(candidate => candidate.id === next)) continue
            distances.set(next, distances.get(current) + 1)
            queue.push(next)
          }
        }
        const ranked = possessed.map(enemy => ({ enemy, distance: distances.get(enemy.location) ?? Infinity }))
        const nearest = Math.min(...ranked.map(item => item.distance))
        const ties = ranked.filter(item => item.distance === nearest)
        const picked = ties.length === 1 ? ties[0].enemy : state.enemies.find(enemy => enemy.id === api.choose({
          kind: 'enemy', source: code, seat: inv.seat,
          prompt: '选择最近的附身敌人（距离相同）。',
          options: ties.map(item => ({ id: item.enemy.id, label: item.enemy.name })),
        })) || ties[0].enemy
        picked.exhausted = false
        // 逐地点移动：每次沿最短路前进一个连接地点。
        for (let guard = 0; guard < 64 && picked.location !== inv.location; guard++) {
          const step = shortestNextStep(state, picked.location, inv.location)
          if (!step || step === picked.location) break
          api.moveEnemy(picked, step)
        }
        api.engage(picked, inv.seat)
        api.attack(picked, inv)
      })
      return false
    },
  },
  {
    code: '03100', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      let moved = 0
      for (const enemy of state.enemies.filter(enemy => enemy.traits?.includes('Cultist'))) {
        const location = state.locations.find(candidate => candidate.id === enemy.location)
        if (location?.clues) {
          location.clues--
          enemy.clues = (enemy.clues || 0) + 1
          moved++
        }
        enemy.kingsEdictRound = state.round
      }
      if (!moved) api.drawEncounter(inv.seat)
      return false
    },
  },
  {
    code: '03101', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      state.fogMod = (state.fogMod || 0) + 1
      state.scenarioFlags ||= {}
      state.scenarioFlags.decayRound = state.round
      return true
    },
  },
  {
    code: '03102', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      const location = state.locations.find(candidate => candidate.id === inv.location)
      // X = 所在地点的隐藏值（含本回合的隐藏值修正，与调查检定读同一份数值）。
      const x = Math.max(0, (location?.shroud || 0) + (location?.shroudMod || 0))
      const isItem = candidate => ALL_CARDS[candidate]?.traits?.includes('Item')
      const assets = inv.assets.filter(asset => isItem(asset.code)
        && !asset.cannotLeavePlay && !ALL_CARDS[asset.code]?.permanent)
      const handItems = () => inv.hand.map((cardCode, index) => ({ cardCode, index }))
        .filter(entry => isItem(entry.cardCode))
      const totalItemsCost = () => assets.reduce((sum, asset) => sum + (ALL_CARDS[asset.code]?.cost || 0), 0)
        + handItems().reduce((sum, entry) => sum + (ALL_CARDS[entry.cardCode]?.cost || 0), 0)
      api.info?.(`锈蚀：需要弃掉印刷费用合计至少 ${x} 点的[[道具]]（场上 ${assets.length} 张，手牌 ${handItems().length} 张）。`)
      if (x <= 0 || totalItemsCost() < x) {
        // 弃不够时不能只弃一部分充数：本次效果没有弃掉任何卡牌 → 涌动。
        api.info?.('锈蚀：没有足够的道具可弃，本次效果没有弃掉任何卡牌，本卡获得涌动。')
        api.drawEncounter(inv.seat)
        return false
      }
      let remaining = x
      let discarded = 0
      while (remaining > 0) {
        const currentHandItems = handItems()
        const options = [
          ...assets.map(asset => ({ id: `asset:${asset.id}`, cost: ALL_CARDS[asset.code]?.cost || 0,
            label: `${ALL_CARDS[asset.code]?.nameZh || asset.code}（${ALL_CARDS[asset.code]?.cost || 0} 资源，场上）` })),
          ...currentHandItems.map(entry => ({ id: `hand:${entry.index}`, cost: ALL_CARDS[entry.cardCode]?.cost || 0,
            label: `${ALL_CARDS[entry.cardCode]?.nameZh || entry.cardCode}（${ALL_CARDS[entry.cardCode]?.cost || 0} 资源，手牌）` })),
        ]
        if (!options.length) break
        const choice = api.choose({
          kind: 'discard-asset', source: code, seat: inv.seat,
          prompt: `锈蚀：选择弃掉一张道具（还需合计 ${remaining} 点印刷费用）。`,
          options: options.map(option => ({ id: option.id, label: option.label })),
        })
        const picked = options.find(option => option.id === choice) || options[0]
        if (String(picked.id).startsWith('hand:')) {
          const index = Number(String(picked.id).slice(5))
          const [cardCode] = inv.hand.splice(index, 1)
          if (cardCode) inv.discard.push(cardCode)
        } else {
          const assetId = String(picked.id).slice(6)
          const asset = assets.find(item => item.id === assetId)
          if (asset) {
            assets.splice(assets.indexOf(asset), 1)
            api.discardAsset(inv.seat, asset.id)
          }
        }
        remaining -= picked.cost
        discarded++
      }
      if (!discarded) {
        api.info?.('锈蚀：本次效果没有弃掉任何卡牌，本卡获得涌动。')
        api.drawEncounter(inv.seat)
      }
      return false
    },
  },
  {
    code: '01162', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    name: '攫噬之手',
    text: '显现 - 检定[agility](3)。你检定失败且每低于难度 1 点，受到 1 点伤害。',
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'agility', 3, result => {
        if (result.success) return
        api.damage(inv.seat, Math.max(0, result.difficulty - result.value))
      })
      return false
    },
  },
  {
    code: '03224', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        let enemyCode = null
        while (state.encounterDeck.length) {
          const discarded = state.encounterDeck.pop()
          state.encounterDiscard.push(discarded)
          if (ALL_CARDS[originalOf(discarded)]?.type === 'enemy') { enemyCode = discarded; break }
        }
        const enemies = state.encounterDiscard.filter(candidate => ALL_CARDS[originalOf(candidate)]?.type === 'enemy')
        if (!enemyCode || !enemies.length) { api.horror(inv.seat, 1); return }
        const choice = api.choose({
          kind: 'encounter', source: code, seat: inv.seat,
          prompt: `致命运数：选择抽取刚弃掉的「${ALL_CARDS[originalOf(enemyCode)]?.nameZh || enemyCode}」，或让它攻击你。`,
          options: [{ id: 'draw', label: `抽取「${ALL_CARDS[originalOf(enemyCode)]?.nameZh || enemyCode}」` },
            { id: 'attack', label: `让刚弃掉的「${ALL_CARDS[originalOf(enemyCode)]?.nameZh || enemyCode}」攻击你` }],
        })
        if (choice === 'draw') {
          state.encounterDiscard.splice(state.encounterDiscard.lastIndexOf(enemyCode), 1)
          state.encounterDeck.push(enemyCode)
          api.drawEncounter(inv.seat)
          return
        }
        // 攻击你的必须是刚弃掉的那张敌人，不能从弃牌堆改选。
        api.attackFromDiscard(enemyCode, inv.seat)
      })
      return false
    },
  },
  {
    code: '03104', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const stranger = state.enemies.some(enemy => originalOf(enemy) === '03059')
      api.test(inv.seat, 'willpower', stranger ? 4 : 2, result => {
        if (!result.success) (stranger ? api.directHorror : api.horror)(inv.seat, 2)
      })
      return false
    },
  },
  {
    code: '03105', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const manCode = pallidMaskCode()
      const stranger = state.enemies.find(enemy => originalOf(enemy) === manCode)
      if (stranger) {
        for (const target of state.investigators.filter(item => !item.defeated && !item.resigned)) {
          api.attack(stranger, target)
        }
      } else {
        // 不在场：在承受者的牌库/弃牌堆与全部场外区域找出他，抽取并混洗承受者牌库。
        const bearerId = state.campaign?.records?.pallidMaskBearer
        const owner = state.investigators.find(item => item.id === bearerId)
        const zones = state.scenarioZones || {}
        const piles = [owner?.deck, owner?.discard, zones.setAside, state.removedFromGame,
          state.encounterDeck, state.encounterDiscard].filter(Array.isArray)
        let found = false
        for (const pile of piles) {
          const index = pile.indexOf(manCode)
          if (index < 0) continue
          pile.splice(index, 1)
          found = true
          break
        }
        if (found) {
          api.spawn(manCode, inv.location)
          if (owner) api.shuffleDeck(owner.seat)
        }
      }
      return false
    },
  },
  {
    code: '03260', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        const amount = Math.max(0, result.difficulty - result.value)
        const recipients = [{ id: `inv:${inv.seat}`, kind: 'investigator', name: inv.name,
          capacity: Math.max(0, (inv.maxSanity || 0) - inv.horror), assigned: 0 },
        ...inv.assets.flatMap(asset => {
          const sanity = ALL_CARDS[asset.code]?.sanity || 0
          return sanity > (asset.horror || 0) ? [{ id: `asset:${asset.id}`, kind: 'asset',
            assetId: asset.id, name: ALL_CARDS[asset.code]?.nameZh || asset.code,
            capacity: sanity - (asset.horror || 0), assigned: 0 }] : []
        })]
        for (let point = 0; point < amount; point++) {
          const available = recipients.filter(recipient => recipient.assigned < recipient.capacity)
          if (!available.length) break
          const minimum = Math.min(...available.map(recipient => recipient.assigned))
          const even = available.filter(recipient => recipient.assigned === minimum)
          const picked = chooseEntryOption(api, {
            kind: 'horror', source: '03260', seat: inv.seat,
            prompt: `墙中之眼：分配第${point + 1}/${amount}点恐惧（必须尽量平均）。`,
          }, even, recipient => `${recipient.name}（已分配${recipient.assigned}）`)
          picked.assigned++
        }
        for (const recipient of recipients.filter(candidate => candidate.assigned)) {
          if (recipient.kind === 'investigator') api.horror(inv.seat, recipient.assigned)
          else api.horrorAsset(inv.seat, recipient.assetId, recipient.assigned)
        }
      })
      return false
    },
  },
  {
    code: '03261', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    treacheryRule: {
      encounterAction(state, inv, owner, threat) {
        return {
          action: 'encounterAction', rule: 'lookBehindYou', threatId: threat.id,
          threatOwnerSeat: owner.seat, actions: 1,
          label: `查看${owner.seat === inv.seat ? '' : owner.name + '的'}「身后暗影」背后`,
        }
      },
    },
    encounterResolve(state, inv, card, api) {
      if ((inv.threat || []).some(threat => originalOf(threat) === '03261')) return false
      api.threat(inv.seat, '03261')
      return true
    },
  },
  {
    code: '03262', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api, { location }) {
      location.attachments ||= []
      if (location.attachments.some(attachment =>
        originalOf(typeof attachment === 'string' ? { code: attachment } : attachment) === '03262')) {
        api.drawEncounter(inv.seat)
        return false
      }
      location.attachments.push({ id: `pit:${state.round}:${state.moveCount}`, code: '03262', originalCode: '03262' })
      location.shroudMod = (location.shroudMod || 0) + 1
      return true
    },
  },
  {
    code: '03302', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const deck = state.scenarioFlags?.agendaDecks?.a
      const amount = state.scenarioFlags?.openPath || state.actIndex >= 2
        ? 3 : Math.min(3, Number(deck?.index || 0) + 1)
      api.test(inv.seat, 'agility', 3, result => {
        if (result.success) return
        api.damage(inv.seat, amount)
        api.loseActions(inv.seat, amount)
      })
      return false
    },
  },
  {
    code: '03303', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const deck = state.scenarioFlags?.agendaDecks?.c
      const amount = state.scenarioFlags?.openPath || state.actIndex >= 2
        ? 3 : Math.min(3, Number(deck?.index || 0) + 1)
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        api.horror(inv.seat, amount)
        api.discardChosen(inv.seat, amount, '03303')
      })
      return false
    },
  },
  {
    code: '03337', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const sanity = Math.max(0, (inv.maxSanity || 0)
        + inv.assets.reduce((sum, asset) => sum + (asset.sanityModifier || 0), 0))
      api.test(inv.seat, 'willpower', Math.max(0, sanity - inv.horror) === 0 ? 5 : 3, result => {
        if (!result.success) api.damage(inv.seat, inv.horror > 2 * sanity ? 4 : 2)
      })
      return false
    },
  },
  {
    code: '03338', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const code = card?.originalCode || card?.code
      const x = inv.horror || 0
      // X=0：目标已满足，没有「弃牌或受 2 恐惧」的选择。
      if (x <= 0) return false
      let total = 0
      let discarded = 0
      while (total < x) {
        const options = [
          ...inv.hand.map((code, index) => ({ id: `h${index}`, kind: 'hand', code,
            label: `${api.cardName(code)}（${ALL_CARDS[code]?.cost || 0}资源）`, cost: ALL_CARDS[code]?.cost || 0 })),
          ...inv.assets.map((asset, index) => ({ id: `a${index}`, kind: 'asset', code: asset.code, asset,
            label: `${api.cardName(asset.code)}（${ALL_CARDS[asset.code]?.cost || 0}资源）`, cost: ALL_CARDS[asset.code]?.cost || 0 })),
        ]
        if (!options.length) break
        const answer = options.length === 1 ? options[0].id : api.choice({
          kind: 'card', source: code, seat: inv.seat,
          prompt: `弃掉游戏区域/手牌中的卡牌，直到印刷费用合计至少 ${x}（当前 ${total}）。`,
          options: options.map(option => ({ id: option.id, label: option.label })),
        })
        const picked = options.find(option => option.id === answer) || options[0]
        if (picked.kind === 'hand') api.discardFromHand(inv.seat, picked.code)
        else api.discardAsset(inv.seat, picked.asset)
        total += picked.cost
        discarded += 1
      }
      if (discarded === 0) api.horror(inv.seat, 2)
      return false
    },
  },
  {
    code: '03339', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const sanity = Math.max(0, (inv.maxSanity || 0)
        + inv.assets.reduce((sum, asset) => sum + (asset.sanityModifier || 0), 0))
      if (inv.horror >= sanity) api.addDoom(2)
      return false
    },
  },
  {
    code: '03093', scope: 'enemy', implemented: true,
    enemyScript: {
      encounterAction(state, inv, enemy) {
        return {
          action: 'encounterAction', actionKind: 'parley', rule: 'parleyPoltergeist',
          enemyId: enemy.id, actions: 1, label: '谈判骚灵（智识3）：成功对其造成1点伤害',
        }
      },
      onDamageAllowed(state, enemy, source, seat) {
        if (source === 'encounter') return true
        const inv = state.investigators[seat]
        const sourceCard = inv?.assets.find(asset => asset.id === source)
        const list = (ALL_CARDS[originalOf(sourceCard)]?.traits || sourceCard?.traits || [])
          .map(trait => String(trait).toLowerCase())
        return list.some(trait => ['spell', 'relic'].includes(trait))
      },
    },
  },
  {
    code: '03095', scope: 'enemy', implemented: true,
    enemyScript: {
      onEngage(state, enemy, inv, api) {
        api.damage(inv.seat, 1)
        api.damageEnemy(enemy.id, 1, inv.seat, 'encounter')
      },
    },
  },
  {
    code: '03098', scope: 'enemy', implemented: true,
    enemyScript: {
      onSpawnLocation(state, code, fallback, seat, api) {
        const revealed = state.locations.filter(location => location.revealed)
        if (!revealed.length) return null
        const most = Math.max(...revealed.map(location => location.clues || 0))
        return chooseEntryOption(api, {
          kind: 'spawn', source: code, seat: seat ?? state.campaign.leadSeat,
          prompt: '选择线索最多的已揭示地点生成狂徒。',
        }, revealed.filter(location => (location.clues || 0) === most))?.id || null
      },
      onSpawn(state, enemy, api) {
        const location = state.locations.find(candidate => candidate.id === enemy.location)
        if (location?.clues > 0) {
          location.clues--
          enemy.clues = (enemy.clues || 0) + 1
        }
      },
      onDefeated(state, enemy, api) {
        if (!enemy.clues) return false
        const inv = state.investigators[enemy.defeatedBy]
        if (inv) api.gainClues(inv.seat, enemy.clues)
        enemy.clues = 0
        return false
      },
    },
  },
  {
    code: '03258', scope: 'enemy', implemented: true,
    enemyScript: {
      encounterAction(state, inv, enemy) {
        if (state.scenarioFlags?.catacombsLecturerUsed) return null
        return {
          action: 'encounterAction', actionKind: 'parley', rule: 'parleyLecturer',
          enemyId: enemy.id, actions: 1, label: '谈判地下墓穴讲师（智识4）',
        }
      },
      onSpawnLocation(state, code, fallback, seat, api) {
        const origin = state.investigators[seat]?.location || fallback
        const unrevealed = state.locations.filter(location => !location.revealed)
        if (!unrevealed.length) return null
        const nearest = Math.min(...unrevealed.map(location => entryDistance(state, origin, location.id)))
        return chooseEntryOption(api, {
          kind: 'spawn', source: code, seat: seat ?? state.campaign.leadSeat,
          prompt: '选择最近的未揭示地点生成地下墓穴讲师。',
        }, unrevealed.filter(location => entryDistance(state, origin, location.id) === nearest))?.id || null
      },
    },
  },
  {
    code: '03259', scope: 'enemy', implemented: true,
    enemyScript: {
      onSpawnLocation(state, code, fallback, seat, api) {
        const humanoids = state.enemies.filter(enemy => (ALL_CARDS[originalOf(enemy)]?.traits || enemy.traits || [])
          .map(trait => String(trait).toLowerCase()).includes('humanoid'))
        const target = chooseEntryOption(api, {
          kind: 'enemy', source: code, seat: seat ?? state.campaign.leadSeat,
          prompt: '选择弃掉的一名类人生物敌人。',
        }, humanoids)
        if (!target) return null
        const location = target.location
        api.discardEnemy(target)
        return location
      },
      onSpawnFailed(state, code, seat, api) {
        if (seat != null) api.drawEncounter(seat)
      },
    },
  },
  {
    code: '03335', scope: 'enemy', implemented: true,
    enemyScript: {
      onSpawnLocation(state, code, fallback) {
        return state.locations.some(location => location.id === 'depthsOfDemhe') ? 'depthsOfDemhe' : fallback
      },
      onLocationWillFlip(state, enemy, location, api) {
        if (enemy.exhausted) return
        const origin = state.locations.find(candidate => candidate.id === enemy.location)
        if (enemy.location === location.id || origin?.connections?.includes(location.id)) {
          for (const inv of state.investigators.filter(candidate => !candidate.defeated && !candidate.resigned
            && candidate.location === location.id)) api.attack(enemy, inv)
        }
      },
    },
  },
  {
    code: '03336', scope: 'enemy', implemented: true,
    enemyScript: {
      onSpawnLocation(state, code, fallback) {
        return state.locations.some(location => location.id === 'bleakPlains') ? 'bleakPlains' : fallback
      },
      onLocationFlipped(state, enemy, location, api) {
        if (!enemy.exhausted && enemy.engagedSeat == null && enemy.location !== location.id) {
          const next = api.stepToward(enemy.location, location.id)
          if (next) api.moveEnemy(enemy, next)
        }
      },
    },
  },
  {
    code: '01163', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        const failedBy = Math.max(0, 3 - result.value)
        if (failedBy > 0) api.horror(inv.seat, failedBy)
      })
      return false
    },
  },
  {
    code: '01166', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      api.addDoom(1)
      api.info?.('🕯️ 远古恶魔：在当前密谋上放置 1 点毁灭。')
      return false
    },
  },
  {
    code: '01167', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'willpower', 4, result => {
        if (result.success) return
        const assets = (inv.assets || []).filter(asset => !asset.isStoryAsset)
        if (!assets.length) { api.damage(inv.seat, 2); return }
        const answer = assets.length === 1 ? assets[0].id : api.choose({
          kind: 'asset', source: '01167', seat: inv.seat,
          prompt: '地窖寒风：选择并弃掉 1 个你控制的支援。',
          options: assets.map(asset => ({ id: asset.id, label: asset.name || asset.code })),
        })
        api.discardAsset(inv.seat, (assets.find(asset => asset.id === answer) || assets[0]).id)
      })
      return false
    },
  },
  {
    code: '01168', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api, { location }) {
      if (!location) return false
      location.fog = (location.fog || 0) + 1
      location.fogCode = '01168'
      location.shroudMod = (location.shroudMod || 0) + 2
      api.info?.(`🌫️ 朦胧之雾附着于「${location.name}」：隐藏值 +2（共 ${location.fog} 张）。`)
      return true
    },
  },
  {
    code: '01171', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      const cultists = state.enemies.filter(enemy => hasTrait(enemy, 'Cultist'))
      const target = [...cultists].sort((left, right) =>
        entryDistance(state, inv.location, left.location) - entryDistance(state, inv.location, right.location))[0]
      if (target) {
        target.doom = (target.doom || 0) + 2
        api.info?.(`🌑 「${target.name}」上放置 2 点毁灭（当前 ${target.doom}）。`)
        return false
      }
      const isCultist = code => {
        const data = ALL_CARDS[code]
        return data?.type === 'enemy' && (data.traits || []).some(trait => String(trait).toLowerCase() === 'cultist')
      }
      let found = null
      const fromDiscard = state.encounterDiscard.findIndex(isCultist)
      if (fromDiscard >= 0) found = state.encounterDiscard.splice(fromDiscard, 1)[0]
      else {
        const fromDeck = state.encounterDeck.findIndex(isCultist)
        if (fromDeck >= 0) found = state.encounterDeck.splice(fromDeck, 1)[0]
      }
      if (found) {
        for (let index = state.encounterDeck.length - 1; index > 0; index--) {
          const swap = Math.floor((api.random?.() ?? 0) * (index + 1))
          ;[state.encounterDeck[index], state.encounterDeck[swap]] = [state.encounterDeck[swap], state.encounterDeck[index]]
        }
        api.spawn(found, inv.location)
        api.info?.('🔍 神秘咏唱：从遭遇牌堆／弃牌堆找到了一个异教徒。')
      }
      return false
    },
  },
  {
    code: '01173', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'agility', 4, result => {
        if (result.success) return
        api.damage(inv.seat, 1)
        api.horror(inv.seat, 1)
        for (const enemy of state.enemies.filter(entry => entry.engagedSeat === inv.seat && !hasTrait(entry, 'Nightgaunt'))) {
          enemy.engagedSeat = null
          const engaged = state.investigators[inv.seat].engaged
          const index = engaged.indexOf(enemy.id)
          if (index >= 0) engaged.splice(index, 1)
        }
        const central = state.locations.find(entry => entry.central)
        if (central && central.id !== inv.location) api.moveInvestigator(inv.seat, central.id)
        else api.info?.('没有可退往的中心地点。')
      })
      return false
    },
  },
  {
    code: '01174', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      // 上锁的门：附属到线索最多且没有锁的地点；引擎已负责禁止调查与「破门」行动。
      const candidates = state.locations.filter(entry => !entry.locked)
      if (!candidates.length) { api.info?.('没有可附属上锁的门的地点。'); return false }
      const maxClues = Math.max(...candidates.map(entry => entry.clues || 0))
      const pool = candidates.filter(entry => (entry.clues || 0) === maxClues)
      const chosenId = pool.length === 1 ? pool[0].id : api.choose({
        kind: 'target', source: code, seat: inv.seat,
        prompt: '上锁的门：选择线索最多且没有锁的地点。',
        options: pool.map(entry => ({ id: entry.id, label: `${entry.name}（线索 ${entry.clues || 0}）` })),
      })
      const chosen = pool.find(entry => entry.id === chosenId) || pool[0]
      chosen.locked = true
      chosen.lockedDoorCode = code
      api.info?.(`🔒 「上锁的门」封锁了「${chosen.name}」。`)
      return true
    },
  },
  {
    code: '01178', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      // 提供力量：险境。抽 2 张牌并放 2 点毁灭，或受到 2 点恐惧。
      const answer = api.choose({
        kind: 'treachery', source: code, seat: inv.seat, peril: true,
        prompt: '提供力量：抽 2 张牌并放 2 点毁灭，或受到 2 点恐惧。',
        options: [{ id: 'horror', label: '受到 2 点恐惧' }, { id: 'power', label: '抽 2 张牌并放置 2 点毁灭' }],
      })
      if (answer === 'power') { api.drawCards(inv.seat, 2); api.addDoom(2) }
      else api.horror(inv.seat, 2)
      return false
    },
  },
  {
    code: '04076', scope: 'treachery', implemented: true,
    threatAction: { rule: 'clearOvergrowth', label: '清除疯狂生长', skills: ['combat', 'intellect'], difficulty: 4, target: 'location', skillLabels: { combat: '检定战斗(4)清除疯狂生长', intellect: '检定智识(4)清除疯狂生长' } },
    encounterResolve(state, inv, card, api, { location }) {
      if (!location) return false
      if ((location.attachments || []).some(item => originalOf(item) === '04076')) {
        api.drawEncounter(inv.seat)
        return false
      }
      location.attachments ||= []
      location.attachments.push({ id: `overgrowth:${state.round}:${location.id}`, code: '04076', originalCode: '04076' })
      api.info?.('疯狂生长附属到此地点：此处不能探索。')
      return true
    },
  },
  {
    code: '04080', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'agility', 3, result => {
        if (result.success) return
        const allies = inv.assets.filter(asset => hasTrait(asset, 'Ally'))
        const options = [{ id: 'damage', label: '受到 1 点直接伤害（若未中毒则中毒）' }]
        if (allies.length) options.unshift({ id: 'ally', label: '对一个盟友支援造成 5 点伤害' })
        const answer = api.choose({
          kind: 'harm', source: '04080', seat: inv.seat,
          prompt: '毒蛇噬咬：选择承受 5 点盟友伤害，或 1 点直接伤害（并可能中毒）。',
          options,
        })
        if (answer === 'ally' && allies.length) {
          const allyId = api.choose({
            kind: 'asset', source: '04080', seat: inv.seat,
            prompt: '选择受到 5 点伤害的盟友支援。',
            options: allies.map(asset => ({ id: asset.id, label: ALL_CARDS[originalOf(asset)]?.nameZh || asset.name || asset.code })),
          })
          const target = allies.find(asset => asset.id === allyId) || allies[0]
          api.damageAsset(inv.seat, target.id, 5)
          return
        }
        api.directDamage(inv.seat, 1)
        const poisoned = (inv.threat || []).some(item => originalOf(item) === '04102') || inv.poisoned === true
        if (!poisoned) api.poison(inv.seat)
      })
      return false
    },
  },
  {
    code: '04081', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        const failedBy = Math.max(0, 3 - result.value)
        for (let index = 0; index < failedBy; index++) api.horror(inv.seat, 1)
        if (!(inv.threat || []).some(item => originalOf(item) === '04081')) {
          api.threat(inv.seat, '04081', { forcedEndTurnDiscard: true })
        }
      })
      return false
    },
  },
  {
    code: '04082', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      const answer = api.choose({
        kind: 'team', source: '04082', seat: inv.seat, peril: true,
        prompt: '补给短缺：全队选择一项。',
        options: [
          { id: 'resources', label: '每位调查员失去 2 资源' },
          { id: 'damage', label: '每位调查员受到 1 点伤害' },
          { id: 'asset', label: '每位调查员弃掉自己控制的一个支援' },
        ],
      })
      for (const target of state.investigators.filter(item => !item.defeated && !item.resigned)) {
        if (answer === 'resources') target.resources = Math.max(0, (target.resources || 0) - 2)
        else if (answer === 'damage') api.damage(target.seat, 1)
        else if (target.assets.length) {
          const picked = api.choose({
            kind: 'asset', source: '04082', seat: target.seat,
            prompt: `${target.name}：选择弃掉自己控制的一个支援。`,
            options: target.assets.map(asset => ({ id: asset.id, label: ALL_CARDS[originalOf(asset)]?.nameZh || asset.name || asset.code })),
          })
          const chosen = target.assets.find(asset => asset.id === picked) || target.assets[0]
          api.discardAsset(target.seat, chosen.id)
        }
      }
      return false
    },
  },
  {
    code: '04087', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      const harm = seat => {
        const target = state.investigators[seat]
        const allies = target.assets.filter(asset => hasTrait(asset, 'Ally')).length
        api.damage(seat, 1 + allies)
      }
      harm(inv.seat)
      for (const other of state.investigators.filter(item => !item.defeated && !item.resigned)) {
        if (other.seat === inv.seat) continue
        const here = state.locations.find(location => location.id === other.location)
        if (hasTrait(here, 'Ancient')) harm(other.seat)
      }
      return false
    },
  },
  {
    code: '04088', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api, { location }) {
      api.test(inv.seat, 'agility', 2 + (location?.doom || 0), result => {
        if (!result.success) api.damage(inv.seat, 2)
      })
      return false
    },
  },
  {
    code: '04090', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        const failedBy = Math.max(0, 3 - result.value)
        for (let index = 0; index < failedBy; index++) {
          const answer = api.choose({
            kind: 'harm', source: '04090', seat: inv.seat,
            prompt: `时间裂缝：第 ${index + 1}/${failedBy} 点差额，选择失去 1 个行动或受到 1 点恐惧。`,
            options: [{ id: 'action', label: '失去 1 个行动' }, { id: 'horror', label: '受到 1 点恐惧' }],
          })
          if (answer === 'horror') api.horror(inv.seat, 1)
          else api.loseActions(inv.seat, 1)
        }
      })
      return false
    },
  },
  {
    code: '04091', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      const candidates = inv.assets.filter(asset => !asset.isStoryAsset)
      if (candidates.length) {
        const picked = candidates.length === 1 ? candidates[0] : (candidates.find(asset =>
          asset.id === api.choose({
            kind: 'asset', source: '04091', seat: inv.seat,
            prompt: '困于时间：选择一张非剧情支援洗回牌库。',
            options: candidates.map(asset => ({ id: asset.id, label: asset.name || asset.id })),
          })) || candidates[0])
        const damage = picked.damage || 0
        const horror = picked.horror || 0
        api.shuffleAssetIntoDeck(inv.seat, picked.id)
        if (damage) api.damage(inv.seat, damage)
        if (horror) api.horror(inv.seat, horror)
        return false
      }
      api.discardChosen(inv.seat, 3, '04091')
      return false
    },
  },
  {
    code: '04092', scope: 'treachery', implemented: true,
    // 第 120 轮：显现结算只保留这一份实现（章节在 effect 前选择的选项 id/顺序与旧分支一致）。
    encounterResolve(state, inv, card, api) {
      const alive = state.investigators.filter(item => !item.defeated && !item.resigned)
      const candidates = state.locations.filter(entry => alive.some(target => target.location === entry.id))
      if (!candidates.length) {
        state.doom = (state.doom || 0) + 1
        return false
      }
      const picked = candidates.length === 1 ? candidates[0] : (() => {
        const id = api.choose({
          kind: 'location', source: '04092', seat: inv.seat, peril: true,
          prompt: '不祥之兆：选择放置 1 点毁灭的地点。',
          options: candidates.map(entry => ({ id: String(entry.id), label: entry.name || entry.id })),
        })
        return candidates.find(entry => String(entry.id) === String(id)) || null
      })()
      if (picked) {
        picked.doom = (picked.doom || 0) + 1
        for (const target of alive.filter(entry => entry.location === picked.id)) api.horror(target.seat, 1)
      }
      return false
    },
  },
  {
    code: '04093', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api, { location }) {
      const answer = api.choose({
        kind: 'harm', source: '04093', seat: inv.seat, peril: true,
        prompt: '先祖恐惧：在你所在地点放置 1 点毁灭并弃掉本卡，或把本卡放进胜利区。',
        options: [{ id: 'doom', label: '在所在地点放置 1 点毁灭' }, { id: 'victory', label: '放进胜利区' }],
      })
      if (answer === 'victory') {
        state.victoryDisplay.push({ id: `ancestral-fear:${state.round}:${inv.seat}`,
          code: '04093', originalCode: '04093', victory: 0, vengeance: 1 })
        return false
      }
      if (location) location.doom = (location.doom || 0) + 1
      else state.doom = (state.doom || 0) + 1
      return false
    },
  },
  {
    code: '04096', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      const cultists = state.enemies.filter(enemy => hasTrait(enemy, 'Cultist'))
      if (!cultists.length) {
        api.horror(inv.seat, 1)
        api.drawEncounter(inv.seat)
        return false
      }
      const target = [...cultists].sort((left, right) =>
        entryDistance(state, inv.location, left.location) - entryDistance(state, inv.location, right.location))[0]
      if (target) target.doom = (target.doom || 0) + 1
      api.test(inv.seat, 'willpower', target ? ((target.fight || 0) + (target.doom || 0)) : 3, result => {
        if (!result.success) api.horror(inv.seat, 2)
      })
      return false
    },
  },
  {
    code: '04100', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      const answer = api.choose({
        kind: 'harm', source: '04100', seat: inv.seat,
        prompt: '毒蛇召来：把放在一边的中毒弱点放入威胁区域，或抽取遭遇牌库顶 2 张。',
        options: [{ id: 'poison', label: '让一位调查员中毒' }, { id: 'cards', label: '抽出遭遇牌顶 2 张' }],
      })
      if (answer === 'poison') {
        // 卡面：放到「你的」威胁区域，不能改选其他调查员。
        api.poison(inv.seat)
      } else {
        api.drawEncounter(inv.seat)
        if (!inv.defeated && !inv.resigned) api.drawEncounter(inv.seat)
      }
      return false
    },
  },
  {
    code: '04101', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      for (const target of state.investigators.filter(item => !item.defeated && !item.resigned)) {
        const poisoned = (target.threat || []).some(item => originalOf(item) === '04102') || target.poisoned === true
        if (poisoned) api.damage(target.seat, 1)
      }
      return false
    },
  },
  { code: '04083', scope: 'enemy', implemented: true, enemyStatRule: { fightBonusFromVengeance: true } },
  { code: '04098', scope: 'enemy', implemented: true, enemySpawnRule: { preyPoisoned: true } },
  { code: '01169', scope: 'enemy', enemySpawnRule: { doomOnSpawn: 1 } },
  // 第 7 批：敦威治后段章节的遭遇显现规则从 later-behaviors.js 搬来。
  // 每张卡只声明自己的显现结算；章节入口仍由 later-behaviors.resolveEncounter 分派。
  {
    code: '02142', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const horror = state.enemies.find(enemy => enemy.code === '02141')
      if (horror) horror.shadowSpawned = true
      return true
    },
  },
  {
    code: '02143', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const horror = state.enemies.find(enemy => enemy.code === '02141')
      if (!horror) { api.drawEncounter(inv.seat); return false }
      horror.exhausted = false
      // 印刷能力只让它在原地准备并交战，不会跨博物馆传送。
      if (horror.location === inv.location) {
        api.engage(horror, inv.seat)
        for (const target of state.investigators.filter(other =>
          !other.defeated && !other.resigned && other.location === inv.location)) api.attack(horror, target)
      }
      return false
    },
  },
  {
    code: '02144', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      const horror = state.enemies.find(enemy => enemy.code === '02141')
      api.test(inv.seat, 'willpower', 3 + (horror?.location === inv.location ? 2 : 0), result => {
        if (result.success) return
        const choice = api.choose({ kind: 'encounter', source: code, seat: inv.seat,
          prompt: '通往异界的道路：弃掉牌库顶 5 张，或受到 1 点直接伤害并使每位盟友受到 1 点伤害。',
          options: [{ id: 'mill', label: '弃掉牌库顶 5 张' }, { id: 'damage', label: '承受直接伤害并伤害盟友' }] })
        if (choice === 'mill') api.discardTop(inv.seat, 5)
        else {
          api.directDamage(inv.seat, 1)
          for (const ally of [...inv.assets].filter(asset => (ALL_CARDS[asset.code]?.traits || [])
            .some(trait => String(trait).toLowerCase() === 'ally'))) {
            api.damageAsset(inv.seat, ally.id, 1)
          }
        }
      })
      return false
    },
  },
  {
    code: '02145', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'intellect', 3, result => {
        if (!result.success) inv.actionsLeft = Math.max(0, inv.actionsLeft - Math.max(0, 3 - result.value))
      })
      return false
    },
  },
  {
    code: '02097', scope: 'enemy',
    enemyRule: { blocksResourceGain: true },
  },
  {
    code: '02141', scope: 'enemy',
    enemyRule: { huntingHorror: true },
    enemyScript: {
      onSpawn(state, enemy, api) {
        // 02141 在任何章节生成时都附属暗影之子；helper 本身幂等。
        attachShadowSpawned(state, enemy, api)
      },
      onDefeated(state, enemy) {
        state.scenarioZones.void = { code: enemy.code, resources: enemy.shadowResources || 0 }
        return true
      },
    },
  },
  {
    code: '02146', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const horror = state.enemies.find(enemy => enemy.code === '02141')
      if (horror) horror.doom = (horror.doom || 0) + 1
      else {
        const spawned = summonHuntingHorror(state, inv.location, api)
        if (spawned) api.engage(spawned, inv.seat)
      }
      api.shuffleEncounterDeck()
      return false
    },
  },
  {
    code: '02180', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'willpower', 3, result => {
        if (!result.success) { inv.steamImmobileRound = state.round; api.assetsFirstDamage(inv.seat, 2) }
      })
      return false
    },
  },
  {
    code: '02181', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      for (const target of state.investigators.filter(other =>
        !other.defeated && !other.resigned && other.location === inv.location)) {
        target.actionsLeft = Math.max(0, target.actionsLeft - 1)
        if (target.damage >= 4 && target.assets.length) {
          const choice = api.choose({ kind: 'target', source: code, seat: target.seat,
            prompt: '铁轨断裂：选择弃掉一张你控制的支援。',
            options: target.assets.map(asset => ({ id: asset.id, label: ALL_CARDS[asset.code]?.nameZh || asset.code })) })
          api.discardAsset(target.seat, choice)
        }
      }
      return false
    },
  },
  {
    code: '02220', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      const skill = api.choose({ kind: 'skill', source: code, seat: inv.seat, prompt: '绑架：选择意志或敏捷进行检定（4）。',
        options: [{ id: 'willpower', label: '意志' }, { id: 'agility', label: '敏捷' }] })
      api.test(inv.seat, skill, 4, result => {
        if (result.success) { state.encounterDiscard.push(code); return }
        const allies = inv.assets.filter(asset => ALL_CARDS[asset.code]?.traits?.includes('Ally'))
        if (!allies.length) { api.damage(inv.seat, 2); state.encounterDiscard.push(code); return }
        const chosen = api.choose({ kind: 'target', source: code, seat: inv.seat, prompt: '选择被绑架的盟友。',
          options: allies.map(asset => ({ id: asset.id, label: ALL_CARDS[asset.code]?.nameZh || asset.code })) })
        state.scenarioZones.sacrifices.push(api.removeAsset(inv.seat, chosen))
        state.scenarioFlags.kidnapped = (state.scenarioFlags.kidnapped || 0) + 1
      })
      return true
    },
  },
  {
    code: '02221', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    treacheryRule: { song: true },
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      const candidates = state.investigators.filter(target => !target.defeated && !target.resigned)
      const seat = candidates.length === 1 ? String(candidates[0].seat) : api.choose({
        kind: 'investigator', source: code, seat: inv.seat, prompt: '选择承受灵魂之歌的调查员。',
        options: candidates.map(target => ({ id: String(target.seat), label: target.name })),
      })
      const chosen = candidates.find(target => String(target.seat) === seat)
      if (!chosen) throw new Error('必须选择一名调查员')
      api.threat(chosen.seat, code)
      api.drawEncounter(inv.seat)
      return { placed: true, surgeHandled: true }
    },
  },
  {
    code: '02222', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'intellect', 3, result => {
        if (!result.success) {
          const location = state.locations.find(item => item.id === inv.location)
          if (location) location.clues += state.numInvestigators >= 3 ? 2 : 1
        }
      })
      return false
    },
  },
  {
    code: '02223', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'willpower', 3, result => {
        if (!result.success) api.horror(inv.seat, Math.max(0, 3 - result.value))
      })
      return false
    },
  },
  {
    code: '02256', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      const brood = state.enemies.filter(enemy => enemy.code === '02255')
      if (!brood.length) return false
      const enemyId = brood.length === 1 ? brood[0].id : api.choose({
        kind: 'target', source: code, seat: inv.seat, prompt: '选择一只子嗣附属「高耸的野兽」。',
        options: brood.map(enemy => ({ id: enemy.id, label: `${enemy.name}（${state.locations.find(loc => loc.id === enemy.location)?.name || enemy.location}）` })),
      })
      const chosen = brood.find(enemy => enemy.id === enemyId)
      if (!chosen) throw new Error('必须选择一只在场的子嗣')
      chosen.toweringBeasts = (chosen.toweringBeasts || 0) + 1
      chosen.health += 1
      chosen.attachedTreacheries = [...(chosen.attachedTreacheries || []), code]
      if (chosen.location === inv.location) api.damage(inv.seat, 1)
      return true
    },
  },
  {
    code: '02257', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const brood = state.enemies.filter(enemy => enemy.code === '02255')
      const exposed = state.investigators.filter(target =>
        !target.defeated && !target.resigned && brood.some(enemy => enemy.location === target.location))
      if (!exposed.length) api.drawEncounter(inv.seat)
      else for (const target of exposed) api.test(target.seat, 'agility', 3, result => {
        if (!result.success) api.damage(target.seat, Math.max(0, 3 - result.value))
      })
      return false
    },
  },
  {
    code: '02258', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      const brood = state.enemies.filter(enemy => enemy.code === '02255')
      const pending = [...brood]
      while (pending.length) {
        const enemyId = pending.length === 1 ? pending[0].id : api.choose({
          kind: 'target', source: code, seat: inv.seat, prompt: '选择下一只朝你移动的子嗣。',
          options: pending.map(enemy => ({ id: enemy.id, label: `${enemy.name}（${state.locations.find(loc => loc.id === enemy.location)?.name || enemy.location}）` })),
        })
        const chosen = pending.find(enemy => enemy.id === enemyId)
        if (!chosen) throw new Error('必须选择一只待移动的子嗣')
        moveBroodToward(state, chosen, inv.location, api)
        pending.splice(pending.indexOf(chosen), 1)
      }
      api.drawEncounter(inv.seat)
      return { placed: false, surgeHandled: true }
    },
  },
  {
    code: '02259', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      const options = [{ id: 'horror', label: '受到 2 点恐惧' }]
      if (state.scenarioZones.brood.remaining > 0) options.push({ id: 'spawn', label: '在随机地点生成一只备用子嗣' })
      const choice = api.choose({ kind: 'encounter', source: code, seat: inv.seat,
        prompt: '生物的踪迹：受到 2 点恐惧，或生成一只备用子嗣。', options })
      if (choice === 'horror') api.horror(inv.seat, 2)
      else {
        const location = chooseBroodRandomLocation(state, api)
        state.scenarioZones.brood.remaining--
        state.scenarioZones.setAside.splice(state.scenarioZones.setAside.indexOf('02255'), 1)
        const enemy = api.spawn('02255', location.id)
        if (enemy) enemy.health = 1 + state.numInvestigators
      }
      return false
    },
  },
  {
    code: '02296', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      for (const target of activeInvestigators(state)) api.discardTop(target.seat, 3)
      for (const target of activeInvestigators(state).filter(other =>
        state.locations.find(loc => loc.id === other.location)?.traits
          ?.some(trait => trait.toLowerCase() === 'altered'))) {
        const weaknesses = target.discard.filter(item => ['weakness', 'basicweakness'].includes(ALL_CARDS[item]?.subtype))
        target.discard = target.discard.filter(item => !weaknesses.includes(item))
        target.deck.push(...weaknesses)
        for (let index = target.deck.length - 1; index > 0; index--) {
          const swap = Math.floor(api.random() * (index + 1))
          ;[target.deck[index], target.deck[swap]] = [target.deck[swap], target.deck[index]]
        }
      }
      return false
    },
  },
  {
    code: '02297', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const code = card.originalCode || card.code
      const paths = state.locations.filter(loc => !loc.traits?.includes('Sentinel Hill'))
      const hills = state.locations.filter(loc => loc.traits?.includes('Sentinel Hill'))
      for (const loc of paths) {
        loc.revealed = false
        loc.clues = 0
        const distance = target => {
          const queue = [[loc.id, 0]], seen = new Set([loc.id])
          for (const [next, count] of queue) {
            if (next === target) return count
            for (const neighbor of state.locations.find(item => item.id === next)?.connections || []) {
              if (!seen.has(neighbor)) { seen.add(neighbor); queue.push([neighbor, count + 1]) }
            }
          }
          return Infinity
        }
        const minimum = Math.min(...hills.map(hill => distance(hill.id)))
        const nearest = hills.filter(hill => distance(hill.id) === minimum)
        const choose = seat => nearest.length === 1 ? nearest[0].id : api.choose({ kind: 'location', source: code, seat,
          prompt: '选择最近的哨兵山地点。', options: nearest.map(hill => ({ id: hill.id, label: hill.name })) })
        for (const target of activeInvestigators(state).filter(item => item.location === loc.id)) api.moveInvestigator(target.seat, choose(target.seat))
        for (const enemy of state.enemies.filter(item => item.location === loc.id)) api.moveEnemy(enemy, choose(state.campaign.leadSeat))
      }
      // The physical card backs still distinguish Diverging Paths from
      // Altered Paths. Shuffle identities only within each matching back.
      const pathGroups = [
        [new Set(['02285', '02286', '02287', '02288']), '02285'],
        [new Set(['02289', '02290', '02291', '02292']), '02289'],
      ]
      const classified = new Set(pathGroups.flatMap(([codes]) => [...codes]))
      pathGroups.push([null, null])
      for (const [codes, artCode] of pathGroups) {
        const group = paths.filter(loc => codes ? codes.has(originalOf(loc)) : !classified.has(originalOf(loc)))
        const shuffled = group.map(loc => structuredClone(loc))
        for (let index = shuffled.length - 1; index > 0; index--) {
          const swap = Math.floor(api.random() * (index + 1))
          ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
        }
        group.forEach((loc, index) => {
          const slot = { id: loc.id, connections: loc.connections }
          for (const key of Object.keys(loc)) delete loc[key]
          Object.assign(loc, shuffled[index], slot)
          loc.hiddenIdentity = true
          if (artCode) loc.artCode = artCode
          loc.unrevealedActualName = loc.name
          loc.name = '未知小径'
          state.locationVariants[loc.id] = { ...structuredClone(loc) }
        })
      }
      return false
    },
  },
  {
    code: '02298', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      for (const target of activeInvestigators(state).filter(other =>
        state.locations.find(loc => loc.id === other.location)?.traits
          ?.some(trait => trait.toLowerCase() === 'sentinel hill'))) {
        api.test(target.seat, 'willpower', 4, result => { if (!result.success) api.damage(target.seat, 2) })
      }
      return false
    },
  },
  {
    code: '02331', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const location = state.locations.find(item => item.id === inv.location)
      if (location?.traits?.some(trait => trait.toLowerCase() === 'extradimensional')) {
        api.remove(location.id)
        state.encounterDiscard.push(originalOf(location))
        api.damage(inv.seat, 1)
      } else api.damage(inv.seat, 2)
      return false
    },
  },
  {
    code: '02332', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const location = api.drawEncounterLocation(inv.seat)
      if (!location) return false
      api.moveInvestigator(inv.seat, location.id)
      if (!inv.defeated && !inv.resigned && inv.location != null) {
        const agendaCode = originalOf(state.agendas[state.agendaIndex] || {})
        if (['02312', '02313', '02314', '02315'].includes(agendaCode)) api.horror(inv.seat, 1)
      }
      return false
    },
  },
  {
    code: '02333', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
    encounterResolve(state, inv, card, api) {
      const count = state.locations.filter(loc =>
        loc.traits?.some(trait => trait.toLowerCase() === 'extradimensional')).length
      if (!count) { api.drawEncounter(inv.seat); return false }
      api.test(inv.seat, 'willpower', Math.min(5, count), result => {
        if (!result.success) api.horror(inv.seat, Math.max(0, Math.min(5, count) - result.value))
      })
      return false
    },
  },
  // 第 7 批：失落时代「埃兹特里覆灭」的简单幕/密谋分支。
  {
    code: '04059', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const relic = state.relicOfAges
        const bearer = relic?.seat != null ? state.investigators[relic.seat] : null
        api.finish(bearer?.resigned ? 'r1' : 'r3')
      },
    },
  },
  {
    code: '04056', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.defeat(inv, 'both')
      },
    },
    // 第 120 轮：时间倒流版本（无结局 = 时间之布被拆解）。
    agendaRuleByScenario: {
      turnBackTime: {
        onReveal(state, agenda, api) {
          for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.defeat(inv, null)
          if (state.status === 'playing') api.finish('noResolution')
        },
      },
    },
  },
  {
    code: '04057', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        takeFromSetAsideInEntry(state, '04068')
        const deck = [...(state.explorationDeck || []), 'chamberOfTime']
        if (typeof api.shuffle === 'function') {
          state.explorationDeck = api.shuffle(deck)
        } else {
          const copy = [...deck]
          for (let index = copy.length - 1; index > 0; index--) {
            const target = Math.floor((api.random?.() ?? 0) * (index + 1))
            ;[copy[index], copy[target]] = [copy[target], copy[index]]
          }
          state.explorationDeck = copy
        }
        api.info?.('🧭 「时间石室」洗入探索牌库。')
        const hasChalk = state.investigators
          .filter(inv => !inv.defeated && !inv.resigned)
          .some(inv => api.hasSupply?.(inv.seat, 'chalk'))
        if (hasChalk) {
          api.info?.('✏️ 有人带着粉笔，你们抄下了雕文：本场景移出游戏。')
        } else {
          state.victoryDisplay.push({
            id: 'act:04057', code: '04057', originalCode: '04057',
            victory: 0, vengeance: 1, name: act.name,
          })
          api.info?.('📜 没有粉笔：本场景放进胜利区，并获得复仇 1。')
        }
      },
    },
  },
  {
    code: '04058', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        takeControlOfRelicInEntry(state, api)
        formLocationLineInEntry(state, api)
      },
    },
  },
  {
    code: '04055', scope: 'agenda',
    agendaRule: { onReveal(state, agenda, api) { spawnHarbingerAtDoomInEntry(state, api) } },
    // 第 120 轮：时间倒流沿用同一张卡但文案/结局不同，用按剧本的变体（章节读点带 scenarioId）。
    agendaRuleByScenario: {
      turnBackTime: {
        onReveal(state, agenda, api) {
          takeFromSetAsideInEntry(state, '04062')
          const candidates = [...state.locations].sort((left, right) => (right.doom || 0) - (left.doom || 0))
          const target = candidates[0]?.id
          if (!target) return
          const enemy = api.spawn('04062', target)
          if (!enemy) return
          enemy.damageTaken = Number(state.scenarioFlags?.harbingerDamage || 0)
          enemy.resources = 0
          api.info?.(`🐍 瓦卢西亚的预示者在「${enemy.location}」苏醒。`)
        },
      },
    },
  },
  // 第 7 批：失落时代「久远腹地（上）」的简单幕/密谋分支。
  {
    code: '04209', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        if (!state.enemies.some(enemy => originalOf(enemy) === '04209b')) {
          api.spawn('04209b', 'mouthOfKnyan')
          api.info?.('羽翼蛇族出现在昆扬之口，但它不能被击败。')
        }
      },
    },
  },
  { code: '04210', scope: 'act', actRule: { onReveal(state, act, api) { api.finish('r1') } } },
  {
    code: '04208', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.resign(inv.seat)
      },
    },
  },
  {
    code: '04207', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        api.shuffleDiscard()
        const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        if (!active.length) return
        const answer = active.length === 1 ? String(active[0].seat)
          : (typeof api.choose === 'function'
            ? api.choose({
              kind: 'investigator', source: '04207', seat: state.campaign?.leadSeat ?? active[0].seat,
              prompt: '选择一位调查员担任瞭望员。',
              options: active.map(inv => ({ id: String(inv.seat), label: inv.name })),
            })
            : String(active[0].seat))
        const lookout = active.find(inv => String(inv.seat) === String(answer)) || active[0]
        if (api.hasSupply?.(lookout.seat, 'binoculars') ?? api.checkSupplies?.(lookout.seat, 'binoculars')) {
          api.info?.(`${lookout.name} 带着双筒望远镜，避开了逼近的生物。`)
          return
        }
        const enemyCode = api.discardUntilEnemy?.(lookout.seat, () => true)
        if (!enemyCode) {
          api.info?.('遭遇牌库中没有弃出敌人。')
          return
        }
        api.spawn(enemyCode, lookout.location)
        api.info?.(`${lookout.name} 没有双筒望远镜：遭遇到「${api.cardName?.(enemyCode) || enemyCode}」。`)
      },
    },
  },
  // 第 7 批：失落时代「久远腹地（下）」的简单幕/密谋分支。
  {
    code: '04212', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
          api.trauma(inv.seat, 'physical', 1)
          api.defeat(inv, null)
        }
      },
    },
  },
  // 第 7 批：卡尔克萨「最后的国王」密谋脚本。
  {
    code: '03062', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        if (!state.storyAssets?.length) return
        const fewest = Math.min(...state.storyAssets.map(asset => asset.clues || 0))
        const candidates = state.storyAssets.filter(asset => (asset.clues || 0) === fewest)
        const target = candidates.length === 1 ? candidates[0] : candidates.find(asset =>
          (asset.id || asset.code) === api.choose({
            kind: 'target', source: '03062', seat: state.campaign.leadSeat ?? 0,
            prompt: '选择黛安娜·迪瓦恩出现的旁人。',
            options: candidates.map(asset => ({ id: asset.id || asset.code, label: asset.name || asset.id || asset.code })),
          }))
        if (target) api.spawn('03081', target.location)
        api.shuffleDiscard()
      },
    },
  },
  { code: '03063', scope: 'agenda', agendaRule: { onReveal(state, agenda, api) { api.finish('r3') } } },
  // 第 8 批：古代遗物的剧情角色（引擎不再写死 04061）。
  { code: '04061', scope: 'storyAsset', storyRole: 'relicOfAges' },
  // 第 7 批：失落时代地点的复仇点「视同胜利区」条件。
  { code: '04066', scope: 'location', vengeanceWhile: 'enemyHere' },
  { code: '04287', scope: 'location', vengeanceWhile: 'noClues' },
  { code: '04288', scope: 'location', vengeanceWhile: 'investigatorHere' },
  // ---------------------------------------------------------------------------
  // 第 114 轮：从章节 behavior 迁出的单卡规则。
  //   · enemyScript 新读点 onMoved / attackModifier / onDamaged（内容层只做通用分派）；
  //   · locationRule 复用已有 actions / performAction 读点；
  //   · 遭遇卡走 encounterResolve + encounterResolveCampaigns。
  // ---------------------------------------------------------------------------
  // 疯人院暴食怪（03183）：猎手关键词移动的同一阶段不能攻击；也不发动借机攻击。
  {
    code: '03183', scope: 'enemy', implemented: true,
    name: '疯人院暴食怪',
    text: '不能发动借机攻击；在其猎手关键词移动的同一阶段不能攻击。',
    modifiers: [{ target: 'cannot:opportunityAttack' }],
    enemyScript: {
      onMoved(state, enemy) {
        if (state.phase === 'enemy') enemy.hunterMovedRound = state.round
      },
      attackModifier(state, enemy) {
        if (enemy.hunterMovedRound !== state.round) return null
        return { damage: -enemy.damage, horror: -enemy.horror }
      },
    },
  },
  // 阴魂不散的病人（03184）：强制 — 在你攻击它时受到 1 点恐惧。
  {
    code: '03184', scope: 'enemy', implemented: true,
    name: '阴魂不散的病人',
    text: '猎物 - 剩余神智最高。强制 - 在你攻击阴魂不散的病人时：受到 1 点恐惧。',
    enemyRule: { prey: 'mostRemainingSanity', onAttackedHorror: 1 },
  },
  // 疯人院大厅（03170）：[行动]受到 1 点恐惧：自动躲避本地点的一个[[附身]]敌人。
  {
    code: '03170', scope: 'location', implemented: true,
    name: '疯人院大厅',
    text: '[行动]受到 1 点恐惧：自动躲避本地点的一个[[附身]]敌人。',
    locationRule: {
      actions({ state, inv, moves }) {
        for (const enemy of state.enemies.filter(candidate =>
          candidate.location === inv.location && isLunaticEnemy(candidate))) {
          moves.push({ action: 'scenarioAction', rule: 'eastHallEvade', enemyId: enemy.id,
            label: `承受 1 恐惧，自动躲避${enemy.name}` })
        }
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'eastHallEvade') return false
        const enemy = state.enemies.find(candidate => candidate.id === move.enemyId
          && candidate.location === inv.location && isLunaticEnemy(candidate))
        if (!enemy) throw new Error('没有可由东区病房躲避的疯子敌人')
        api.horror(inv.seat, 1)
        api.evadeEnemy(enemy)
        return true
      },
    },
  },
  // 约束衣（03185）：显现时变成占据身体与手部槽位的支援；除了弃掉它之外不能离场。
  {
    code: '03185', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    // 第 124 轮：旧存档迁移按这个标志找「束身衣」（原 card-rules.js 常量）。
    legacyStraitjacket: true,
    name: '约束衣',
    text: '显现 - 如果你的威胁区域没有约束衣，将约束衣放到你的威胁区域，作为一个占用 1 个身体槽位和 2 个手部槽位的支援。',
    encounterResolve(state, inv, card, api) {
      const code = originalOf(card)
      if (inv.threat.some(threat => threat.code === code)) return false
      for (const asset of [...inv.assets]) {
        const slots = ALL_CARDS[asset.code]?.slots || []
        if (!slots.some(slot => ['Body', 'Hand'].includes(slot))) continue
        api.removeAsset(inv.seat, asset.id)
        inv.hand.push(asset.code)
      }
      api.threat(inv.seat, code, {
        slots: ['Body', 'Hand x2'],
        cannotLeavePlay: true,
        threatEffect: { discardCost: { action: 2 }, sameLocationAction: true },
      })
      return true
    },
  },
  // 危墙迫近（03188）：意志检定失败后，把随机怪物塞到场景牌库底下，或每差 1 点受到 1 点恐惧。
  {
    code: '03188', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    name: '危墙迫近',
    text: '显现 - 检定意志(X)，X 为你所在地点的隐藏值。失败时把随机怪物放到场景牌库底下，或每低于难度 1 点受到 1 点恐惧。',
    encounterResolve(state, inv, card, api) {
      const code = originalOf(card)
      const location = state.locations.find(candidate => candidate.id === inv.location)
      api.test(inv.seat, 'willpower', location?.shroud || 0, result => {
        if (result.success) return
        const amount = Math.max(1, result.difficulty - result.value)
        const options = [{ id: 'horror', label: `受到 ${amount} 点恐惧` }]
        if ((state.scenarioZones?.monsters || []).length) {
          options.push({ id: 'monster', label: '将随机怪物放到场景牌库底下' })
        }
        const answer = api.choose({ kind: 'encounter', source: code, seat: inv.seat, prompt: '墙壁逼近', options })
        if (answer === 'monster') stashMonsterFromZones(state, api)
        else api.horror(inv.seat, amount)
      })
      return false
    },
  },
  // 石铺拱道（03248）：从这里进入相邻的未揭示地点时不必共同支付线索。
  { code: '03248', scope: 'location', locationRule: { waivesEnterClueCost: true } },
  // ---------------------------------------------------------------------------
  // 第 115 轮：荒莽密林（失落时代第一章）的地点 / 幕 / 密谋规则。
  // 章节 behavior 只保留通用分派（beforeExplore / afterExplore / afterTest /
  // locationRule.actions / performAction / actRule / agendaRule）。
  // ---------------------------------------------------------------------------
  // 探险营地（04050）：撤退与「检查补给」两个场景行动。
  {
    code: '04050', scope: 'location', flags: { expeditionCamp: true },
    locationRule: {
      actions({ state, inv, moves }) {
        moves.push({ action: 'scenarioAction', rule: 'resignCamp', label: '⛺ 撤退：荒野实在太危险了！' })
        // 卡面：只有带有地图才能用「检查补给」看探索牌库顶 3 张；没有地图不显示按钮。
        const supplies = state.campaign?.supplies?.[inv.seat] || inv.supplies || []
        if (supplies.includes('map')) {
          moves.push({ action: 'scenarioAction', rule: 'mapSupplies', label: '🗺️ 检查补给：用地图查看探索牌库顶 3 张' })
        }
      },
      performAction(state, inv, move, api) {
        if (move.rule === 'resignCamp') { api.resign(inv.seat); return true }
        if (move.rule !== 'mapSupplies') return false
        if (!api.checkSupplies(inv.seat, 'map')) {
          api.info?.('检查补给：队伍中没有地图，这次行动没有效果。')
          return true
        }
        const top = (state.explorationDeck || []).slice(-3).reverse()
        if (!top.length) return true
        const labelOf = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code
        const bottom = api.choose({
          kind: 'deck', source: '04050', seat: inv.seat,
          prompt: '选择 1 张放在探索牌库底部（其余 2 张按原顺序放回顶）。',
          options: top.map((code, index) => ({ id: String(index), label: labelOf(code) })),
        })
        const picked = top[Number(bottom)] || top[0]
        const rest = top.filter(entry => entry !== picked)
        // 其余 2 张也要「按任意顺序」放回牌库顶：再问一次谁在最上面。
        const firstAnswer = rest.length === 2
          ? api.choose({
            kind: 'deck', source: '04050', seat: inv.seat,
            prompt: '选择其余 2 张中先放回牌库顶的那张（另一张在它下面）。',
            options: rest.map((code, index) => ({ id: String(index), label: labelOf(code) })),
          })
          : '0'
        const first = rest[Number(firstAnswer)] || rest[0]
        const ordered = rest.length === 2 ? [first, rest.find(entry => entry !== first)] : rest
        state.explorationDeck = [
          ...(state.explorationDeck || []).slice(0, Math.max(0, state.explorationDeck.length - 3)),
          ...[...ordered].reverse(),
          picked,
        ]
        api.info?.('地图：一张牌放在探索牌库底部，其余两张按你选择的顺序回到顶部。')
        return true
      },
    },
  },
  // 埃兹特里的遗迹（04053）：在此调查失败后抽取遭遇牌库顶 1 张。
  {
    code: '04053', scope: 'location',
    locationRule: {
      afterTest({ inv, result, api }) {
        if (result.success || result.source?.label !== '调查') return
        api.drawEncounter(inv.seat)
      },
    },
  },
  // 荆棘之路（04069）：调查失败受到 1 点伤害；探索失败也受到 1 点伤害。
  {
    code: '04069', scope: 'location',
    locationRule: {
      afterTest({ inv, result, api }) {
        if (result.success || result.source?.label !== '调查') return
        api.damage(inv.seat, 1)
      },
      afterExploreFailure({ inv, api }) { api.damage(inv.seat, 1) },
    },
  },
  // 河流峡谷（04070）：每场游戏一次的「治愈」场景行动。
  {
    code: '04070', scope: 'location', flags: { riverCanyon: true },
    locationRule: {
      actions({ state, moves }) {
        if (state.scenarioFlags?.riverCanyonHealed) return
        moves.push({ action: 'scenarioAction', rule: 'healRiverCanyon', label: '💧 治愈河流峡谷的一位调查员 1 点伤害（有水壶再额外 2 点）' })
      },
      performAction(state, inv, move, api) {
        if (move.rule !== 'healRiverCanyon') return false
        state.scenarioFlags ||= {}
        state.scenarioFlags.riverCanyonHealed = true
        const candidates = state.investigators.filter(entry =>
          !entry.defeated && !entry.resigned && entry.location === (state.locations.find(loc => loc.id === inv.location)?.id))
        const target = candidates.length <= 1 ? candidates[0] : candidates[Number(api.choose({
          kind: 'investigator', source: 'riverCanyon', seat: inv.seat,
          prompt: '选择河流峡谷中要治愈的调查员。',
          options: candidates.map(entry => ({ id: String(entry.seat), label: entry.name })),
        }))]
        const healed = target || inv
        api.healDamage(healed.seat, 1)
        if (api.checkSupplies(inv.seat, 'canteen')) api.healDamage(healed.seat, 2)
        return true
      },
    },
  },
  // 索桥（04071）：探索前敏捷（2）检定；失败取消探索、受到 2 点伤害、失去行动并结束回合，
  // 并把调查员放到河流峡谷（不在地图上时先从探索牌库找出来放场）。
  {
    code: '04071', scope: 'location',
    locationRule: {
      beforeExplore(state, inv, api) {
        let failed = false
        api.test(inv.seat, 'agility', 2, result => {
          if (result.success) return
          failed = true
          api.damage(inv.seat, 2)
          api.loseActions(inv.seat, 99)
          api.endTurn(inv.seat)
        })
        if (!failed) return true
        const canyon = state.locations.find(entry => originalOf(entry) === '04070')
        if (canyon) api.moveInvestigator(inv.seat, canyon.id)
        else {
          const index = (state.explorationDeck || []).findIndex(entry => entry === 'riverCanyon')
          if (index >= 0) {
            state.explorationDeck.splice(index, 1)
            api.place('riverCanyon')
            api.shuffleExploration?.()
            api.moveInvestigator(inv.seat, 'riverCanyon')
          }
        }
        return false
      },
    },
  },
  // 曲折小道（04073）：探索前检查指南针，没有则必须花费 3 资源。
  // 第 116 轮：调查前的同一费用也由条目声明（heartOfTheEldersPart1 的 behavior 会分派）。
  {
    code: '04073', scope: 'location',
    locationRule: {
      beforeExplore(state, inv, api) {
        if (api.checkSupplies(inv.seat, 'compass')) return true
        if ((inv.resources || 0) < 3) return false
        inv.resources -= 3
        api.info?.(`曲折小道：${inv.name} 没有指南针，额外花费 3 资源。`)
        return true
      },
      beforeInvestigate(state, inv, location, api) {
        if (api?.checkSupplies?.(inv.seat, 'compass')) return true
        if ((inv.resources || 0) < 3) {
          api?.info?.(`曲折小道：${inv.name} 没有指南针，也没有 3 资源支付额外费用。`)
          return false
        }
        inv.resources -= 3
        api?.info?.(`曲折小道：${inv.name} 没有指南针，调查额外花费 3 资源。`)
        return true
      },
    },
  },
  // 杂草丛生的遗迹（04075）：进入后若已中毒，失去所有剩余行动并结束回合。
  {
    code: '04075', scope: 'location',
    locationRule: {
      onEnter: {
        effect(state, location, api, inv) {
          if (!isPoisonedInvestigator(inv)) return
          inv.actionsLeft = 0
          inv.turnEnded = true
          api?.info?.(`🕳️ ${inv.name} 已中毒：进入漆黑洞穴后立即失去所有行动并结束回合。`)
        },
      },
    },
  },
  // 幕 04046「探索丛林」：揭示时生成伊塔卡；轮末可共同花费线索推进。
  {
    code: '04046', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const lead = state.investigators[state.campaign.leadSeat] || state.investigators.find(inv => !inv.defeated && !inv.resigned)
        const spawnAt = lead?.location || 'expeditionCamp'
        if (!state.scenarioFlags?.ichtacaSpawned) {
          state.scenarioFlags.ichtacaSpawned = true
          api.spawn('04052', spawnAt)
        }
        state.encounterDeck = [...state.encounterDeck]
        api.shuffleDiscard()
      },
      roundEndCheck(state, act, api) {
        const required = 3 * state.numInvestigators
        const eligible = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
          .filter(inv => !hasTrait(locationOfInvestigator(state, inv), 'Campsite'))
        const available = eligible.reduce((sum, inv) => sum + (inv.clues || 0), 0)
        if (available < required) return
        const answer = api.choose({
          kind: 'act', source: '04046', seat: state.campaign.leadSeat, canSkip: true,
          prompt: `非营地的调查员共有 ${available} 个线索，可以共同花费 ${required} 个推进场景。`,
          options: [{ id: 'advance', label: `支付 ${required} 个线索并推进` }],
        })
        if (answer !== 'advance') return
        let remaining = required
        for (const inv of eligible) {
          if (!remaining) break
          const pay = Math.min(remaining, inv.clues || 0)
          if (!pay) continue
          inv.clues -= pay
          remaining -= pay
        }
        state.clues = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
          .reduce((sum, inv) => sum + (inv.clues || 0), 0)
        api.advanceAct()
      },
    },
  },
  // 幕 04047「埃兹特里的女猎手」：按「线索」或「击败」推进第三幕。
  {
    code: '04047', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const byClues = state.scenarioFlags.actTwoAdvancedWith !== 'defeat'
        const ichtaca = state.enemies.find(enemy => originalOf(enemy) === '04052')
        const thirdAct = code => structuredClone(state.scenario.acts.find(card => originalOf(card) === code))
        if (byClues) {
          if (ichtaca) {
            const index = state.enemies.indexOf(ichtaca)
            if (index >= 0) state.enemies.splice(index, 1)
            state.victoryDisplay.push({ id: ichtaca.id, code: '04052', originalCode: '04052', victory: 1 })
          }
          state.campaign.records.ichtacaHasConfidenceInYou = true
          state.campaign.records.theInvestigatorsHaveEarnedIchtacasTrust = true
          addPermanentChaosTokens(state, 'cultist', 1)
          state.scenarioFlags.ichtacaLeadsTheWay = true
          state.acts = [state.acts[0], state.acts[1], thirdAct('04048')]
          state.scenarioFlags.actThree = 'search'
        } else {
          if (ichtaca) {
            const index = state.enemies.indexOf(ichtaca)
            if (index >= 0) state.enemies.splice(index, 1)
          }
          state.campaign.records.theInvestigatorsFoughtWithIchtaca = true
          state.campaign.records.ichtacaIsWaryOfTheInvestigators = true
          addPermanentChaosTokens(state, 'tablet', 1)
          const volunteers = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
          const target = volunteers.length === 1 ? volunteers[0] : api.choose({
            kind: 'investigator', source: '04047', seat: state.campaign.leadSeat,
            prompt: '选择一位调查员控制亚历山卓·维拉。',
            options: volunteers.map(inv => ({ id: String(inv.seat), label: inv.name })),
          })
          const seat = Number(target)
          const owner = state.investigators[Number.isInteger(seat) ? seat : volunteers[0].seat]
          if (owner) api.giveAsset(owner.seat, '04051')
          state.acts = [state.acts[0], state.acts[1], thirdAct('04049')]
          state.scenarioFlags.actThree = 'guarded'
        }
        // 第三幕要把还没入场的遗迹地点放回探索牌库（场景定义里的 setAsideLocations 就是这三处遗迹）。
        for (const id of state.scenario.setAsideLocations || []) {
          if (state.locations.some(location => location.id === id)) continue
          state.explorationDeck.push(id)
        }
        state.explorationDeck = mixIntoEntry(state, api, state.explorationDeck)
      },
      objectiveCheck(state, act, api) {
        const ichtaca = state.enemies.find(enemy => originalOf(enemy) === '04052')
        if (!ichtaca) {
          if (state.scenarioFlags?.ichtacaSpawned) {
            state.scenarioFlags.actTwoAdvancedWith = 'defeat'
            api.advanceAct()
          }
          return
        }
        if ((ichtaca.clues || 0) >= state.numInvestigators) {
          state.scenarioFlags.actTwoAdvancedWith = 'clues'
          api.advanceAct()
        }
      },
    },
  },
  // 幕 04048 / 04049：第三幕即结局。
  {
    code: '04048', scope: 'act',
    actRule: { onReveal(state, act, api) { api.finish('r1') } },
  },
  {
    code: '04049', scope: 'act',
    actRule: { onReveal(state, act, api) { api.finish('r2') } },
  },
  // 密谋 04044「荒野探险」：洗入伊格的使徒并让未中毒者做意志（3）检定。
  {
    code: '04044', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const card of ['04083', '04084', '04085']) {
          let index = (state.scenarioZones?.setAside || []).indexOf(card)
          while (index >= 0) {
            state.scenarioZones.setAside.splice(index, 1)
            state.encounterDeck.push(card)
            index = (state.scenarioZones?.setAside || []).indexOf(card)
          }
        }
        api.shuffleDiscard()
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
          api.test(inv.seat, 'willpower', 3, result => {
            if (result.success) return
            if (isPoisonedInvestigator(inv)) {
              api.damage(inv.seat, 1)
              api.horror(inv.seat, 1)
            } else api.poison(inv.seat)
          })
        }
      },
    },
  },
  // 密谋 04045「入侵者」：未中毒者获得中毒弱点，随后所有调查员被击败。
  {
    code: '04045', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
          if (!isPoisonedInvestigator(inv)) {
            const list = state.campaign.investigators
            const entry = Array.isArray(list) ? list[inv.seat] : list?.[inv.seat]
            if (entry) {
              entry.removedCards ||= []
              entry.deck?.push?.('04102')
            }
            // 卡面只写「加入牌库」；不能同时放进威胁区域。
          }
          api.defeat(inv, null)
        }
      },
    },
  },
  // ---------------------------------------------------------------------------
  // 第 115 轮：界限彼端（失落时代第二章）的幕/密谋背面。
  // 三张牌的结算都是「时间线换图」这一组操作，实现只有一份、仍留在章节 behavior；
  // 条目通过 onReveal 的第四个参数拿到 hooks（sweep / shiftPresentDay / …）来编排顺序。
  // ---------------------------------------------------------------------------
  {
    code: '04166', scope: 'act',
    actRule: {
      onReveal(state, act, api, hooks) {
        // 过去与现在（背面）：所有特诺奇蒂特兰地点进胜利区 → 换图 → 失去线索 →
        // 在大神庙生成帕德玛 → 移除当前场景/密谋牌库，把场景 3a 与密谋 3a 放进场。
        hooks.sweep({ onlyCleared: false })
        hooks.shiftPresentDay('04166')
        hooks.loseAllClues()
        hooks.spawnPadma()
        state.scenarioZones.removed = [...(state.scenarioZones.removed || []), '04162', '04163']
        // 引擎在 actReveal 之后才把 actIndex +1，所以这里只补上场景 3a 的槽位；
        // 密谋 3a 则直接成为当前密谋。
        hooks.enterFinalStage({ advanceAct: true })
      },
    },
  },
  {
    code: '04162', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api, hooks) {
        // 预示者的追击：先看剧本日志里预示者是否还活着。
        if (Number(hooks.records().theHarbingerIsStillAlive || 0) > 0) hooks.spawnHarbinger()
        else api.info?.('剧本日志里没有「预示者还活着」的记录，这一面没有额外效果。')
      },
    },
  },
  {
    code: '04163', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api, hooks) {
        // 未来幻象（背面）：与场景 2b 相同的换图流程，但只把「没有线索」的特诺奇蒂特兰
        // 地点放进胜利区；随后把场景 3a 与密谋 3a 放进场。
        hooks.sweep({ onlyCleared: true })
        hooks.shiftPresentDay()
        hooks.loseAllClues()
        hooks.spawnPadma()
        state.scenarioZones.removed = [...(state.scenarioZones.removed || []), '04165', '04166']
        hooks.enterFinalStage({ advanceAgenda: true })
      },
    },
  },
  // ---------------------------------------------------------------------------
  // 第 115 轮：时间倒流（失落时代第四章）的入口地点与幕/密谋背面。
  // 幕/密谋同样通过 onReveal 的 hooks 参数调用章节实现（removeSetAside / addActToVictory / …）。
  // ---------------------------------------------------------------------------
  {
    code: '04060', scope: 'location',
    locationRule: {
      actions({ moves }) {
        moves.push({ action: 'scenarioAction', rule: 'resignEntryway', label: '🚪 撤退：你暂时……逃出来了。' })
        moves.push({
          action: 'scenarioAction', rule: 'inspectSupplies',
          label: '🔦 检查补给品：查看探索牌库顶 2 张，弃掉其中的诡计后洗牌',
        })
      },
      performAction(state, inv, move, api) {
        if (move.rule === 'resignEntryway') { api.resign(inv.seat); return true }
        if (move.rule !== 'inspectSupplies') return false
        if (!api.checkSupplies(inv.seat, 'torches')) {
          api.info?.('检查补给品：队伍中没有火把，这次行动没有效果。')
          return true
        }
        const deck = state.explorationDeck || []
        const top = deck.slice(-2)
        if (!top.length) return true
        state.explorationDeck = deck.slice(0, deck.length - top.length)
        state.explorationDiscard ||= []
        for (const code of top) {
          if (ALL_CARDS[code]?.type === 'treachery') state.explorationDiscard.push(code)
          else state.explorationDeck.push(code)
        }
        const rng = typeof api.random === 'function' ? api.random : () => 0
        const copy = [...state.explorationDeck]
        for (let index = copy.length - 1; index > 0; index--) {
          const target = Math.floor(rng() * (index + 1))
          ;[copy[index], copy[target]] = [copy[target], copy[index]]
        }
        state.explorationDeck = copy
        api.info?.('火把照亮了探索牌库顶：诡计被弃掉，其余卡牌洗回牌库。')
        return true
      },
    },
  },
  {
    code: '04345', scope: 'act',
    actRule: {
      onReveal(state, act, api, hooks) {
        // 背面：把放在一边的时间石室洗入探索牌库；本场景进胜利区并获得复仇 2。
        hooks.removeSetAsideLocation('chamberOfTime')
        if (api.addToExplorationDeck) api.addToExplorationDeck(['chamberOfTime'])
        else {
          state.explorationDeck = [...(state.explorationDeck || []), 'chamberOfTime']
          hooks.shuffleDeck()
        }
        state.scenarioFlags ||= {}
        state.scenarioFlags.chamberOfTimeInDeck = true
        hooks.addActToVictory(act)
        api.info?.('🧭 时间石室被洗入探索牌库。')
      },
    },
  },
  {
    code: '04346', scope: 'act',
    actRule: {
      onReveal(state, act, api, hooks) {
        // 背面：选择时间石室的调查员控制古代遗物；伊格生成在时间石室；进胜利区并获得复仇 2。
        const chamber = state.locations.find(location => originalOf(location) === '04068')
        const candidates = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
          .filter(inv => chamber && inv.location === chamber.id)
        let seat = null
        if (candidates.length === 1) seat = candidates[0].seat
        else if (candidates.length > 1) {
          seat = Number(api.choose({
            kind: 'investigator', source: '04346', seat: state.campaign.leadSeat,
            prompt: '选择一位位于时间石室的调查员控制古代遗物。',
            options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
          }))
          if (!Number.isInteger(seat)) seat = candidates[0].seat
        }
        if (seat == null) seat = state.campaign.leadSeat
        const holder = state.investigators[seat]
        if (holder) {
          hooks.removeSetAside('04061')
          api.giveAsset?.(seat, '04061')
          if (api.moveRelicOfAges) api.moveRelicOfAges({ code: '04061', seat })
          else state.relicOfAges = { code: '04061', location: holder.location, seat }
          api.info?.(`🏺 ${holder.name} 控制了古代遗物。`)
        }
        hooks.removeSetAside('04296')
        const spawnAt = chamber?.id || 'chamberOfTime'
        const yig = api.spawn('04296', spawnAt)
        if (yig) {
          yig.damageTaken = 0
          api.info?.(`🐍 伊格在「${yig.location}」现身！`)
        }
        hooks.addActToVictory(act)
      },
    },
  },
  { code: '04347', scope: 'act', actRule: { onReveal(state, act, api) { api.finish('r1') } } },
  // ---------------------------------------------------------------------------
  // 第 116 轮：破碎永世（失落时代第五章）的地点 / 幕 / 密谋规则。
  // 幕/密谋通过 onReveal 的 hooks 参数编排章节实现；地点规则全部是数据 + 自带 helper。
  // ---------------------------------------------------------------------------
  // 恩凯联结点（04324）：从异界地点进出时，该地点的每个线索化作 1 点恐惧；并可「无视强制效果探索」。
  {
    code: '04324', scope: 'location',
    locationRule: {
      nodeHazard: { withTrait: 'Otherworld', harm: 'horror', icon: '🌀', label: '恐惧' },
      actions({ location, moves, state }) {
        moves.push({
          action: 'scenarioAction', rule: 'exploreFromNode', locationId: location.id,
          label: `🧭 探索（无视「${location.name}」的强制效果）`,
          reason: (state.explorationDeck || []).length ? null : '探索牌库已空',
        })
      },
    },
  },
  // 犹格斯星（04327）：[action] 把 1 个线索翻至毁灭标记面，然后抽 1 张卡。
  {
    code: '04327', scope: 'location',
    locationRule: {
      actions({ location, moves }) {
        moves.push({
          action: 'scenarioAction', rule: 'yuggothFlip',
          label: '🌀 把犹格斯星的 1 个线索翻至毁灭标记面，然后抽 1 张卡',
          // 卡面要求「把 1 个线索翻面」：没有线索时不能发动。
          reason: (location.clues || 0) > 0 ? null : '犹格斯星上没有线索可以翻面',
        })
      },
    },
  },
  // 拉莱耶海岸（04328）：其上每张卡牌（含自身）的每个毁灭标记使隐藏值 +1。
  {
    code: '04328', scope: 'location',
    modifiers: [{
      target: 'locationShroud',
      amount: ({ state, entity }) => locationDoomTotalInEntry(state, entity),
    }],
  },
  // 时间之窗（04330）：从破碎地点进出时，该地点的每个线索化作 1 点伤害；并可「无视强制效果探索」。
  {
    code: '04330', scope: 'location',
    locationRule: {
      nodeHazard: { withTrait: 'Shattered', harm: 'damage', icon: '⏳', label: '伤害' },
      actions({ location, moves, state }) {
        moves.push({
          action: 'scenarioAction', rule: 'exploreFromNode', locationId: location.id,
          label: `🧭 探索（无视「${location.name}」的强制效果）`,
          reason: (state.explorationDeck || []).length ? null : '探索牌库已空',
        })
      },
    },
  },
  // 纳克特（04334）：有 ≥3 个石板标记时，发现此地所有线索并抽等量的牌（团队每场游戏一次）。
  {
    code: '04334', scope: 'location',
    locationRule: {
      actions({ state, moves }) {
        if (state.scenarioFlags?.pnakotusUsed) return
        const tablets = sealedSymbolCountInEntry(state, 'tablet')
        moves.push({
          action: 'scenarioAction', rule: 'pnakotusInsight',
          label: '📚 发现纳克特所有的线索并抽取等量的卡牌（团队每场游戏一次）',
          reason: tablets >= 3 ? null : `需要混沌袋或封印区里至少有 3 个石板标记（当前 ${tablets} 个）`,
        })
      },
    },
  },
  // 瓦卢西亚（04335）：有 ≥3 个异教徒标记时治愈并令隐藏值归 0（团队每场游戏一次）。
  {
    code: '04335', scope: 'location',
    modifiers: [{
      target: 'locationShroud',
      amount: ({ state, entity }) => (state.scenarioFlags?.valusiaShroudZero ? -(entity.shroud || 0) : 0),
    }],
    locationRule: {
      actions({ state, moves }) {
        if (state.scenarioFlags?.valusiaUsed) return
        const cultists = sealedSymbolCountInEntry(state, 'cultist')
        moves.push({
          action: 'scenarioAction', rule: 'valusiaRenewal',
          label: '🐍 治愈 2 点伤害和 2 点恐惧，并把瓦卢西亚的隐藏值设为 0（团队每场游戏一次）',
          reason: cultists >= 3 ? null : `需要混沌袋或封印区里至少有 3 个异教徒标记（当前 ${cultists} 个）`,
        })
      },
    },
  },
  // 幕 04319「寻找兄弟会」背面：破碎地点与巫术诡计洗入探索牌库，并按剧本日志决定遗物归属。
  {
    code: '04319', scope: 'act',
    actRule: {
      onReveal(state, act, api, hooks) {
        const flags = hooks.flags()
        for (const id of hooks.shatteredLocations()) {
          hooks.removeSetAsideLocation(id)
          state.explorationDeck = [...(state.explorationDeck || []), id]
        }
        hooks.shuffleInPlace()
        for (const inv of hooks.active()) {
          const index = (state.encounterDiscard || []).findLastIndex(entry =>
            ALL_CARDS[entry]?.traits?.some(trait => String(trait).toLowerCase() === 'hex'))
          if (index < 0) continue
          const [hex] = state.encounterDiscard.splice(index, 1)
          // 同一张巫术诡计只洗入一次（防重复触发时叠加）。
          if (!flags.foundHexFromDiscard.includes(hex)) {
            state.explorationDeck.push(hex)
            flags.foundHexFromDiscard.push(hex)
          }
          api.info?.(`🃏 ${inv.name} 把「${ALL_CARDS[hex]?.nameZh || hex}」洗入探索牌库。`)
        }
        hooks.shuffleInPlace()
        if (hooks.records().theRelicIsMissing) {
          const pocket = hooks.byId(hooks.pocket())
          hooks.removeFromSetAside(hooks.relicAgesUnleash())
          flags.relicCode = hooks.relicAgesUnleash()
          if (pocket) {
            if (api.moveRelicOfAges) api.moveRelicOfAges({ code: hooks.relicAgesUnleash(), location: pocket.id })
            else state.relicOfAges = { code: hooks.relicAgesUnleash(), location: pocket.id, seat: null }
            api.info?.('🏺 遗物已丢失：放在一边的古代遗物（时光涌流）附属到时间之窗。')
          }
        }
      },
    },
  },
  // 幕 04320「伊斯人的遗物」背面：敌人身份生成 + 启用「遗物离场 → 重置到 3a」。
  {
    code: '04320', scope: 'act',
    actRule: {
      onReveal(state, act, api, hooks) {
        const flags = hooks.flags()
        flags.relicGuard = true
        flags.relicWasControlled = !!hooks.relicControlledBy()
        if (hooks.records().ichtacaIsSetAgainstYou) {
          hooks.removeFromSetAside(hooks.ichtaca())
          const nexus = hooks.byId(hooks.nexus())
          if (nexus) api.spawn(hooks.ichtaca(), nexus.id)
        }
        if (hooks.records().alejandroIsSetAgainstYou) {
          hooks.removeFromSetAside(hooks.alejandro())
          const pocket = hooks.byId(hooks.pocket())
          if (pocket) api.spawn(hooks.alejandro(), pocket.id)
        }
        api.info?.('📜 若古代遗物因任何原因离场：把它附属的地点洗回探索牌库，并将场景重置到 3a。')
      },
    },
  },
  // 密谋 04315「时间之线」背面：无形之子在恩凯联结点现身，本密谋进胜利区并获得复仇 1。
  {
    code: '04315', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api, hooks) {
        api.shuffleDiscard()
        hooks.removeFromSetAside(hooks.formlessSpawn())
        const nexus = hooks.byId(hooks.nexus())
        if (nexus) api.spawn(hooks.formlessSpawn(), nexus.id)
        hooks.addToVictory(agenda, { vengeance: 1 })
        api.info?.('🌑 无形之子在恩凯联结点现身；本密谋进入胜利区并获得复仇 1。')
      },
    },
  },
  // 密谋 04316「垂摆之线」背面：无形之子在场则在其上放 2 毁灭；在胜利区则洗回遭遇牌库。
  {
    code: '04316', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api, hooks) {
        api.shuffleDiscard()
        const nexus = hooks.byId(hooks.nexus())
        const formless = state.enemies.find(enemy => originalOf(enemy) === hooks.formlessSpawn())
        if (formless && nexus) {
          nexus.doom = (nexus.doom || 0) + 2
          api.info?.('🌑 无形之子在场：恩凯联结点上放置 2 个毁灭标记。')
        }
        const inVictory = (state.victoryDisplay || []).find(card =>
          String(card.originalCode || card.code) === hooks.formlessSpawn())
        if (inVictory) {
          state.victoryDisplay = state.victoryDisplay.filter(card => card !== inVictory)
          state.encounterDeck = [...(state.encounterDeck || []), hooks.formlessSpawn()]
          // 卡面：洗回遭遇牌库，不能只是放在牌库顶。
          api.shuffleEncounterDeck?.()
          api.info?.('🌑 胜利区里的无形之子被洗回遭遇牌库。')
        }
        hooks.addToVictory(agenda, { vengeance: 1 })
      },
    },
  },
  { code: '04317', scope: 'agenda', agendaRule: { onReveal(state, agenda, api) { api.finish('r4') } } },
  // ---------------------------------------------------------------------------
  // 第 116 轮：久远腹地（上）（失落时代第六章）的两个独家地点。
  // ---------------------------------------------------------------------------
  // 昆扬之口（04206）：撤退 / 检查补给 / 解开石柱三组场景行动。
  {
    code: '04206', scope: 'location', flags: { mouthOfKnyan: true },
    locationRule: {
      actions({ state, location, moves, hooks }) {
        moves.push({ action: 'scenarioAction', rule: 'resignMouth', label: '⛺ 撤退：搭起帐篷，明天再解开石柱的谜团' })
        moves.push({ action: 'scenarioAction', rule: 'mouthCompass', label: '🧭 检查补给：用指南针查看探索牌库顶 3 张' })
        if (state.acts?.[state.actIndex]?.originalCode !== '04210') return
        const groupClues = state.investigators
          .filter(entry => !entry.defeated && !entry.resigned && entry.location === location.id)
          .reduce((sum, entry) => sum + (entry.clues || 0), 0)
        const need = state.numInvestigators
        const pillars = Number(state.scenarioFlags?.pillars || 0)
        const target = hooks?.pillarsToOpen ?? 3
        moves.push({
          action: 'scenarioAction', rule: 'solvePillar', scriptCard: 'act',
          label: `🗿 共同花费 ${need} 个线索，解开一根石柱（${pillars}/${target}）`,
          reason: groupClues >= need ? null : `需要共同花费 ${need} 个线索（当前 ${groupClues}）`,
        })
      },
    },
  },
  // 时间折磨的树林（04217）：团队每场一次，把胜利区带复仇点数的非精英卡牌放进遭遇弃牌堆。
  {
    code: '04217', scope: 'location',
    locationRule: {
      actions({ state, moves }) {
        if (state.scenarioFlags?.timeWrackedWoodsUsed) return
        moves.push({
          action: 'scenarioAction', rule: 'expelVengeance', actions: 2,
          label: '⏳ 把胜利区一张带复仇点数的非精英卡牌放进遭遇弃牌堆（团队每场一次）',
        })
      },
    },
  },
  // 石板祭坛（04218）：进入后随机揭示一个混乱标记；符号则失去 1 行动，无法失去则改为 1 点恐惧。
  {
    code: '04218', scope: 'location',
    locationRule: {
      onEnter: {
        effect(state, location, api, inv) {
          const token = api.revealToken?.(inv.seat)
          if (!token) return
          const label = api.tokenLabel?.(String(token)) ?? String(token)
          api.info?.(`石板祭坛：揭示混乱标记「${label}」。`)
          if (!['eldersign', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(String(token))) return
          if ((inv.actionsLeft || 0) > 0) api.loseActions(inv.seat, 1)
          else api.horror(inv.seat, 1)
        },
      },
    },
  },
  // ---------------------------------------------------------------------------
  // 第 117 轮：久远腹地（下）（失落时代第七章）的幕/密谋与两个地点。
  // 幕/密谋通过 onReveal 的 hooks 参数调用本章实现（走圈、预示者），实现只有一份。
  // ---------------------------------------------------------------------------
  // 幕 04213「原地绕圈」背面：深入幽嘶洗入探索牌库；选一名侦查员，没有粉笔就让全场 +1 线索。
  {
    code: '04213', scope: 'act',
    actRule: {
      onReveal(state, act, api, hooks) {
        hooks.goingInCircles()
      },
    },
  },
  // 密谋 04211 背面：剧本日志里预示者还活着时让它重新入场。
  {
    code: '04211', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api, hooks) {
        hooks.spawnHarbinger()
      },
    },
  },
  // 宽阔步道（04222）：没有双筒望远镜时探索要额外花 1 个行动。
  {
    code: '04222', scope: 'location',
    locationRule: {
      beforeExplore(state, inv, api) {
        if (api.checkSupplies(inv.seat, 'binoculars')) return true
        if ((inv.actionsLeft || 0) < 1) {
          api.info?.('宽阔步道：本地点没有人带双筒望远镜，需要额外 1 个行动，你的行动不足。')
          return false
        }
        inv.actionsLeft -= 1
        api.info?.('宽阔步道：本地点没有人带双筒望远镜，额外花费 1 个行动。')
        return true
      },
    },
  },
  // 危险峡谷（04225）：在此调查失败后，若没人带绳索就在此地点放 1 个毁灭。
  {
    code: '04225', scope: 'location',
    locationRule: {
      afterTest({ state, inv, result, api }) {
        if (result.success || result.source?.label !== '调查') return
        if (api.checkSupplies(inv.seat, 'rope')) return
        const location = (state.locations || []).find(entry => entry.id === inv.location)
        if (location) location.doom = (location.doom || 0) + 1
      },
    },
  },
  // 下面四张是两个「久远腹地」章节共用的遭遇卡。第 117 轮先把卡号判断收进条目标志；
  // 两章的文案/数值仍有细微差异，合并成单一 encounterResolve 实现留到后续专门一轮。
  { code: '04215', scope: 'treachery', implemented: true, flags: { pitfall: true } },
  { code: '04216', scope: 'treachery', implemented: true, flags: { spores: true } },
  { code: '04221', scope: 'treachery', implemented: true, flags: { ants: true } },
  { code: '04228', scope: 'treachery', implemented: true, flags: { noTurningBack: true } },
  // ---------------------------------------------------------------------------
  // 第 118 轮：命运之线（失落时代第三章）的密谋背面、敌人脚本与三张遭遇卡。
  // 幕牌库计数直接读 state.scenarioFlags.actDecks（与章节 actsInPlay 同源）。
  // ---------------------------------------------------------------------------
  {
    code: '04114', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        api.shuffleDiscard?.()
        const decks = threadActDecksInPlay(state)
        const doom = decks === 2 ? 1 : 0
        if (doom) api.addDoom?.(doom)
      },
    },
  },
  {
    code: '04115', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        api.shuffleDiscard?.()
        const decks = threadActDecksInPlay(state)
        const doom = decks === 2 ? 1 : decks === 1 ? 2 : 0
        if (doom) api.addDoom?.(doom)
      },
    },
  },
  {
    code: '04116', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
          api.trauma?.(inv.seat, 'mental', 1)
          api.defeat?.(inv, null)
        }
      },
    },
  },
  // 瓦卢西亚的预示者（04062）的入场脚本在上面的敌人清单里（harbingerSpawn 顺带记 harbingerEnteredPlay）。
  // 哈伦·恩斯通（04122b）/ 亚历山卓·维拉（04130b）/ 伊塔卡（04137b）的生成脚本在上面的敌人清单里扩展。
  // 命运之线的三张遭遇卡（只在失落时代出现，用战役限定入口）。
  {
    code: '04144', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
    encounterResolve(state, inv, card, api) {
      const decks = threadActDecksInPlay(state)
      const bonus = Math.max(0, 3 - decks)
      api.test(inv.seat, 'willpower', 3 + bonus, result => {
        if (result.success) return
        for (let index = 0; index < 1 + bonus; index++) {
          api.damage(inv.seat, 1)
          api.horror(inv.seat, 1)
        }
      }, 0, null, { peril: true })
      return false
    },
  },
  {
    code: '04145', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
    encounterResolve(state, inv, card, api) {
      const location = (state.locations || []).find(entry => entry.id === inv.location)
      if (!location) return false
      if ((location.clues || 0) === 0) {
        api.drawEncounter(inv.seat)
        return false
      }
      location.attachments ||= []
      if (!location.attachments.some(entry => originalOf(entry) === '04145')) {
        location.investigateExtraActions = (location.investigateExtraActions || 0) + 1
      }
      location.attachments.push({ id: `nobodys-home:${state.round}:${location.id}`, code: '04145', originalCode: '04145' })
      api.info?.('「屋中无人」附属到此地点：调查它需要额外 1 个行动。')
      return true
    },
  },
  {
    code: '04146', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
    encounterResolve(state, inv, card, api) {
      const agenda = state.agendas?.[state.agendaIndex]
      if (!agenda) return false
      agenda.doomThreshold = Math.max(1, (agenda.doomThreshold || 0) - 1)
      agenda.attachments ||= []
      agenda.attachments.push({ id: `conspiracy:${state.round}`, code: '04146', originalCode: '04146' })
      api.info?.('「鲜血阴谋」附属到当前密谋：毁灭阈值 -1。')
      return true
    },
  },
  {
    code: '01135', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
    encounterResolve(state, inv, card, api) {
      const code = originalOf(card)
      const answer = api.choose?.({
        kind: 'harm', source: code, seat: inv.seat,
        prompt: '追猎鬼影：花费 1 个线索，或受到 2 点伤害。',
        options: [{ id: 'clue', label: '花费 1 个线索' }, { id: 'damage', label: '受到 2 点伤害' }],
      }) ?? ((inv.clues || 0) > 0 ? 'clue' : 'damage')
      if (answer === 'clue' && (inv.clues || 0) > 0) {
        inv.clues -= 1
        syncCluesInEntry(state)
      } else api.damage(inv.seat, 2)
      return false
    },
  },
  {
    code: '01136', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
    encounterResolve(state, inv, card, api) {
      if ((inv.clues || 0) === 0) { api.drawEncounter(inv.seat); return false }
      api.test(inv.seat, 'intellect', 4, result => {
        if (result.success) return
        const location = (state.locations || []).find(entry => entry.id === inv.location)
        const failedBy = Math.max(0, 4 - (result.value ?? 0))
        for (let index = 0; index < failedBy && (inv.clues || 0) > 0; index++) {
          inv.clues -= 1
          if (location) location.clues = (location.clues || 0) + 1
        }
        syncCluesInEntry(state)
      })
      return false
    },
  },
  // ---------------------------------------------------------------------------
  // 第 119 轮：真相幻影（卡尔克萨第三章）的地点与遭遇卡。
  // 地点的「不能离开」锁用 locationRule.exitLock 声明（内容层统一读）。
  // ---------------------------------------------------------------------------
  // 蒙帕纳斯（03208）：[free] 弃 1 张手牌，按意志图标数获得资源（每轮每座位一次）。
  {
    code: '03208', scope: 'location',
    locationRule: {
      actions({ state, inv, location, moves }) {
        const perRoundKey = `${originalOf(location)}:${inv.seat}`
        if (state.scenarioFlags?.[perRoundKey] === state.round) return
        const discardable = inv.hand.some(card => !inv.hiddenCards?.includes(card))
        moves.push({ action: 'scenarioAction', rule: 'montparnasseDiscard', actions: 0,
          label: '弃掉1张手牌，获得等同其意志图标数量的资源',
          reason: discardable ? null : '需要 1 张可弃的手牌（隐藏的疯狂牌不能弃）' })
      },
    },
  },
  // 蒙马特（03209）：每轮一次，揭示每位调查员牌库顶牌并可打出一张支援。
  {
    code: '03209', scope: 'location',
    locationRule: {
      actions({ state, moves }) {
        if (state.scenarioFlags?.montmartrePlayRound === state.round) return
        moves.push({ action: 'scenarioAction', rule: 'montmartrePlay',
          label: '揭示每位调查员牌库顶牌并可打出一张支援' })
      },
    },
  },
  // 蒙马特高地（03210）：每轮每座位一次，花 1 资源补充 1 弹药/补给。
  {
    code: '03210', scope: 'location',
    locationRule: {
      actions({ state, inv, location, moves }) {
        const perRoundKey = `${originalOf(location)}:${inv.seat}`
        if (state.scenarioFlags?.[perRoundKey] === state.round) return
        const reloadable = (inv.assets || []).some(asset =>
          ['ammo', 'supply', 'supplies'].includes(String(asset.usesType || '').toLowerCase()))
        moves.push({ action: 'scenarioAction', rule: 'montmartreReload',
          label: '花费1资源，为一张卡牌补充1补给或子弹',
          reason: inv.resources < 1 ? `需要 1 个资源（当前 ${inv.resources}）`
            : reloadable ? null : '需要一张带弹药或补给的支援' })
      },
    },
  },
  // 大木偶剧场（03211）：揭示时受到 2 点恐惧，或洗回全部非弱点手牌并重抽。
  {
    code: '03211', scope: 'location',
    locationRule: {
      onReveal(state, location, api, seat) {
        const answer = api.choose({
          kind: 'location',
          source: '03211',
          seat: seat ?? state.currentSeat,
          prompt: '揭示大木偶剧场：选择受到2点恐惧，或洗回全部非弱点手牌并重抽。',
          options: [{ id: 'horror', label: '受到2点恐惧' }, { id: 'shuffle', label: '洗回并重抽手牌' }],
        })
        const inv = state.investigators[seat ?? state.currentSeat]
        if (!inv) return
        if (answer === 'horror') api.horror(inv.seat, 2)
        else {
          // 只洗回非弱点手牌，混洗后再抽等量。
          const cards = inv.hand.filter(code => ALL_CARDS[code]?.subtype !== 'weakness')
          for (const code of cards) inv.hand.splice(inv.hand.indexOf(code), 1)
          inv.deck.push(...cards)
          api.shuffleDeck(inv.seat)
          api.drawCards(inv.seat, cards.length)
        }
      },
    },
  },
  // 奥赛火车站（03214）：[action] 花 1 资源移动到任意轨道沿线地点。
  {
    code: '03214', scope: 'location',
    locationRule: {
      actions({ state, inv, location, moves }) {
        const hasRail = state.locations.some(candidate =>
          candidate.id !== location.id && ALL_CARDS[originalOf(candidate)]?.traits?.includes('Rail'))
        if (!hasRail) return
        moves.push({ action: 'scenarioAction', rule: 'gareRailMove',
          actionKind: 'move', label: '花费1资源，移动到任意轨道沿线地点',
          reason: inv.resources < 1 ? `需要 1 个资源（当前 ${inv.resources}）` : null })
      },
    },
  },
  // 拉雪兹神父公墓（03215）：成功调查后到本轮结束不能离开。
  {
    code: '03215', scope: 'location',
    locationRule: {
      exitLock: { flag: 'pereLachaiseLock', message: '拉雪兹神父公墓：本回合不能离开' },
      afterTest({ state, inv, result }) {
        if (!result.success || result.source?.label !== '调查') return
        state.scenarioFlags ||= {}
        const locks = Array.isArray(state.scenarioFlags.pereLachaiseLock) ? state.scenarioFlags.pereLachaiseLock : []
        locks.push({ seat: inv.seat, round: state.round })
        state.scenarioFlags.pereLachaiseLock = locks
      },
    },
  },
  // 玛黑区（03218）：进入后到本轮结束不能离开。
  {
    code: '03218', scope: 'location',
    locationRule: {
      exitLock: { flag: 'leMaraisLock', message: '玛黑区：本回合不能离开' },
      onEnter: {
        effect(state, location, api, inv) {
          state.scenarioFlags ||= {}
          const locks = Array.isArray(state.scenarioFlags.leMaraisLock) ? state.scenarioFlags.leMaraisLock : []
          locks.push({ seat: inv.seat, round: state.round })
          state.scenarioFlags.leMaraisLock = locks
        },
      },
    },
  },
  // 巴黎圣母院（03219）：每场游戏一次的意志（6）检定为毁灭标记。
  {
    code: '03219', scope: 'location',
    modifiers: [
      // 位于巴黎圣母院的每个敌人 -1 攻击、+1 躲避（地点作为修正来源）。
      { target: 'enemyFight', amount: -1 },
      { target: 'enemyEvade', amount: 1 },
    ],
    locationRule: {
      actions({ state, moves }) {
        if (state.scenarioFlags?.notreDameUsed) return
        moves.push({ action: 'scenarioAction', rule: 'notreDameDoom',
          label: '检定意志（6），放置或移除1个毁灭' })
      },
    },
  },
  // 双生太阳（03223）：智识（4）失败后移除 1 个毁灭或按差额受到恐惧。
  {
    code: '03223', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const code = originalOf(card)
      api.test(inv.seat, 'intellect', 4, result => {
        if (result.success) return
        const failedBy = Math.max(1, result.difficulty - result.value)
        const options = state.doom > 0
          ? [{ id: 'doom', label: '从当前密谋移除 1 个毁灭' }, { id: 'horror', label: `承受 ${failedBy} 点恐惧` }]
          : [{ id: 'horror', label: `承受 ${failedBy} 点恐惧` }]
        const choice = options.length === 1 ? 'horror' : api.choose({
          kind: 'encounter', source: code, seat: inv.seat, prompt: '双生太阳：移除毁灭或承受恐惧。', options,
        })
        if (choice === 'doom') state.doom = Math.max(0, state.doom - 1)
        else api.horror(inv.seat, failedBy)
      })
      return false
    },
  },
  // 本地餐馆（04141）/ 警局（04126b）/ 火车轨道（04128b）的场景行动（命运之线）。
  {
    code: '04141', scope: 'location',
    locationRule: {
      actions({ state, moves }) {
        if (state.scenarioFlags?.usedAbilities?.velmasDiner) return
        moves.push({ action: 'scenarioAction', rule: 'velmasGossip', actions: 3, label: '☕ 在小餐馆听人闲聊（3 行动，获得 2 个线索）' })
      },
    },
  },
  {
    code: '04126b', scope: 'location',
    locationRule: {
      actions({ moves }) {
        moves.push({ action: 'scenarioAction', rule: 'policeSearchWeapon', label: '🔫 查找牌库顶 6 张中的一张武器' })
      },
    },
  },
  {
    code: '04128b', scope: 'location',
    locationRule: {
      actions({ state, moves }) {
        if (state.scenarioFlags?.usedAbilities?.trainTracks) return
        moves.push({ action: 'scenarioAction', rule: 'trainTracksDraw', label: '🚂 花费 1 个线索，抽取 4 张卡牌（每场游戏一次）' })
      },
    },
  },
  // 注：04055 / 04056 的密谋条目已在「埃兹特里的覆灭」部分声明，并被该章 behavior 使用；
  // 时间倒流沿用同一张卡但文案/结局不同，因此它的 agendaReveal 仍保留章节内分支（见交接文档）。
  // 墓灯地穴（03249）：在此调查改为使用意志；埋骨洞窟（03250）：调查时少 1 个手部槽位。
  { code: '03249', scope: 'location', locationRule: { investigateSkill: 'willpower' } },
  { code: '03250', scope: 'location', handSlotsPenaltyWhileInvestigating: true, locationRule: { handSlotsPenalty: 1 } },
  // 颤栗水池（03251 的「百魂之井」）与颤栗水池（03255）：回合结束时二选一的强制效果。
  // 第 114 轮：从 thePallidMask 的 behavior.turnEnded 分支迁来，读点是 locationRule.onTurnEnd。
  {
    code: '03251', scope: 'location',
    locationRule: {
      onTurnEnd(state, location, api, inv) {
        const answer = api.choose({
          kind: 'harm', source: location?.originalCode || location?.code, seat: inv.seat,
          prompt: '百魂之井：选择受到1点直接恐惧，或随机弃掉2张手牌。',
          options: [{ id: 'horror', label: '受到1点直接恐惧' }, { id: 'discard', label: '随机弃2张手牌' }],
        })
        if (answer === 'horror') api.directHorror(inv.seat, 1)
        else api.discardRandom(inv.seat, 2)
      },
    },
  },
  // 离开惧怖地窖（03254）时的敏捷（3）检定：失败受到 1 点伤害。
  {
    code: '03254', scope: 'location',
    locationRule: {
      onLeave: {
        test: { skill: 'agility', difficulty: 3, onlyUnrevealedDestination: true },
        onFail(state, location, api, inv) { api.damage(inv.seat, 1) },
      },
    },
  },
  {
    code: '03255', scope: 'location',
    locationRule: {
      onTurnEnd(state, location, api, inv) {
        const answer = api.choose({
          kind: 'harm', source: location?.originalCode || location?.code, seat: inv.seat,
          prompt: '颤栗水池：选择受到1点直接伤害，或失去5资源。',
          options: [{ id: 'damage', label: '受到1点直接伤害' }, { id: 'resources', label: '失去5资源' }],
        })
        if (answer === 'damage') api.directDamage(inv.seat, 1)
        else inv.resources = Math.max(0, inv.resources - 5)
      },
    },
  },
  // 堵塞通道 / 暗影坟墓（03256）：揭示时若当前幕不是 03246，则所在地点的调查员受到 2 点伤害且不能离开。
  {
    code: '03256', scope: 'location', flags: { shadowTomb: true },
    locationRule: {
      onReveal(state, location, api) {
        if (state.acts?.[state.actIndex]?.originalCode === '03246') return
        const inv = state.investigators[state.currentSeat]
        if (inv?.location === location.id) api.damage(inv.seat, 2)
        location.cannotLeaveRound = state.round
      },
    },
  },
  // 暗影坟墓已在幕二揭示时直接推进（thePallidMask 的 locationRevealed 分支）。
  {
    code: '03257', scope: 'location', flags: { tombEntrance: true },
    locationRule: {
      onReveal(state, location, api) {
        if (state.actIndex !== 0) return
        state.scenarioFlags.tombLocationId = location.id
        api.advanceAct()
      },
    },
  },
  // 跨卡身份查询用条目标志：内容层用 entryFlags / enemyRuleFor 判断「这张牌是不是 X」，
  // 不再在章节脚本里写死卡号（第 114 轮）。
  // 子嗣（02255）用 entries/02255.js 的 enemyRule.brood，追猎恐魔（02141）用 enemyRule.huntingHorror。
  { code: '03331', scope: 'location', flags: { palaceOfTheKing: true } },
  // 哈斯塔（黄衣之王，03332）：除剧情卡牌效果（剧本用 source='encounter'）外不能受到伤害；
  // 攻击造成的恐惧超过神智时额外 1 点伤害。敌军阶段开始的无视地点攻击在 dimCarcosa 的 enemyPhaseStart。
  {
    code: '03332', scope: 'enemy', flags: { hastur: true, kingInYellow: true },
    enemyRule: { damageOnlyFrom: 'encounter', excessHorrorDamage: true },
  },
  // 潮汐骇物（03300）：生成 - 晋升之门或圣奥伯特礼拜堂（二选一）。
  // 潮汐骇物（03300）：生成 - 晋升之门或圣奥伯特礼拜堂（二选一）。
  { code: '03300', scope: 'enemy', spawnChoices: ['porteDeLAvancee', 'chapelOfStAubert'] },
  // 哈斯塔（卡尔克萨领主，03333）：猎物＝剩余神智最高；恐惧溢出额外 1 伤害；无剩余神智时的符号视为自动失败。
  {
    code: '03333', scope: 'enemy', flags: { hastur: true },
    enemyRule: { prey: 'mostRemainingSanity', excessHorrorDamage: true, noSanityAutoFailTokens: true },
  },
  // 哈斯塔（褴褛之王，03334）：猎物＝剩余神智最高；恐惧溢出额外 1 伤害；
  // 无剩余神智者攻击/躲避他时把 +1/0/-1/旧印视为自动失败。
  {
    code: '03334', scope: 'enemy', flags: { hastur: true },
    enemyRule: { prey: 'mostRemainingSanity', excessHorrorDamage: true, noSanityAutoFailTokens: true },
  },
  // 死亡鬼灵（03241b）：横置时每次攻击伤害 -1；躲避失败后它攻击你。
  {
    code: '03241b', scope: 'enemy', implemented: true,
    name: '死亡鬼灵',
    text: '横置时每次攻击伤害 -1。强制 - 你尝试躲避它时技能检定失败后：它攻击你。',
    enemyRule: { damageReductionWhileExhausted: 1, attacksOnFailedEvade: true },
  },
  // 风琴手（03221 / 03221b）：不能受到伤害。
  // 03221 的「猎手移动后再结算一次、本阶段不能攻击」与 03221b 的敌军阶段结束移动在章节 behavior。
  {
    code: '03221', scope: 'enemy', implemented: true,
    name: '风琴手',
    text: '猎手。不能受到伤害。',
    flags: { organist: 'conviction' },
    modifiers: [{ target: 'cannot:beDamaged' }],
  },
  {
    code: '03221b', scope: 'enemy', implemented: true,
    name: '风琴手',
    text: '冷漠。不能受到伤害。',
    flags: { organist: 'doubt' },
    modifiers: [{ target: 'cannot:beDamaged' }],
  },
  // 蛇族的愤怒（04302）：追击区没有蛇族敌人则涌动，否则把攻击值最高的蛇族拽出来交战。
  {
    code: '04302', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
    name: '蛇族的愤怒',
    text: '显现 - 如果没有[[蛇族]]敌人处于追击中，本卡获得涌动。否则攻击值最高且处于追击中的[[蛇族]]敌人生成并与你交战。',
    encounterResolve(state, inv, card, api) {
      state.scenarioZones ||= {}
      const pursuit = state.scenarioZones.pursuit || []
      const serpents = pursuit.filter(entry => isPursuitSerpent(state, entry.code))
      if (!serpents.length) {
        api.info?.('蛇族的愤怒：追击区域没有蛇族敌人，本卡获得涌动。')
        api.drawEncounter(inv.seat)
        return { placed: false, surgeHandled: true }
      }
      const best = Math.max(...serpents.map(entry => pursuitFightOf(state, entry.code)))
      const chosen = serpents.filter(entry => pursuitFightOf(state, entry.code) === best)[0]
      const index = pursuit.indexOf(chosen)
      if (index >= 0) pursuit.splice(index, 1)
      const enemy = api.spawn(chosen.code, inv.location)
      if (!enemy) {
        pursuit.push(chosen)
        return { placed: false, surgeHandled: true }
      }
      enemy.damageTaken = chosen.damageTaken || 0
      if (!enemy.exhausted) {
        if (typeof api.engage === 'function') api.engage(enemy, inv.seat)
        else {
          enemy.engagedSeat = inv.seat
          if (!inv.engaged.includes(enemy.id)) inv.engaged.push(enemy.id)
        }
      }
      const location = state.locations.find(candidate => candidate.id === inv.location)
      api.info?.(`蛇族的愤怒：「${enemy.name}」在「${location?.name || inv.location}」生成并与 ${inv.name} 交战。`)
      const difficulty = enemy.fight || 0
      api.test(inv.seat, 'agility', difficulty, result => {
        if (result.success) return
        if (!state.enemies.includes(enemy)) return
        api.attack(enemy, inv)
      })
      return { placed: false, surgeHandled: true }
    },
  },
  // ---------------------------------------------------------------------------
  // 地点的未揭示面「门锁住了，你不能移动进入」（P1 地点进入限制通道）。
  // 读点：investigatorEntryError → locationRule.entryError；揭示后自动解除。
  // 02054/02057/03172/03176/03177 的 entryError 合并进各自的既有条目。
  // ---------------------------------------------------------------------------
  { code: '02052', scope: 'location', implemented: true,
    locationRule: { entryError(state, location) {
      return location.revealed ? null : '通往宿舍的门锁住了。你不能移动进入宿舍。'
    } } },
  { code: '02055', scope: 'location', implemented: true,
    locationRule: { entryError(state, location) {
      return location.revealed ? null : '通往教师办公室的门锁住了。你不能移动进入教师办公室。'
    } } },
]

// 审计/调试：这张卡是不是由本文件声明的非玩家能力卡。
export const NON_PLAYER_ABILITY_CODES = new Set(NON_PLAYER_ABILITY_ENTRIES.map(entry => entry.code))

// 03059 的身份查询：不 import card-rules（会与 card-abilities 形成循环依赖）。
const pallidMaskCode = () => NON_PLAYER_ABILITY_ENTRIES.find(entry => entry.pallidMask === true)?.code || null

// 第 108 轮：内容层直接按卡号取非玩家条目，不依赖引擎注册表
// （单元测试可只 import behavior，不启动 engine）。
const NON_PLAYER_ENTRY_BY_CODE = new Map(NON_PLAYER_ABILITY_ENTRIES.map(entry => [entry.code, entry]))
export const nonPlayerEntryFor = code => NON_PLAYER_ENTRY_BY_CODE.get(code) || null

// 供内容层复用的读点（避免在 behavior.js 里再写一遍「复仇点数」）。
export { originalOf, victoryVengeance }

