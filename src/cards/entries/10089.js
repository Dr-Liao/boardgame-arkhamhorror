// 10089 猩红腐烂：轮末对所附属的敌人造成一点伤害。
const CODE = '10089'
const host = (state, source) => state.enemies.find(enemy => enemy.attachments?.includes(source))

export default {
  code: CODE,
  playRestriction: 'attachmentOnly',
  zoneReplacement: { discard: 'bonded' },
  assetRule: { sharedEnemyAttachment: true, enemyAttachmentRule: { bondedReturn: true } },
  abilities: [{
    kind: 'forced',
    trigger: 'roundEnds',
    label: '轮末：对所附属敌人造成一点伤害',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: [({ state, inv, source, helpers }) =>
      source?.ownerSeat === inv.seat && helpers.canDamageEnemy(host(state, source), inv.seat, CODE)],
    resolve: ({ state, inv, source, api }) => api.damageEnemy(host(state, source), 1, inv.seat, CODE),
  }],
}
