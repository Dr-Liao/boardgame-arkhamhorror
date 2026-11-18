// 10585 岩穴青苔（Cavern Moss）· 敌人（印刷 3 张，遭遇牌库）
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：冷漠。猎手。岩穴青苔附属到支援时，它可以被攻击，如同是与你交战的敌人。
//       强制 - 你在岩穴青苔的地点攻击或调查时，技能检定成功后，如果它为重整状态：
//       把岩穴青苔附属到一个你控制的[[道具]]支援。被附属支援的印刷文本框视为空白（除[[特性]]外）。
//
// 一张卡一个文件：附属与文本空白需要引擎的「敌人附属到支援」通道（enemyRule），
// 本批只落旗标（P8 接 enemyRule.attachToItemOnSuccess），章节 behavior 不重复实现。
export default {
  code: '10585',
  scope: 'enemy',
  implemented: true,
  flags: {
    attachToItemOnSuccess: true,
    attachedAssetBlankedExceptTraits: true,
    attackableWhileAttached: true,
    aloof: true,
    hunter: true,
    traits: ['Flora', 'Mutated'],
    fight: 2,
    evade: 1,
    health: 3,
  },
  note: '近似：附属到[[道具]]支援与「文本框空白」是引擎-level 敌人附属规则，本章只声明旗标，未在 behavior 复写。',
}
