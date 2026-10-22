// 02216 塞拉斯·毕晓普
// 归属：关卡专用 · bloodOnTheAltar（血色祭坛）
// 遭遇组：blood_on_the_altar
// 卡面：庞大。
// 卡面：塞拉斯·毕晓普不能进行趁乱攻击。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02216', scope: 'enemy',
  enemyRule: { cannotOpportunityAttack: true },
}
