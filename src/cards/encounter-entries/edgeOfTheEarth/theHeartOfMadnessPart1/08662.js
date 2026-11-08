// 08662 休眠（Dormancy）· 幕 1
// 正面目标：如果有激活封印放在伊夸之门上，推进。背面：按刚放上的封印种类分别治疗效果（由 P8 封印批次接通）。
// 读点：objective 数据由 definition/behavior.checkObjectives 读取（引擎 act-agenda.js 直接读 act.objective）。
export default {
  code: '08662',
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { type: 'activatedSealOnGate' },
    onLeave(state, act, api) {
      api.info?.('🫀 休眠背面：检查刚放上门的激活封印并结算对应治疗/抽牌/额外行动（封印批次近似）。')
    },
  },
}
