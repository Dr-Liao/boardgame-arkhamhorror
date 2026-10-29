// 06012 托尼的猎物
// 卡面：生成 - 离托尼·摩尔根最远的地点。冷漠。
//       强制 - 托尼的猎物入场后：在其上放置 1 个毁灭标记。然后，在其上放置 1 资源(从供应堆拿取)，
//       作为赏金。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · `weaknessSpawnsAtFarthestLocation`：src/engine/weakness.js 的专属弱点生成位置（既有字段）。
//   · 入场后的强制效果挂在引擎既有的 `enemySpawn` 窗口上；赏金是通用具名计数器（counter.card）。

export default {
  code: '06012',
  scope: 'enemy',
  weaknessSpawnsAtFarthestLocation: true,
  enemyWeakness: { aloof: true },
  abilities: [
    {
      kind: 'forced',
      trigger: 'enemySpawn',
      label: '入场后：放置 1 毁灭与 1 赏金',
      silent: true,
      criteria: [({ context }) => context?.enemy?.code === '06012'],
      resolve: ({ inv, context, api }) => {
        const enemy = context.enemy
        api.setAssetDoom(enemy, (enemy.doom || 0) + 1)
        api.addCardCounter(enemy, 'bounty', 1)
        api.info(`「${enemy.name}」入场：放置 1 个毁灭标记与 1 点赏金。`)
      },
    },
  ],
  modifiers: [],
}
