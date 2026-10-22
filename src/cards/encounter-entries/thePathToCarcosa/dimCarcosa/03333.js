// 03333 哈斯塔
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：猎物 - 剩余神智值最高。
// 卡面：猎手。庞大。
// 卡面：如果哈斯塔的攻击造成的恐惧超出你的神智值，你还受到1点伤害。
// 卡面：没有剩余神智值的调查员攻击或躲避哈斯塔时，将该调查员揭示的每个[elder_sign]、“+1”、“0”和“-1”标记视为[auto_fail]标记。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 哈斯塔（卡尔克萨领主，03333）：猎物＝剩余神智最高；恐惧溢出额外 1 伤害；无剩余神智时的符号视为自动失败。

export default {
  code: '03333', scope: 'enemy', flags: { hastur: true },
  enemyRule: { prey: 'mostRemainingSanity', excessHorrorDamage: true, noSanityAutoFailTokens: true },
}
