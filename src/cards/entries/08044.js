// 08044 通路档案
// 只有带灵脉的调查员可获得抽牌和治愈，强化效果从目标调查员移除灵脉。
import { cardCounterOf } from '../../engine/card-counters.js'

const code = '08044'
const active = person => !person.defeated && !person.resigned
const marked = person => active(person) && cardCounterOf(person, 'leyline') > 0

const chooseInvestigator = (candidates, inv, api, prompt) => {
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]
  const seat = Number(api.choice({ kind: 'investigator', source: code, seat: inv.seat, prompt,
    options: candidates.map(person => ({ id: String(person.seat), label: person.name })) }))
  return candidates.find(person => person.seat === seat)
}

export default {
  code,
  uses: 4,
  usesType: 'leyline',
  abilities: [
    {
      kind: 'entersPlay',
      label: '入场：获得 4 个灵脉',
      resolve: ({ source, api }) => { if (source) api.setAssetUses(source, 4) },
    },
    {
      kind: 'free',
      label: '从本支援移动 1 灵脉到一位调查员',
      cost: { uses: 1 },
      criteria: ({ state }) => state.investigators.some(active),
      resolve: ({ state, inv, api }) => {
        const target = chooseInvestigator(state.investigators.filter(active), inv, api, '选择要放置灵脉的调查员。')
        if (target) api.addCardCounter(target, 'leyline')
      },
    },
    {
      kind: 'action',
      label: '带灵脉的调查员抽 1 张并治愈 1 点；可移除其灵脉强化',
      cost: { action: true },
      criteria: ({ state }) => state.investigators.some(marked),
      resolve: ({ state, inv, api }) => {
        const target = chooseInvestigator(state.investigators.filter(marked), inv, api, '选择带有灵脉的调查员。')
        if (!target) return
        const remove = api.choice({ kind: 'effect', source: code, seat: inv.seat, canSkip: true,
          prompt: '是否移除该调查员的 1 灵脉，让本次抽牌与治愈改为 2？',
          options: [{ id: 'skip', label: '不移除' }, { id: 'remove', label: '移除灵脉以强化' }],
        })
        const amount = remove === 'remove' ? 2 : 1
        if (amount === 2) api.addCardCounter(target, 'leyline', -1)
        api.drawCards(target.seat, amount)
        const kind = api.choice({
          kind: 'effect', source: code, seat: target.seat, prompt: '治愈伤害还是恐惧？',
          options: [{ id: 'damage', label: '治愈伤害' }, { id: 'horror', label: '治愈恐惧' }],
        })
        if (kind === 'horror') api.healHorror(target.seat, amount)
        else if (kind === 'damage') api.healDamage(target.seat, amount)
      },
    },
  ],
  modifiers: [],
}
