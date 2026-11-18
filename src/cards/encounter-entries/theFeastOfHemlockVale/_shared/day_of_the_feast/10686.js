// 10686 爱意满满 · 议程 1 · 共享遭遇组 day_of_the_feast
// 归属：战役共用 · theFeastOfHemlockVale/_shared/day_of_the_feast（dawnOfTheFinalDay / preludeTheFinalEvening /
//   fateOfTheVale 都 gather 本组）。
// 卡面（cards-data 10686）：毁灭阈值 6。
//   强制 - 在你抽取弱点时：取消其显现效果，将其弃掉。
//   背面「Bertie's Choice（伯蒂的选择）」：检查剧本日志 —— 如果伯蒂见证了显灵（had an epiphany）：读一段后
//   （→ 结局 2）；否则读另一段后（→ 结局 1）。
//
// 读点：毁灭阈值/背面分支由使用章的 agendaStages 与 behavior.agendaReveal 承接（读 campaign.records 的
//   显灵记录选结局）；「抽到弱点取消显现」与 10681/10683 同一条读点：cardWouldBeDrawn 弱点子窗口的
//   context.cancelled（引擎随后把该牌洗回牌库，见 note）。
export default {
  code: '10686',
  scope: 'agenda',
  implemented: true,
  flags: {
    doomThreshold: 6,
    stage: 1,
    forcedCancelWeaknessRevelation: true,
    back: {
      name: "Bertie's Choice",
      branchOnRecord: 'bertieHadAnEpiphany',
      ifEpiphany: 'resolution2',
      otherwise: 'resolution1',
    },
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
      api.info?.('🌫️ 「爱意满满」：取消抽到的弱点的显现效果。')
    },
  }],
  note: 'approximation: 引擎的弱点子窗口只能「取消抽取」（洗回牌库），无法表达「取消显现后弃掉」；背面按日志分支结算在章节 behavior。',
}
