// 10086 深渊腐烂：所附属的敌人不能攻击。离场时回到绑定区。
export default {
  code: '10086',
  playRestriction: 'attachmentOnly',
  zoneReplacement: { discard: 'bonded' },
  assetRule: { sharedEnemyAttachment: true, enemyAttachmentRule: { cannotAttack: true, bondedReturn: true } },
}
