// 10585 岩穴青苔（Cavern Moss）· 敌人（印刷 3 张，遭遇牌库）
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：冷漠。猎手。岩穴青苔附属到支援时，它可以被攻击，如同是与你交战的敌人。
//       强制 - 你在岩穴青苔的地点攻击或调查时，技能检定成功后，如果它为重整状态：
//       把岩穴青苔附属到一个你控制的[[道具]]支援。被附属支援的印刷文本框视为空白（除[[特性]]外）。
//
// behavior.afterTest 处理成功检定后的强制选择。引擎的敌人附属规则负责宿主随动、文本空白和攻击。
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
}
