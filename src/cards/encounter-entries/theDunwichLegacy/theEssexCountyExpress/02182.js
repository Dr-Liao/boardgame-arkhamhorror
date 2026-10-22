// 02182 02182
// 归属：关卡专用 · theEssexCountyExpress（疯狂列车）
// 遭遇组：essex_county_express
// 卡面：猎手。
// 卡面：你与黏液恐魔交战时，你不能移动。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 02182：与它交战期间不能移动。

export default { code: '02182', name: '02182', scope: 'enemy', text: '与它交战期间不能移动。', enemyRule: { blocksMovementWhileEngaged: true } }
