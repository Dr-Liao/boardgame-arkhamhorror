// 09537b 苋（腐败显露）
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：猎手。反击。强制 - 苋攻击时：她变换其每把附属密钥。若本次攻击的伤害和/或恐惧分配给支援，击败该支援。
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
  abilities: [{
    kind: 'forced', trigger: 'enemyAttack',
    label: '攻击时：变换苋附属的每个密钥',
    criteria: ({ source, context }) => context.enemy?.id === source.id,
    resolve: ({ source, api }) => {
      const keys = api.tsk.keys.heldBy({ type: 'enemy', enemyId: source.id })
      for (const id of keys) api.tsk.keys.shift(id, { force: true, by: 'enemy' })
    },
  }, {
    kind: 'forced', trigger: 'assetHarmPlaced',
    label: '攻击的伤害或恐惧分配给支援后：击败该支援',
    criteria: ({ source, context }) => context.attack?.enemyId === source.id && Boolean(context.assetId)
      && (context.damage > 0 || context.horror > 0),
    resolve: ({ context, api }) => api.defeatAsset(context.seat, context.assetId),
  }],
}
