// 03241b 死亡鬼灵
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：生成 - 起始地点。
// 卡面：猎手。反击。
// 卡面：死亡鬼灵处于横置状态时，每次对其造成的攻击伤害减1。
// 卡面：强制 - 你尝试躲避死亡鬼灵时技能检定失败后：其攻击你。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 死亡鬼灵（03241b）：横置时每次攻击伤害 -1；躲避失败后它攻击你。

export default {
  code: '03241b', scope: 'enemy', implemented: true,
  name: '死亡鬼灵',
  text: '横置时每次攻击伤害 -1。强制 - 你尝试躲避它时技能检定失败后：它攻击你。',
  enemyRule: { damageReductionWhileExhausted: 1, attacksOnFailedEvade: true },
}
