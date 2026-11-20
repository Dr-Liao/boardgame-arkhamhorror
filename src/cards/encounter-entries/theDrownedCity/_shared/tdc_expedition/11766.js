// 11766 安迪·范·诺特维克 · 远征剧情资产 · 共享遭遇组 tdc_expedition
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tdc_expedition（CONTRACT §6，印刷 1–4 张）。
// 卡面（cards-data 11766，原文见该卡 textZh）：
//   你得到+1[intellect]。
//   如果你所在地点没有线索，每轮中，你可以忽略对你进行的首次趁乱攻击。
//
// 读点（声明即接线）：
//   · 「你得到 +1 智力」= modifiers 的 { target: 'skill:intellect', amount: 1 }；
//   · 「如果你所在地点没有线索，每轮中你可以忽略对你进行的首次趁乱攻击」= opportunityAttack 窗口（dispatch.js 在每次借机攻击前开窗，context.firstThisRound 为本轮首次）+ context.cancelled = true；trackRoundActionHistory: true 让引擎按轮记账（recordRoundAction），否则 firstThisRound 永远为真。
//
// 归属与发放：Setup「每名玩家选择 1 项已获得的文物或远征物品入场」由章节 setup 用
//   api.giveAsset / scenarioRuntime.giveAsset 放到调查员控制下（sepulchreOfTheSleeper/definition.js
//   的 EXPEDITION_ITEM_CODES / EXPEDITION_ALLY_CODES）；giveAsset 走 newCardInstance，不复制条目
//   uses，因此「使用(N)」的初始化由章节/战役侧照抄条目 uses（EotE 08714–08722 同一口径）。
const CODE = '11766'

export default {
  code: CODE,
  name: '安迪·范·诺特维克',
  scope: 'storyAsset',
  implemented: true,
  trackRoundActionHistory: true,
  flags: { expedition: true, traits: ['Ally', 'Reporter'], slots: ['ally'], unique: true },
  modifiers: [{ target: 'skill:intellect', amount: 1 }],
  abilities: [{
    kind: 'reaction',
    trigger: 'opportunityAttack',
    label: '忽略对你进行的本轮首次趁乱攻击',
    criteria: ({ state, inv, context }) => context?.firstThisRound === true
      && context?.seat === inv.seat
      && (state.locations || []).find(location => location.id === inv.location)?.clues === 0,
    resolve: ({ inv, api, context }) => {
      context.cancelled = true
      api.info('📰 「安迪·范·诺特维克」：' + inv.name + ' 忽略了本轮的首次趁乱攻击。')
    },
  }],
  note: '「首次趁乱攻击」= opportunityAttack 窗口的 context.firstThisRound（引擎按轮记账，需 trackRoundActionHistory: true）；'
    + '「所在地点没有线索」读 location.clues === 0；取消沿用 context.cancelled 的 interrupt 口径。',
}
