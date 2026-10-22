// 04052 伊塔卡
// 归属：关卡专用 · theUntamedWilds（失落的时代 · 荒莽密林）
// 遭遇组：wilds
// 卡面：警戒。反击。
// 卡面：[action]：谈判。检定[intellect](4)来说服伊塔卡，你不是她的敌人。如果你检定成功，在伊塔卡上放置1个线索(从供应堆拿取)。如果你检定失败，且伊塔卡处于重整状态，她攻击你。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：从 content/campaigns/theForgottenAge/card-data.js 的两张表搬来的卡面规则。

export default { code: '04052', scope: 'enemy', enemyRule: {"parley":{"skill":"intellect","difficulty":4}} }
