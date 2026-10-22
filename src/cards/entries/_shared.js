// 卡牌行为文件共用的窄工具（只放跨卡复用的原语，不放某张卡的规则）。
//
// 这里的内容原来在 card-abilities.js 顶部；拆分后由各 entries/<code>.js 按需 import。

import { registeredEntry } from '../../engine/ability.js'

// 调查员的旧印数据在条目自己的 `investigator.elderSign` 里；用惰性代理读取，
// 避免卡文件在模块初始化时反向依赖 card-effects（第 6 批）。
export const investigatorSign = code => new Proxy({}, {
  get: (_, key) => registeredEntry(code)?.investigator?.elderSign?.[key],
})

export const skillModifier = (skill, amount, condition) =>
  ({ target: `skill:${skill}`, amount, ...(condition ? { condition } : {}) })

export const allSkillModifiers = (amount, condition) =>
  ['willpower', 'intellect', 'combat', 'agility'].map(skill => skillModifier(skill, amount, condition))

export const SKILL_NAMES_ZH = Object.freeze({
  willpower: '意志', intellect: '智识', combat: '战斗', agility: '敏捷',
})

export const CHAOS_SYMBOLS = ['skull', 'cultist', 'tablet', 'elderthing', 'autofail']

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
