// 02075 画廊
// 归属：关卡专用 · theHouseAlwaysWins（敦威治遗产 · 百赌百胜）
// 遭遇组：the_house_always_wins
// 卡面：强制 - 在你调查画廊时技能检定失败后：失去2资源。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 115 轮：百赌百胜的地点/敌人/剧情资产规则（读者在 theHouseAlwaysWins 的 behavior）。
// 画廊（02075）：在此调查失败后失去 2 资源。

export default { code: '02075', scope: 'location', locationRule: { investigateFailLosesResources: 2 } }
