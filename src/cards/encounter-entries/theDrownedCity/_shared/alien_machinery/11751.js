// 11751 持久构造体（Persistent Construct）· 敌人 · 共享遭遇组 alien_machinery（印刷 3 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/alien_machinery。
// 卡面（cards-data 11751）：
//   猎手。
//   猎物 - 最近的控制[[神器]]支援的调查员。
//   强制 - 你击败本敌人时：将胜利区每名其他持久构造体以横置状态生成在你所在地点。
//
// 猎物由战役卡牌数据提供。猎手移动先确定最近调查员，再按神器支援判定同距时的目标。
// 由 enemyDefeated 窗口在当前构造体进入胜利区前结算，将已有的副本从胜利区以横置姿态生成。
const CODE = '11751'
const isConstruct = card => (card?.originalCode || card?.code || card) === CODE

export default {
  code: CODE,
  name: '持久构造体',
  scope: 'enemy',
  implemented: true,
  note: '最近调查员并列时优先控制神器的调查员；击败结算在当前卡进入胜利区前横置生成其他副本。',
  flags: {
    traits: ['Construct'],
    quantity: 3,
    fight: 2,
    evade: 2,
    health: 2,
    damage: 1,
    horror: 0,
    victory: 0,
    hunter: true,
  },
  abilities: [{
    kind: 'forced',
    trigger: 'enemyDefeated',
    silent: true,
    label: '你击败本敌人时：胜利区每名其他持久构造体在你所在地点横置生成',
    criteria: ({ state, source, context }) => Boolean(source?.id) && context?.enemy?.id === source.id
      && state.investigators[context.seat]?.location != null
      && state.victoryDisplay.some(isConstruct),
    resolve: ({ state, context, api }) => {
      const inv = state.investigators[context.seat]
      const count = state.victoryDisplay.filter(isConstruct).length
      for (let index = 0; index < count; index += 1) {
        api.scenario.takeFromVictory(CODE)
        api.scenario.spawn(CODE, inv.location, { exhausted: true })
      }
    },
  }],
}
