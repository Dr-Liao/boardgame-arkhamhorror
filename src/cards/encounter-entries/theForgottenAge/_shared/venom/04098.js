// 04098 伊格的獠牙
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：venom
// 卡面：猎物 - 中毒的调查员。
// 卡面：反击。
// 卡面：伊格的獠牙与中毒的调查员交战时，该调查员不能打出卡牌，也不能在技能检定中投入卡牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '04098', scope: 'enemy', implemented: true, enemySpawnRule: { preyPoisoned: true } }
