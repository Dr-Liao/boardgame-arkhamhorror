// 10580 地下水池（Underground Pools）· 岩穴地点
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：[action] 在地下水池的调查员共同花费 2[per_investigator] 个线索：记住调查员「发现了一串足迹」。
//       强制 - 在你调查地下水池时，技能检定失败后：受到 1 点恐惧。
//
// 一张卡一个文件：团队付款与 Remembered 写入在 behavior.actions/performAction
// （lostSisterRemember:foundASetOfFootprints）。
export default {
  code: '10580',
  scope: 'location',
  implemented: true,
  abilities: [],
  flags: {
    remember: 'foundASetOfFootprints',
    groupClueCost: { perInvestigator: 2 },
    forcedOnInvestigateFailure: { horror: 1 },
    cluesPerInvestigator: 1,
    shroud: 3,
    traits: ['Cave', 'Dark'],
  }
}
