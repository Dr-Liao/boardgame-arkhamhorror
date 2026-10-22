// 02094 02094
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：beast_thralls
// 卡面：猎物 - [intellect]最低。
// 卡面：猎手。
// 卡面：用[[远程]]、[[枪械]]或[[法术]]支援攻击鸟之奴仆时，其得到-3攻击值。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 02094：用远程/枪械/法术武器攻击它时难度 -3。

export default { code: '02094', name: '02094', scope: 'enemy', text: '用远程、枪械或法术武器攻击它时难度 -3。', enemyRule: { rangedAttackDifficultyReduction: 3 , prey: 'lowestIntellect'} }
