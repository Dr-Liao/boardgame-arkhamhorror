// 08128 驯兽之杖（Rod of Animalism）
// 卡面：你拥有额外 2 个盟友槽位，只可以用来携带[[生物]]支援。
// [reaction] 你在自己回合期间打出[[生物]]支援时：该支援的费用减 1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 受限额外槽 = 引擎既有 restrictedSlots（01008 书位 / 02147 武器位同一原语），
//     只给带 [[Creature]] 特性的候选；
//   · 费用 -1 = modifiers 的 playCost 目标（唯一读点 modifiers.js#playCostDelta），
//     只对「生物」支援、且只在该卡控制者自己的回合生效（卡面「你在自己回合期间打出」）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const code = '08128'

function isCreatureAsset(cardCode) {
  const def = ALL_CARDS[cardCode]
  return Boolean(def) && def.type === 'asset'
    && (def.traits || []).some(trait => String(trait).toLowerCase() === 'creature')
}

export default {
  code,
  restrictedSlots: [
    { slot: 'ally', traitsAny: ['Creature'], count: 2 },
  ],
  modifiers: [
    {
      target: 'playCost',
      amount: ({ state, inv, cardCode }) => (state?.currentSeat === inv?.seat && isCreatureAsset(cardCode) ? -1 : 0),
    },
  ],
  abilities: [],
}
