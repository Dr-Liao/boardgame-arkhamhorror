// 03250 埋骨洞窟
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：你调查埋骨洞窟时，你少1个手部槽位。
// 卡面：强制 - 在埋骨洞窟揭示时：将地下墓穴牌库顶的2张地下墓穴放置入场，分别放在埋骨洞窟的下方和右方。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '03250', scope: 'location', handSlotsPenaltyWhileInvestigating: true, locationRule: { handSlotsPenalty: 1 } }
