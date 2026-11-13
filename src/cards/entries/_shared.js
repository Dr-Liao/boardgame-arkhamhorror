// 卡牌行为文件共用的窄工具（只放跨卡复用的原语，不放某张卡的规则）。
//
// 这里的内容原来在 card-abilities.js 顶部；拆分后由各 entries/<code>.js 按需 import。

import { registeredEntry } from '../../engine/ability.js'

// 调查员的旧印数据在条目自己的 `investigator.elderSign` 里；用惰性代理读取，
// 避免卡文件在模块初始化时反向依赖 card-effects（第 6 批）。
export const investigatorSign = code => new Proxy({}, {
  get: (_, key) => registeredEntry(code)?.investigator?.elderSign?.[key],
})

// 跨条目的布尔标记与数据读点（第 5 步 P6）：卡文件只经能力层注册表查询，
// 不 import 引擎装配点，也不在卡文件里写死另一张卡的实现细节。
export const entryFlag = (code, key) => code ? registeredEntry(code)?.[key] === true : false
export const entryData = (code, key) => (code ? registeredEntry(code)?.[key] ?? null : null)

export const skillModifier = (skill, amount, condition) =>
  ({ target: `skill:${skill}`, amount, ...(condition ? { condition } : {}) })

export const allSkillModifiers = (amount, condition) =>
  ['willpower', 'intellect', 'combat', 'agility'].map(skill => skillModifier(skill, amount, condition))

export const SKILL_NAMES_ZH = Object.freeze({
  willpower: '意志', intellect: '智识', combat: '战斗', agility: '敏捷',
})

export const CHAOS_SYMBOLS = ['skull', 'cultist', 'tablet', 'elderthing', 'autofail']

// 「攻击。」事件的目标过滤：未与调查员交战的冷漠敌人不能被攻击——必须先主动交战，或使用
// 写明「忽略冷漠」的攻击。口径与引擎 hidden-rules.js 的 aloofPreventsAttack 一致：
// 文本被清空时冷漠失效；庞大敌人视为与同地点每位调查员交战。
// 03153 / 04033 / 04266 / 05037 用同一份过滤，避免打出条件与结算目标各写一套。
export function attackableEnemies(state, inv) {
  return (state.enemies || []).filter(enemy => {
    if (enemy.location !== inv.location) return false
    if (!enemy.aloof) return true
    if (enemy.engagedSeat != null) return true
    if (enemy.massive) return true
    const blank = enemy.textBlanked
    return Boolean(blank && blank.round === state.round && blank.phase === state.phase)
  })
}

// 03026 / 03307 共用：选择同地点一名调查员并搜索其牌库（amount 为 'all' 时搜索整个牌库）。
// 询问与检索的 source 保持旧原语的 'noStoneUnturned'，日志与存档字段因此不变。
export function searchInvestigatorDeck(inv, api, amount, state = null) {
  const targets = api.investigatorsAt(inv.location)
  if (!targets.length) return
  const targetSeat = targets.length === 1 ? targets[0].seat
    : Number(api.choice({ kind: 'investigator', source: 'noStoneUnturned', seat: inv.seat,
      prompt: '选择要搜索牌库的调查员。',
      options: targets.map(other => ({ id: String(other.seat), label: other.name })) }))
  api.searchTop(targetSeat, {
    amount: amount === 'all' ? (state?.investigators?.[targetSeat]?.deck?.length ?? 0) : amount,
    source: 'noStoneUnturned',
  })
}

// 03038 / 03148 / 03199 / 03232 共用的「选择附属地点」：候选集合与旧实现一致
// （藏身地点可以是任一已揭示地点，其余只能附属到所在地点），询问文案逐字保留。
export function attachToChosenLocation(state, inv, api, { code, source, revealedOnly = false, anyLocation = false }) {
  const locations = anyLocation
    ? state.locations
    : revealedOnly
      ? state.locations.filter(location => location.revealed)
      : state.locations.filter(location => location.id === inv.location)
  if (!locations.length) return null
  const locationId = locations.length === 1 ? locations[0].id
    : api.choice({ kind: 'location', source, seat: inv.seat, prompt: '选择附加地点。',
      options: locations.map(location => ({ id: location.id, label: api.locationName(location.id) })) })
  return api.attachToLocation(locationId, { code, ownerSeat: inv.seat })
}

// 04274 的「创伤 2 点以上治疗 2 点」：战役创伤在 state.campaign.trauma 上。
export function healWithTrauma(state, inv, api, kind) {
  const traumaKey = kind === 'damage' ? 'physical' : 'mental'
  const targets = api.investigatorsAt(inv.location)
  if (!targets.length) return
  const chosen = targets.length === 1 ? String(targets[0].seat)
    : api.choice({ kind: 'target', source: '04274', seat: inv.seat, prompt: '选择要治疗的调查员。',
      options: targets.map(owner => ({ id: String(owner.seat), label: owner.name })) })
  const target = state.investigators[Number(chosen)] || inv
  const trauma = state.campaign?.trauma?.[target.seat]?.[traumaKey] || 0
  const amount = trauma >= 2 ? 2 : 1
  if (kind === 'damage') api.healDamage(target.seat, amount)
  else api.healHorror(target.seat, amount)
  api.info(`${target.name} 治疗 ${amount} 点${kind === 'damage' ? '伤害' : '恐惧'}。`)
}

// ---------------------------------------------------------------------------
// 05032 / 05280「否决存在」共用的窗口口径（两版印刷触发条件相同）。
//
// 卡面：快速。在遭遇卡牌或敌人攻击将要导致你执行以下一项（选择一项）时打出：
//   弃掉手牌、失去资源、失去行动、受到伤害、受到恐惧。你忽略该效果的影响。
//   （05280 升级版追加：然后对应地执行相反效果。）
//
// 规则书 FAQ 把幕/密谋/地点/敌人/诡计/弱点/场景卡都算遭遇卡，因此窗口 context.source.kind
// 由引擎的 reaction-source.js 统一标成 encounter/enemyAttack/other；卡文件只读这个字段。
// ---------------------------------------------------------------------------

export function denyExistenceSourceAllowed(context) {
  const kind = context?.source?.kind
  return kind === 'encounter' || kind === 'enemyAttack'
}

// 窗口候选是否可用：本人、来源合法、确有可忽略的分量。
export function denyExistenceCandidate({ inv, context }) {
  if (!context || context.seat !== inv?.seat) return false
  if (!denyExistenceSourceAllowed(context)) return false
  if (context.when === 'harmDealt') {
    return (Number(context.damage) || 0) > 0 || (Number(context.horror) || 0) > 0
  }
  if (context.when === 'wouldDiscardFromHand' || context.when === 'wouldLoseResources' || context.when === 'wouldLoseActions') {
    // 三个「将要……」窗口本身只在确有该效果时打开；不额外要求 amount 字段（旧窗口调用点不一定带）。
    return context.cancelled !== true
  }
  return false
}

// 「弃掉手牌 / 失去资源 / 失去行动」三个面向的取消结算。
// reverse=true 是 05280 的反向效果：抽等量牌 / 获得等量资源 / 获得等量额外行动。
// 取消事实（cardCancelled）由 executeDescriptor 的自动记账统一处理，这里不重复写。
export function ignoreWouldEffect({ inv, api, context, reverse = false }) {
  const what = context?.what
  const amount = Math.max(0, Number(context?.amount) || 0)
  context.cancelled = true
  const label = what === 'discard' ? '弃掉手牌' : what === 'resources' ? '失去资源' : '失去行动'
  if (!reverse) {
    api.info(`🛡️ 「否决存在」：${inv.name} 忽略了这次${label}的效果。`)
    return
  }
  if (what === 'discard') {
    api.info(`${inv.name} 用「否决存在」忽略${label}的效果，改为抽 ${amount} 张牌。`)
    api.drawCards(inv.seat, amount)
  } else if (what === 'resources') {
    api.info(`${inv.name} 用「否决存在」忽略${label}的效果，改为获得 ${amount} 资源。`)
    api.gainResources(inv.seat, amount)
  } else {
    api.info(`${inv.name} 用「否决存在」忽略${label}的效果，改为获得 ${amount} 次额外行动。`)
    api.gainAction(inv.seat, amount)
  }
}
