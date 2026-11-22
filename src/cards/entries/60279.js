// 60279 法老卷轴（研究完成·一）
// 卡面：研究完成。使用(4秘密)。[action] 受到 1 点恐惧并花费 1 或 2 秘密：每花费 1 秘密，揭示遭遇牌库顶 3 张，
// 弃掉其中 1 张非险境、非[[精英]]卡，其余按任意顺序放回遭遇牌库顶。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · [action] 费用 = cost { action, horror, uses }（横置/恐惧/秘密都走统一费用结算）；
//   · 额外花 1 秘密 = api.addUses(source, -1)（秘密标记的唯一写点；先按「剩余秘密 ≥1」判断可付）；
//   · 「揭示遭遇牌库顶 3 张、弃 1 张非险境/非精英、其余任意顺序放回顶部」= api.lookAt 一次完成：
//     zone:'encounterDeck' / count:3 / choose:0 / arrange:true / returnStrategy:'top'
//     + discardOne:{ count:1, filter:{ predicate } }（批次 3 新增读点：deck-ops.js#lookAt 在看牌后、
//     放回前按 filter 逐张询问弃牌，遭遇牌库来源弃进 encounterDiscard）。
//   · 险境（Peril）与 [[精英]] 都是卡面强制的排除项：cards-data 没有结构化的 peril 字段，
//     因此 predicate 只读 ALL_CARDS 数据——英文文本的 `Peril.` 关键词行（中文数据里对应
//     `险境` 独立行做兜底），精英读 traits 里的 `Elite`。
import { ALL_CARDS } from '../cards-data.js'

const CODE = '60279'

const isPeril = code => {
  const def = ALL_CARDS[code]
  if (!def) return false
  // 险境是关键词行（cards-data 无结构化字段）：英文 `Peril.` 行；中文文本里是独立的「险境」行。
  return /(^|\n)\s*Peril\s*\./i.test(String(def.text || ''))
    || /(^|\n)\s*险境\s*$/m.test(String(def.textZh || ''))
}

const isElite = code => (ALL_CARDS[code]?.traits || [])
  .some(trait => String(trait).toLowerCase() === 'elite')

// discardOne.filter.predicate：只允许「非险境、非精英」的卡被弃掉。
const canDiscard = code => Boolean(ALL_CARDS[code]) && !isPeril(code) && !isElite(code)

export default {
  code: CODE,
  uses: 4,
  usesType: 'secrets',
  abilities: [{
    kind: 'action',
    label: '受 1 恐惧并花 1-2 秘密：每秘密看遭遇牌库顶 3 张并弃 1 张非险境/非精英，其余按任意顺序放回顶部',
    cost: { action: true, horror: 1, uses: 1 },
    resolve: ({ inv, source, api }) => {
      // 基础费用已花 1 秘密；若还有剩余秘密，可选择额外再花 1 个（卡面「花费 1 或 2 秘密」）。
      const remaining = Math.max(0, Number(source?.uses) || 0)
      const spendTwo = remaining >= 1 && api.choice({
        kind: 'effect', source: CODE, seat: inv.seat, canSkip: true,
        prompt: '法老卷轴：是否额外花费 1 秘密（本能力共花费 2 秘密）？',
        options: [{ id: 'one', label: '只花费 1 秘密' }, { id: 'two', label: '花费 2 秘密' }],
      }) === 'two'
      if (spendTwo) api.addUses(source, -1)
      const times = spendTwo ? 2 : 1
      for (let index = 0; index < times; index += 1) {
        api.lookAt(inv.seat, {
          zone: 'encounterDeck',
          count: 3,
          choose: 0,
          arrange: true,
          returnStrategy: 'top',
          discardOne: { count: 1, filter: { predicate: canDiscard } },
          source: CODE,
          prompt: '法老卷轴：揭示遭遇牌库顶 3 张；选择弃掉 1 张非险境、非精英卡牌，然后将其余卡牌按任意顺序放回遭遇牌库顶。',
        })
      }
    },
  }],
  modifiers: [],
}
