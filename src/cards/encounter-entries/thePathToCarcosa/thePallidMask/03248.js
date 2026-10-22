// 03248 石铺拱道
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：忽略与石铺拱道相邻的未揭示地点上的文字。
// 卡面：强制 - 在石铺拱道揭示时：将地下墓穴牌库顶的1张地下墓穴放置入场，放在石铺拱道的右方。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 石铺拱道（03248）：从这里进入相邻的未揭示地点时不必共同支付线索。

export default { code: '03248', scope: 'location', locationRule: { waivesEnterClueCost: true } }
