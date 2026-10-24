// 01172 猎手夜魇
// 归属：跨战役通用
// 遭遇组：nightgaunts
// 卡面：猎手。
// 卡面：调查员尝试躲避狩猎中的夜魇时，揭示的每个混乱标记的负值修正翻倍。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 敌人卡面的特殊规则（原 card-rules.js 的 ENEMY_RULE_FLAGS，REPORT.md 第 3 批）
// 猎手夜魇（01172 / huntingNightgaunt）：负面标记双倍结算。

export default { implemented: true, code: '01172', name: '猎手夜魇', scope: 'enemy', text: '负面标记双倍结算。', enemyRule: { doubleNegative: true } }
