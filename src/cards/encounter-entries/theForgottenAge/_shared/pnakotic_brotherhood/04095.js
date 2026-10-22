// 04095 兄弟会教徒
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：pnakotic_brotherhood
// 卡面：猎手。
// 卡面：兄弟会异教徒上每有一个毁灭标记，其得到+1攻击值和+1躲避值。
// 卡面：强制 - 在你对兄弟会异教徒发动一次攻击时：在兄弟会异教徒上放置1个毁灭标记。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 兄弟会教徒（04095）：它身上每有 1 个毁灭标记，战斗与躲避 +1。
// 迁移自 theForgottenAge/encounter-rules.js 的 enemyStatModifier 分支。

export default {
  code: '04095', implemented: true,
  name: '兄弟会教徒',
  scope: 'enemy',
  text: '它身上每有 1 个毁灭标记，它的战斗与躲避 +1。对你发动攻击时放置 1 个毁灭。',
  enemyRule: { doomOnAttacked: 1 },
  modifiers: [
    { target: 'enemyFight', amount: ({ entity }) => entity.doom || 0 },
    { target: 'enemyEvade', amount: ({ entity }) => entity.doom || 0 },
  ],
}
