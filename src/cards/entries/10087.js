// 10087 琥珀腐烂：敌人被击败时，控制者按该敌人的生命值获得最多五点资源。
export default {
  code: '10087',
  playRestriction: 'attachmentOnly',
  zoneReplacement: { discard: 'bonded' },
  assetRule: { sharedEnemyAttachment: true, enemyAttachmentRule: { bondedReturn: true } },
  abilities: [{
    kind: 'forced',
    trigger: 'attachedEnemyDefeated',
    label: '所附属敌人被击败时，获得等同其生命值的资源，最多五点',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: [({ inv, source, context }) => source?.ownerSeat === inv.seat
      && context?.enemy?.attachments?.includes(source) && Number(context.enemy.health) > 0],
    resolve: ({ inv, context, api }) => api.gainResources(inv.seat, Math.min(5, Number(context.enemy.health))),
  }],
}
