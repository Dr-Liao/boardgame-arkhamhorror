// 10681 欢迎来到毒堇谷！ · 议程 1 · 共享遭遇组 day_of_rest
// 归属：战役共用 · theFeastOfHemlockVale/_shared/day_of_rest（印刷 1 张；welcomeToHemlockVale 为当前唯一使用章的序曲）。
// 卡面（cards-data 10681）：毁灭阈值 6。
//   强制 - 在你抽取弱点时：取消其显现效果，将其弃掉。
//   背面「Time to Get to Work!」：所有调查员撤退（→ 结局 1）。
//
// 读点：
//   · 毁灭阈值/背面由章 definition 的 stage()/agendaStages 与行为 agendaReveal 承接；
//   · 「抽到弱点时取消显现」挂引擎的 cardWouldBeDrawn 弱点子窗口（deck-ops.js#drawCards 打开，
//     context = { weakness: true, cardCode, seat, from: 'deck', cancelled }）：本条目把 context.cancelled
//     置真，引擎随即把该牌洗回牌库（印刷是「弃掉」，见 note 的近似披露）。
export default {
  code: '10681',
  scope: 'agenda',
  implemented: true,
  flags: {
    doomThreshold: 6,
    stage: 1,
    forcedCancelWeaknessRevelation: true,
    back: { allResign: true, resolution: 'resolution1', name: 'Time to Get to Work!' },
    preludeOnly: 'welcomeToHemlockVale',
  },
  abilities: [{
    kind: 'forced',
    trigger: 'cardWouldBeDrawn',
    silent: true,
    label: '抽取弱点时：取消其显现效果（近似：该牌洗回牌库）',
    criteria: ({ context }) => context?.weakness === true && context.cancelled !== true,
    resolve: ({ context, api }) => {
      if (!context || context.weakness !== true || context.cancelled === true) return
      context.cancelled = true
      api.info?.('🌫️ 「欢迎来到毒堇谷！」：取消抽到的弱点的显现效果。')
    },
  }],
  note: 'approximation: 引擎的弱点子窗口只能「取消抽取」（牌洗回牌库），无法表达「取消显现后弃掉」；'
    + '因此本实现把取消落到 context.cancelled（deck-ops 读点），不新增状态。',
}
