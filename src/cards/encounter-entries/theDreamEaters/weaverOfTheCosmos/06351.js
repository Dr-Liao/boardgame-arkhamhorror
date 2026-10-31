// 06351 织网者（敌人，3 张）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：Spawn - 任意无人地点。Aloof。强制 - 当一轮结束时，如果织网者处于重整状态：
//       在织网者所在地点放置 1 个毁灭标记。
// 接线：enemyScript.onRoundEnd（共享层 roundEnded 派发）；生成规则写成 flags.spawn 数据，
//   由章节 behavior.spawnLocation 统一读（任意无人地点，多个候选时随机）。
export default {
  code: '06351',
  scope: 'enemy',
  implemented: true,
  flags: { spawn: { kind: 'anyEmptyLocation' } },
  enemyScript: {
    onRoundEnd(state, enemy, api) {
      if (enemy.exhausted) return
      const location = (state.locations || []).find(item => item.id === enemy.location)
      if (!location) return
      api.locationDoom?.add(location, 1)
      api.info?.(`🕸️ 一轮结束：织网者仍处于重整状态，在「${location.name}」上放置 1 个毁灭标记。`)
    },
  },
}
