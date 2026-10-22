// 04066 地下遗迹
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：eztli
// 卡面：有敌人在地下遗迹中时，将地下遗迹视为在胜利区中(以计入复仇点数)。
// 卡面：强制 - 在地下遗迹中的敌人离场后：在地下遗迹上放置1个毁灭标记。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：失落时代地点的复仇点「视同胜利区」条件。

export default { code: '04066', scope: 'location', vengeanceWhile: 'enemyHere' }
