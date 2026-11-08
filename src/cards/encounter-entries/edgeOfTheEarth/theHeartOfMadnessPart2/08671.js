// 08671 封印渐弱（The Seal Weakens）· 议程 4
// 正面无文本；背面：在最靠近调查员的迷雾高塔生成 1 份放一边的「无名的疯狂」，并检查战役日志
// （真相分支由战役 flow 写入记录）。读点：behavior.agendaLeftPlay 按 backEffect 分派。
export default {
  code: '08671',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    backEffect: 'spawnNamelessAtPylon',
    onReveal(state, agenda, api) {
      api.info?.('🫀 封印渐弱：只等瘴气吞没最后的理智。')
    },
  },
}
