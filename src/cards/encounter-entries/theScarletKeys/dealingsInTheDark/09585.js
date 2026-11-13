// 09585 幽影预示者（Umbral Harbinger）· 敌人 · dealings_in_the_dark
// 卡面：猎手。
//   强制 - 在幽影预示者受到伤害时：在离它最近的[[异教徒]]敌人上放置 1 个毁灭标记。
// 读点：
//   · 猎手来自定义表 keyword 解析（card-data 读取卡文里的 `Hunter.`）。
//   · 「受到伤害后」= 引擎的 `enemyDamaged` 事件窗口（非玩家强制能力来源包含在场敌人）。
//   · 「最近的[[异教徒]]」= api.scenario.resolveScenarioEvent('dealingsDoomOnNearestCultist')
//     —— 本章 behavior 只实现一次（09587/09588 共用同一句）。
const CODE = '09585'

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  abilities: [{
    kind: 'forced',
    trigger: 'enemyDamaged',
    silent: true,
    label: '受到伤害时：在离它最近的[[异教徒]]敌人上放 1 毁灭',
    criteria: ({ state, source, context }) => Boolean(source && context?.enemy && context.enemy.id === source.id
      && (state.enemies || []).includes(source)),
    resolve: ({ source, api }) => {
      const result = api.scenario.resolveScenarioEvent('dealingsDoomOnNearestCultist', { from: source.location })
      if (!result) {
        api.info?.('幽影预示者受到伤害，但场上没有[[异教徒]]敌人。')
        return
      }
      api.info?.(`🌑 幽影预示者受到伤害：在最近的「${result.name}」上放 1 个毁灭。`)
    },
  }],
  note: '「最近的[[异教徒]]」由本章 behavior 的 dealingsDoomOnNearestCultist 事件统一实现（多张卡共用）。',
}
