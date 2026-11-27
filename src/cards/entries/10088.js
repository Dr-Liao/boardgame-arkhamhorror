// 10088 流脓腐烂：附属期间，敌人的战斗值和躲避值各降低一点。
export default {
  code: '10088',
  playRestriction: 'attachmentOnly',
  zoneReplacement: { discard: 'bonded' },
  assetRule: { sharedEnemyAttachment: true, enemyAttachmentRule: { fight: -1, evade: -1, bondedReturn: true } },
}
