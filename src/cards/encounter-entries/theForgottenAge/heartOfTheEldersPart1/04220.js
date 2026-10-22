// 04220 蛇怪
// 归属：关卡专用 · heartOfTheEldersPart1（久远腹地（上）· 昆扬之口）
// 遭遇组：pillars_of_judgment
// 卡面：猎物 - 距离昆扬之口最近的调查员。
// 卡面：猎手。
// 卡面：强制 - 在一个石柱标记被放置在昆扬之口上后：将一张蛇怪洗入遭遇牌库。(每轮最多一次。)
// 卡面：复仇2。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '04220', scope: 'enemy', enemyRule: {"vengeance":2, "prey":"nearestMouth"} }
