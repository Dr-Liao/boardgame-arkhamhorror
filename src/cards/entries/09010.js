// 09010「弗莱彻探员」（Agent Fletcher）· 敌人 · 基玛尼专属弱点
// 卡面：警戒。猎手。猎物 - 仅限基玛尼·琼斯。
//   当基玛尼·琼斯躲避弗莱彻探员时，将其 [intellect] 值降为 0。
//
// 读点：enemyWeakness{ hunter, prey } 由 card-lookup 合并；testBegins 窗口读 state.skillTest。
export default {
  code: '09010',
  scope: 'enemy',
  enemyWeakness: { alert: true, hunter: true, prey: true },
  abilities: [
    {
      kind: 'forced',
      trigger: 'testBegins',
      silent: true,
      label: '基玛尼躲避弗莱彻探员时：其智识值降为 0',
      criteria: [({ state, inv, source }) => {
        const test = state.skillTest
        if (!test || test.seat !== inv.seat || test.actionKind !== 'evade') return false
        return Boolean(source) && test.target?.kind === 'enemy' && test.target.id === source.id
      }],
      resolve: ({ inv, api }) => {
        const intellect = api.stat(inv.seat, 'intellect')
        if (intellect) api.addTestValue(-intellect)
      },
    },
  ],
  modifiers: [],
}
