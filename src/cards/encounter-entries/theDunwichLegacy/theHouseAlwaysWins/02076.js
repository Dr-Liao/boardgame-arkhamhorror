// 02076 VIP区
// 归属：关卡专用 · theHouseAlwaysWins（敦威治遗产 · 百赌百胜）
// 遭遇组：the_house_always_wins
// 卡面：你在VIP区时，你在补给阶段期间不能抽取卡牌或获得资源。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// VIP 区（02076）：在此时补给阶段不能抽取卡牌或获得资源。

export default { code: '02076', scope: 'location', locationRule: { skipsUpkeepIncome: true } }
