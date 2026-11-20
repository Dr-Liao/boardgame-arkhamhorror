// 11751 持久构造体（Persistent Construct）· 敌人 · 共享遭遇组 alien_machinery（印刷 3 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/alien_machinery。
// 卡面（cards-data 11751）：
//   猎手。
//   猎物 - 最近的控制[[神器]]支援的调查员。
//   强制 - 你击败本敌人时：将胜利区每名其他持久构造体以横置状态生成在你所在地点。
//
// 读点（声明即接线）：
//   · 战斗/躲避/生命/伤害/恐惧 = cards-data；猎手与猎物（控制神器支援的调查员）由章节
//     encounterDefinitions / 关卡定义提供；
//   · 「你击败本敌人时」= defeatEnemy 窗口（enemies.js#defeatEnemy 结算后的 reactionWindow，
//     context 带 enemy/seat）；非玩家条目的 forced 描述子在同一窗口派发；
//   · 「胜利区每名其他持久构造体」= 只读 state.victoryDisplay，然后逐张 api.scenario.takeFromVictory
//     （胜利区取回的唯一写点）+ api.scenario.spawn（敌人生成写点）+ api.scenario.exhaustEnemy（横置）。
const CODE = '11751'

export default {
  code: CODE,
  name: '持久构造体',
  scope: 'enemy',
  implemented: true,
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
    prey: 'artifactController',
  },
  abilities: [{
    kind: 'forced',
    trigger: 'defeatEnemy',
    silent: true,
    label: '你击败本敌人时：胜利区每名其他持久构造体在你所在地点横置生成',
    criteria: ({ source, context }) => Boolean(source?.id) && context?.enemy?.id === source.id,
    resolve: ({ state, context, api }) => {
      const inv = state.investigators?.[context?.seat]
      if (!inv) return
      const others = (state.victoryDisplay || [])
        .filter(card => String(card?.originalCode || card?.code || card) === CODE)
      for (const card of others) api.scenario?.takeFromVictory?.(card.code || CODE)
      if (!others.length) {
        api.info?.('⚙️ 「持久构造体」被击败：胜利区没有其他持久构造体。')
        return
      }
      for (let index = 0; index < others.length; index += 1) {
        const spawned = api.scenario?.spawn?.(CODE, inv.location)
        if (spawned) api.scenario?.exhaustEnemy?.(spawned)
      }
      api.info?.(`⚙️ 「持久构造体」被击败：胜利区 ${others.length} 名其他持久构造体在 ${inv.name} 所在地点横置生成。`)
    },
  }],
  note: '「击败时把胜利区的其他持久构造体横置生成」走 defeatEnemy 窗口 + api.scenario.takeFromVictory /'
    + ' spawn / exhaustEnemy。近似：胜利区取回按卡号逐张处理；若章节把被击败的构造体放到别的场外区域'
    + '（而不是胜利区），这些副本不会被这条能力拉回——需要章节内容把「被击败的持久构造体」放进胜利区。',
}
