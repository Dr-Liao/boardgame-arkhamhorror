import { ALL_CARDS } from '../../../_shared.js'

// 11762 鸦片酊 · 远征剧情资产 · 共享遭遇组 tdc_expedition
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tdc_expedition（CONTRACT §6，印刷 1–4 张）。
// 卡面（cards-data 11762，原文见该卡 textZh）：
//   使用(3补给)。
//   [action]花费1个补给：治愈你所在地点一位调查员的1点恐惧。
//   [reaction]你抽取一张非弱点[[力量]]或[[恐怖]]诡计时，将鸦片酊从游戏中移除：取消该诡计的显现效果并弃掉它。
//
// 读点（声明即接线）：
//   · 「[action] 花费 1 补给：治愈你所在地点一位调查员的 1 点恐惧」= kind action + cost { action: 1, uses: 1 } + api.healHorror；
//   · 「[reaction] 你抽取一张非弱点[[力量]]或[[恐怖]]诡计时移出游戏：取消该诡计的显现效果并弃掉它」= treachery 打断窗口（treachery-tokens.js 的 reactionWindow(state, 'treachery')）+ context.cancelled = true + cost { exileSelf: true }；取消后引擎把该卡弃进遭遇弃牌堆。
//
// 归属与发放：Setup「每名玩家选择 1 项已获得的文物或远征物品入场」由章节 setup 用
//   api.giveAsset / scenarioRuntime.giveAsset 放到调查员控制下（sepulchreOfTheSleeper/definition.js
//   的 EXPEDITION_ITEM_CODES / EXPEDITION_ALLY_CODES）；giveAsset 走 newCardInstance，不复制条目
//   uses，因此「使用(N)」的初始化由章节/战役侧照抄条目 uses（EotE 08714–08722 同一口径）。

// 「你所在地点一位调查员」：只有一位时直接返回，多位时由卡牌控制者选。
function healAtLocation (state, inv, api, kind) {
  const here = (state.investigators || []).filter(other => !other.defeated && !other.resigned
    && other.location === inv.location)
  if (!here.length) return 0
  const seat = here.length === 1 ? here[0].seat : Number(api.choice({
    kind: 'investigator', source: CODE, seat: inv.seat,
    prompt: '选择同地点受到治疗的调查员。',
    options: here.map(other => ({ id: String(other.seat), label: other.name })),
  }))
  const target = here.find(other => other.seat === seat) || here[0]
  if (kind === 'damage') api.healDamage(target.seat, 1)
  else api.healHorror(target.seat, 1)
  return target.seat
}

// 卡面特性判定：[[Glyph]] / [[R'lyeh]] / [[Power]] / [[Terror]]（cards-data 的 traits）。
const hasTraits = (code, wanted) => {
  if (!code) return false
  const traits = ALL_CARDS[code]?.traits || []
  return wanted.some(trait => traits.some(value => String(value).toLowerCase() === trait.toLowerCase()))
}

const CODE = '11762'

export default {
  code: CODE,
  name: '鸦片酊',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'supplies',
  flags: { expedition: true, traits: ['Item', 'Supply'], slotless: true },
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    label: '花费 1 补给：治愈同地点一位调查员 1 点恐惧',
    cost: { action: 1, uses: 1 },
    resolve: ({ state, inv, api }) => healAtLocation(state, inv, api, 'horror'),
  },
  {
    kind: 'reaction',
    trigger: 'treachery',
    label: '移出游戏：取消这张力量/恐怖诡计的显现效果',
    criteria: ({ context }) => !context?.weakness && !context?.cannotCancel && hasTraits(context?.cardCode, ['Power', 'Terror']),
    cost: { exileSelf: true },
    resolve: ({ context, api }) => {
      if (!context || context.cancelled) return
      context.cancelled = true
      api.info('🛡️ 「鸦片酊」移出游戏：取消了「' + api.cardName(context.cardCode) + '」的显现效果。')
    },
  }],
  note: '取消走 treachery 窗口的 context.cancelled（与 05014/05259 同一取消口径），取消后由引擎弃进遭遇弃牌堆；'
    + '「[[力量]]/[[恐怖]]」按 cards-data 的 Power / Terror 特性判定。',
}
