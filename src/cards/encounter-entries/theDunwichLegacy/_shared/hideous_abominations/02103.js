// 02103 02103
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：hideous_abominations
// 卡面：猎物 - [willpower]最低。
// 卡面：猎手。
// 卡面：强制 - 你使用[[近战]]卡牌对“球之群”执行攻击后：弃掉该卡牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 02103：用近战武器攻击它时，武器被摧毁。

export default { code: '02103', name: '02103', scope: 'enemy', text: '用近战武器攻击它时，武器被摧毁。', enemyRule: { destroysMeleeWeapon: true , prey: 'lowestWillpower'} }
