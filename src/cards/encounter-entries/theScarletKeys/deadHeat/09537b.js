// 09537b 苋（腐败显露）
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：猎手。反击。强制 - 苋攻击时：她变换其每把附属密钥。若本次攻击的伤害和/或恐惧分配给支援，击败该支援。
//
// 一张卡一个文件：回合/攻击钩子与正面共用 behavior.enemyAttackStarted / enemyAttackResolved；
// 幕 2 背面的翻面（保留全部标记）由 behavior.flipAmaranth 完成。
export default {
  code: '09537b',
  scope: 'enemy',
  implemented: true,
  flags: {
    amaranth: true,
    amaranthFace: 'corruptionRevealed',
    backFace: true,
    frontFaceCode: '09537',
    keyBearer: true,
    attackShiftsKeys: true,
    attackShiftsKeysOnAssetDamage: true,
  },
  note: '近似：每次攻击都结算一次 Shift（参考实现的动荡面「调查员变换才翻回稳定面」按密钥原语统一翻面，见 primitive-requests/09544a.json）。',
}
