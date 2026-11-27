// 10577 隐蔽海湾（Hidden Cove）· 岩穴地点
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：[action] 在隐蔽海湾的调查员共同花费 2[per_investigator] 个线索：记住调查员「找到了磨损的狗链」。
//       强制 - 在你于隐蔽海湾攻击时，技能检定失败后：受到 1 点伤害。
//
// 一张卡一个文件：团队付款与 Remembered 写入在 behavior.actions/performAction
// （lostSisterRemember:foundATornDogLeash，读 REMEMBERED）；攻击失败伤害留给引擎的
// skillTestResult 地点条目通道（本批不建地点 skillTestResult 条目，见 note）。
export default {
  code: '10577',
  scope: 'location',
  implemented: true,
  abilities: [],
  flags: {
    remember: 'foundATornDogLeash',
    groupClueCost: { perInvestigator: 2 },
    forcedOnFightFailure: { damage: 1 },
    cluesPerInvestigator: 1,
    shroud: 3,
    traits: ['Coastal'],
  }
}
