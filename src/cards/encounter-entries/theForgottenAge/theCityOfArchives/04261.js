// 04261 残酷拷问
// 归属：关卡专用 · theCityOfArchives（失落的时代 · 天机之城）
// 遭遇组：the_city_of_archives
// 卡面：显现 - 将残酷拷问放置入场，放到你的威胁区域。如果有调查员“进行了一次会谈”，受到1点恐惧，并且残酷拷问获得涌动。
// 卡面：你不能进行抽取行动。
// 卡面：[action]：检定[willpower](2)。如果你检定成功，弃掉残酷拷问。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '04261', scope: 'treachery', treacheryRule: {"threatArea":true,"threat":{"noDrawAction":true},"surge":false} }
