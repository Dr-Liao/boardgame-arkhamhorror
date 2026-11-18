// 10683 乌云 · 议程 1 · 共享遭遇组 day_of_rain
// 归属：战役共用 · theFeastOfHemlockVale/_shared/day_of_rain（印刷 1 张；dawnOfTheSecondDay 为当前使用章的序曲）。
// 卡面（cards-data 10683）：毁灭阈值 6。
//   强制 - 在你抽取弱点时：取消其显现效果，将其弃掉。
//   背面「Gnawing Hunger（饥肠辘辘）」：检查剧本日志 —— 如果 Bertie was rescued，（→ 结局 1）；否则（→ 结局 2）。
//
// 读点：毁灭阈值/背面分支由 dawnOfTheSecondDay 的 agendaStages 与 behavior.agendaReveal 承接
//   （章节读 campaign.records 的救援记录选结局）；「抽到弱点取消显现」与 10681 同一条读点：
//   cardWouldBeDrawn 弱点子窗口的 context.cancelled（引擎随后把该牌洗回牌库，见 note 的近似披露）。
export default {
  code: '10683',
  scope: 'agenda',
  implemented: true,
  flags: {
    doomThreshold: 6,
    stage: 1,
    forcedCancelWeaknessRevelation: true,
    back: {
      name: 'Gnawing Hunger',
      branchOnRecord: 'bertieWasRescued',
      ifRescued: 'resolution1',
      otherwise: 'resolution2',
    },
    preludeOnly: 'dawnOfTheSecondDay',
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
      api.info?.('🌫️ 「乌云」：取消抽到的弱点的显现效果。')
    },
  }],
  note: 'approximation: 引擎的弱点子窗口只能「取消抽取」（洗回牌库），无法表达「取消显现后弃掉」；背面按日志分支结算在章节 behavior。',
}
