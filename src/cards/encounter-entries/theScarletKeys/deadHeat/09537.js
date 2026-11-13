// 09537 苋（腐败潜伏）
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：猎手。强制 - 苋的攻击造成的伤害或恐惧分配给支援时：击败该支援，苋变换其每把附属密钥。
//
// 一张卡一个文件：本条目只声明卡面身份与规则数据（flags），行为接线在章节 behavior：
//   · enemyAttackStarted / enemyAttackResolved 读取 amaranth / amaranthFace / keyBearer /
//     attackShiftsKeysOnAssetDamage，按攻击前后支援伤害快照判定「分配给支援」；
//   · 幕 2 的「将击败时改为推进」由 behavior.enemyDefeated 读取 amaranth 标记。
export default {
  code: '09537',
  scope: 'enemy',
  implemented: true,
  flags: {
    amaranth: true,
    amaranthFace: 'lurkingCorruption',
    frontFace: true,
    backFaceCode: '09537b',
    keyBearer: true,
    attackShiftsKeysOnAssetDamage: true,
  },
  note: '近似：支援伤害归属按攻击前后支援 damage/horror 快照判定；被击败的支援走 discardAsset（引擎没有独立的「击败支援」入口）。',
}
