// 10584b 虾类混种[night]（Crustacean Hybrid · In the Dark）· 双面敌人（黑夜面，印刷 2 张）
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：猎手。虾类混种得到 +X 生命值，X 为当前天数。
//       强制 - 虾类混种翻至此面后：虾类混种对其所在地点的每位调查员造成 1 点伤害。
//
// 一张卡一个文件：翻面后的群体伤害在 behavior.flipHybrid（读 forcedOnFlipToEachInvestigator）。
export default {
  code: '10584b',
  scope: 'enemy',
  implemented: true,
  flags: {
    crustaceanHybrid: true,
    hybridSide: 'night',
    partnerCode: '10584a',
    healthByDay: true,
    forcedOnFlipToEachInvestigator: { damage: 1 },
    keywords: ['hunter'],
    victory: 0,
    elite: true,
    abomination: true,
    setAside: true,
  },
  note: '数据型条目：伤害在 flipHybrid 的强制段结算（api.damage / 无引擎时直写 inv.damage）。',
}
