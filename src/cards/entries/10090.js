// 10090 翠绿腐烂：所附属的敌人不能移动。离场时回到绑定区。
export default {
  code: '10090',
  playRestriction: 'attachmentOnly',
  zoneReplacement: { discard: 'bonded' },
  assetRule: { sharedEnemyAttachment: true, enemyAttachmentRule: { cannotMove: true, bondedReturn: true } },
}
