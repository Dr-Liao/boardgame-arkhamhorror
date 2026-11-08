// 08672 无名者（That Which Has No Name）· 议程 5
// 强制 - 当 1+ 毁灭将被放置时，如果还有放一边的「无名的疯狂」：改为在「离调查员最近、且与已有
// 该敌人所在连接的地点」生成 1 份。目标 - 回合结束时，如果 15 份都在场且并非所有迷雾高塔坍塌，推进。
// 背面：清场 + 铺泰坦坡道 + 隐藏隧道（rampSequence，由 behavior 统一实现）。
export default {
  code: '08672',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    backEffect: 'rampSequence',
    objective: { type: 'namelessInPlay' },
    forced: {
      doomWouldBePlaced(state, agenda, api) {
        api.info?.('👁️ 无名者：毁灭将被替换为生成 1 份无名的疯狂（P8 毁灭替换批次近似）。')
      },
    },
  },
  flags: { finalMirageDoomReplacement: true },
}
