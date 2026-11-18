// 10713 忘忧石 · 剧情资产（传家宝 · 平安护符）（theFeastOfHemlockVale/_shared/heirlooms）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Fast.
//   [reaction] When a scenario card effect discards Worry Rock from your hand: Draw 3 cards.
//     (Limit once per game.)
// 归属：战役共用 · theFeastOfHemlockVale/_shared/heirlooms（Heirlooms 遭遇组）。
// 获得条件：序曲 1 / 幕间奖励「Search the Heirlooms encounter set for the Worry Rock story asset and add it
//   to your deck. It does not count toward your deck size.」→ 普通牌组外的剧情资产，由战役把它写进
//   战役牌组记录后才能在牌组里打出，因此声明 scenarioPlayable（唯一引擎读点
//   src/engine/stats.js#runtimeCardAvailable；授予事实源是 campaign.investigators[seat].deck）。
// 费用 1 / 饰品槽 / 特性 [[道具]][[守护]][[祝福]] 来自 cards-data。
//
// 读点（声明即接线）：
//   · 「快速」= 条目 fast（快速打出读点）；
//   · 「冒险卡效果从你手中弃掉本卡后」= handCardDiscarded 窗口：ability-exec 会把刚被弃掉的那张牌本身
//     作为候选来源（registeredEntry(context.cardCode) + inv.discard.includes），因此弃牌堆里的本卡也能触发；
//   · 「每场游戏仅限一次」= limit perGame / owner instance（state.abilityLimits 记账）；
//   · 抽 3 张 = api.drawCards（deck-ops 的唯一抽牌入口）。
const CODE = '10713'
const NAME = '忘忧石'

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  fast: true,
  scenarioPlayable: true,
  flags: {
    heirloom: true,
    cost: 1,
    slot: 'accessory',
    traits: ['Item', 'Charm', 'Blessed'],
    trigger: 'scenarioDiscardsFromHand',
    draws: 3,
  },
  abilities: [{
    kind: 'reaction',
    trigger: 'handCardDiscarded',
    label: '冒险卡效果从你手中弃掉忘忧石后：抽 3 张卡牌（每场游戏一次）',
    limit: { scope: 'perGame', owner: 'instance' },
    criteria: [({ inv, context }) => context?.seat === inv.seat
      && context.cardCode === CODE && (inv.discard || []).includes(CODE)],
    resolve: ({ inv, api }) => {
      api.drawCards(inv.seat, 3)
      api.info?.('🪨 「忘忧石」：从手牌被弃掉后抽 3 张卡牌（每场游戏一次）。')
      return true
    },
  }],
  note: '近似：handCardDiscarded 窗口不区分「冒险卡效果」与其它弃牌来源（引擎对同一次弃手牌只开这一个窗口），'
    + '因此其它效果弃掉忘忧石时也会被询问；「每场游戏一次」用 limit perGame 保证不重复。',
}
