// 10714 玉米壳娃娃 · 剧情资产（传家宝 · 天真印记）（theFeastOfHemlockVale/_shared/heirlooms）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Fast. Uses (3 wishes).
//   [reaction] When a [skull] or [tablet] token is revealed at your location, spend 1 wish and exhaust
//     Corn Husk Doll: Treat that token as a [cultist] token instead.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/heirlooms（Heirlooms 遭遇组）。
// 获得条件：序曲 2 的蕾切尔嬷嬷法典 2（「Search the Heirlooms encounter set for the Corn Husk Doll story
//   asset and add it to your deck.」）→ 由战役写进战役牌组记录后才能在牌组里打出，因此声明
//   scenarioPlayable（引擎读点 src/engine/stats.js#runtimeCardAvailable）。
// 费用 1 / 饰品槽 / 特性 [[道具]][[守护]] / 技能图标 来自 cards-data。
//
// 读点（声明即接线）：
//   · 「快速」= 条目 fast；「使用 3 祝愿」= 条目 uses/usesType（newPlayerAssetInstance 初始化实例 uses，
//     资产面板按 usesType 展示）；
//   · 「花费 1 祝愿并横置」= cost.uses + cost.exhaust（费用求值、合法性判定与扣费同一口径）；
//   · 「在你的地点揭示 [skull]/[tablet] 时改为 [cultist]」= tokenReveal 窗口 + api.replaceChaosToken
//     （唯一读点：tests.js 的标记揭示段；替换后原标记归还混乱袋并按新标记继续结算）。
const CODE = '10714'
const NAME = '玉米壳娃娃'
const REPLACE_WITH = 'cultist'
const REPLACEABLE_TOKENS = Object.freeze(['skull', 'tablet'])

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  fast: true,
  scenarioPlayable: true,
  uses: 3,
  usesType: 'wish',
  flags: {
    heirloom: true,
    cost: 1,
    slot: 'accessory',
    traits: ['Item', 'Charm'],
    uses: 3,
    usesType: 'wish',
    replacesTokenWith: REPLACE_WITH,
    replaceableTokens: [...REPLACEABLE_TOKENS],
  },
  abilities: [{
    kind: 'reaction',
    trigger: 'tokenReveal',
    label: '在你的地点揭示[骷髅]或[石板]时，花费 1 祝愿并横置：改为视为[邪教徒]标记',
    cost: { uses: 1, exhaust: true },
    criteria: [({ inv, context }) => REPLACEABLE_TOKENS.includes(context?.token)
      && context.location === inv.location],
    resolve: ({ api, context }) => {
      if (!api.replaceChaosToken(context, REPLACE_WITH)) return false
      const from = api.tokenLabel?.(context.token) || context.token
      const to = api.tokenLabel?.(REPLACE_WITH) || REPLACE_WITH
      api.info?.(`🪆 「玉米壳娃娃」：花费 1 祝愿并横置，把 ${from} 视为 ${to} 结算。`)
      return true
    },
  }],
  note: '近似：印刷是「视为 [cultist]」，引擎的替换读点 api.replaceChaosToken 会把原标记归还混乱袋再按新标记结算，'
    + '因此不会额外消耗混乱袋里的标记（结果与印刷一致）。3 祝愿用 uses/usesType 承载；用尽后不弃置（无 discardWhenEmpty）。',
}
