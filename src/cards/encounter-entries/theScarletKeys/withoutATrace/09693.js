// 09693 艾里奇·佐尼·奥佩勒曲亚（Aliki Zoni Uperetria）／猩红腰带的少女 · storyAsset
//
// 归属：关卡专用 · theScarletKeys/withoutATrace（P7）。
// 卡面（中）：[reaction] 在隐匿迷你卡牌揭露后，横置艾里奇·佐尼·奥佩勒曲亚：
//   选择一个放在一边的空洞。其所有者将其抽取。
//
// 读点（本章 `behavior.js`）：
//   · assetRule.exposeRecallHollow → behavior.exposeMiniInShadows 末尾的 alikiReaction：
//     每张迷你卡揭露后，若她由某位调查员控制且未横置，则横置她并让一个空洞回到其所有者手中
//     （优先该控制者名下的空洞，否则全队空洞）；
//   · 她是否入场由序章的「吹响哨子 / 扔掉哨子」决定（behavior.preScenarioSetup / afterDeckSetup）。
export default {
  code: '09693',
  name: '艾里奇·佐尼·奥佩勒曲亚',
  scope: 'storyAsset',
  implemented: true,
  note: 'approximation: 卡面是可选 [reaction]，本章在揭露结算后自动使用并横置；'
    + '空洞归属优先取控制者名下的那一张（没有则取第一张全队空洞）。',
  assetRule: {
    exposeRecallHollow: true,
  },
}
