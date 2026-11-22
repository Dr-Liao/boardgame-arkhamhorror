// 12099 无名潜伏者（The Nameless Lurker）· 中立 · 敌人/人形/怪物 · 基础弱点。
//
// 卡面：
//   冷漠。
//   生成 - 最远的无人地点。
//   强制 - 在调查阶段结束时，如果无名潜伏者处于重整状态且其上没有毁灭标记：
//     在其上放置 1 个毁灭标记。
//
// 引擎读点：
//   · 冷漠：条目 `enemyWeakness.aloof`（card-lookup.js#enemyDef 合并进敌人定义）。
//   · 生成：`weaknessSpawnsAtFarthestEmptyLocation`（weakness.js 的敌人弱点生成分支优先选
//     「最远且没有调查员的地点」，没有无人候选时回退到最远地点）。
//   · 「调查阶段结束时」：`investigationPhaseEnds` 窗口（turn.js#runBetweenInvestigationPhases，
//     只在有监听者时开窗；hasWindowListener 会把在场敌人算作监听者）；
//     非玩家实体的强制能力由 openAbilityWindow 的实体段派发，source = 该敌人实例。
//   · 放毁灭：api.placeDoomOnCard（卡上毁灭的唯一写入口）。

const code = '12099'

export default {
  code,
  scope: 'enemy',
  enemyWeakness: { aloof: true },
  weaknessSpawnsAtFarthestEmptyLocation: true,
  abilities: [{
    kind: 'forced',
    trigger: 'investigationPhaseEnds',
    label: '调查阶段结束时：若本敌人重整且没有毁灭，在其上放置 1 个毁灭',
    criteria: [({ source }) => Boolean(source) && !source.defeated
      && !source.exhausted && !((source.doom || 0) > 0)],
    resolve: ({ source, api }) => {
      api.placeDoomOnCard(source, 1)
      api.info(`「${api.cardName(code)}」上放置了 1 个毁灭标记。`)
    },
  }],
  modifiers: [],
}
