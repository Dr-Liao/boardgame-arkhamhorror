// 10103 超凡织造（Ethereal Weaving）· 神秘者事件 · 1 资源 · 3 经验 · [[灵魂]]/[[双重]]（Double）
// 卡面：
//   作为打出超凡织造的额外费用，花费一个行动。
//   从你手牌揭示最多 3 张不同的 [[法术]] 事件。依次打出每张揭示的事件，其费用减少 1 点。
//   结算这些事件时，你得到技能值 +2。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「双重」= played 描述子 cost:{ action: 1 }（ability.js#playedActionCost：legalMoves / validateMove /
//     doPlay 三处同源校验并扣减，卡面 resolve 不重复实现；10027/10093 同款）。
//   · 「你手牌中的 [[法术]] 事件」= inv.hand 按卡面数据 traits/type 过滤（按卡名去重 = 卡面的「不同」）。
//   · 依次调用 api.playAsEffect，折扣和技能加值随这张事件结算。
// 技能加值与单次打出事件一起进入其结算作用域。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10103'
const SPELL = 'spell'
const MAX_REVEAL = 3

const traitsOf = code => (ALL_CARDS[code]?.traits || []).map(trait => String(trait).toLowerCase())
const nameOf = code => ALL_CARDS[code]?.name || code

// 「你手牌中的 [[法术]] 事件」：同名副本只算一张（卡面写「不同」）。
const spellEventsInHand = inv => {
  const seen = new Set()
  const codes = []
  for (const code of inv.hand || []) {
    if (code === CODE) continue
    const def = ALL_CARDS[code]
    if (!def || def.type !== 'event' || !traitsOf(code).includes(SPELL)) continue
    if (seen.has(def.name)) continue
    seen.add(def.name)
    codes.push(code)
  }
  return codes
}

export default {
  code: CODE,
  name: '超凡织造',
  playCondition: [{
    when: ({ inv }) => spellEventsInHand(inv).length > 0,
    message: '你手牌里没有 [[法术]] 事件',
  }],
  abilities: [
    {
      kind: 'played',
      cost: { action: 1 },
      label: '额外花 1 行动：揭示至多 3 张不同的[[法术]]事件并依次打出（每张费用 -1、结算时技能值 +2）',
      resolve: ({ inv, api }) => {
        const pool = spellEventsInHand(inv)
        if (!pool.length) {
          api.info('「超凡织造」：你手牌里没有 [[法术]] 事件。')
          return
        }
        const revealed = []
        while (revealed.length < MAX_REVEAL) {
          const remaining = pool.filter(code => !revealed.includes(code))
          if (!remaining.length) break
          const picked = api.choice({
            kind: 'card', source: CODE, seat: inv.seat, canSkip: true,
            prompt: `「超凡织造」：揭示你手牌中的一张[[法术]]事件来打出（已揭示 ${revealed.length} 张，最多 ${MAX_REVEAL} 张）。`,
            options: [{ id: 'done', label: '不再揭示' },
              ...remaining.map(code => ({ id: code, cardCode: code, label: `${nameOf(code)}（费用 -1）` }))],
          })
          if (picked === 'done' || !remaining.includes(picked)) break
          revealed.push(picked)
        }
        if (!revealed.length) {
          api.info('「超凡织造」：没有揭示任何[[法术]]事件。')
          return
        }
        api.info(`🌀 「超凡织造」：揭示并依次打出 ${revealed.map(nameOf).join('、')}（每张费用 -1，结算时技能值 +2）。`)
        for (const code of revealed) {
          if (!(inv.hand || []).includes(code)) continue
          if (!api.playAsEffect(inv.seat, code, { discount: 1, skillBonus: 2 })) {
            api.info(`「超凡织造」：「${nameOf(code)}」当前无法打出。`)
          }
        }
      },
    },
  ],
  modifiers: [],
}
