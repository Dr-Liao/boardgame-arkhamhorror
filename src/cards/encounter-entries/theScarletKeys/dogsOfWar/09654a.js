// 09654a 暗红骑士（The Claret Knight · Coterie Kingpin / 结社头目）· 敌人 · dogs_of_war
//
// 归属：关卡专用 · theScarletKeys/dogsOfWar（P7）。同一张物理卡的另一面是 09654b（剧情支援「她的誓约勇士」）。
// 卡面（中）：强制 - 你在暗红骑士所在地点时，技能检定失败后，如果他处于重整状态：他变换身上附属的每个钥匙。
//
// 读点（全部在章节 behavior，条目只声明数据）：
//   · 战斗值/躲避/生命/伤害恐惧由 definition 的 `enemies` 表（印刷值 + 4×人数生命）；
//   · 「检定失败后变换身上附属的每个钥匙」→ behavior.afterTest 读 `enemyRule.shiftsKeysOnFailedTestAtLocation`，
//     再调 behavior.resolveKeyShift（内容层唯一 Shift 执行点，`by: 'enemy'` 不翻回稳定面）；
//   · 「被击败」→ behavior.enemyDefeated 记 `claretKnightDefeated`，版本二的幕目标据此推进。
export default {
  code: '09654a',
  name: '暗红骑士',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    shiftsKeysOnFailedTestAtLocation: true,
    handsKeyToInvestigatorsOnDefeat: false,
  },
  note: 'approximation: 「变换身上附属的每个钥匙」在本章只有法罗斯之光一把；敌人持钥不翻回稳定面'
    + '（见 behavior.resolveKeyShift 的 by="enemy"）。被击败后钥匙回到未持有（记录里仍记「骑士持有」），'
    + '因为引擎的密钥持有者不能指向已离场敌人（primitive-requests/09654a.json）。',
}
