// 10583b 鳖类混种[night]（Limulus Hybrid · In the Dark）· 双面敌人（黑夜面）
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：猎手。庞大。反击。鳖类混种得到 +3[per_investigator] 生命值。
//       强制 - 你成功用[[近战]]卡牌攻击鳖类混种后：受到 1 点伤害。
//
// 一张卡一个文件：翻面判定在 behavior.syncHybridAt（黑暗地点 → night 面）；攻击后的自伤是本面
// 的强制效果，读点见 flags.forcedOnMeleeAttackTaken（P8 接 enemyAttackedSuccessfully）。
export default {
  code: '10583b',
  scope: 'enemy',
  implemented: true,
  flags: {
    limulusHybrid: true,
    hybridSide: 'night',
    partnerCode: '10583a',
    healthPerInvestigatorBonus: 3,
    forcedOnMeleeAttackTaken: { damage: 1, to: 'attacker' },
    keywords: ['hunter', 'massive', 'retaliate'],
    victory: 2,
    elite: true,
    abomination: true,
    setAside: true,
  },
  note: '近似：「近战攻击成功后的自伤」窗口不在本章 behavior 读点里，本批只落旗标（P8 接 skillTestResult）。',
}
