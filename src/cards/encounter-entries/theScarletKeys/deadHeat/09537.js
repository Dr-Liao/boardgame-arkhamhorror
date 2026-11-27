// 09537 苋（腐败潜伏）
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：猎手。强制 - 苋的攻击造成的伤害或恐惧分配给支援时：击败该支援，苋变换其每把附属密钥。
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
  abilities: [{
    kind: 'forced', trigger: 'assetHarmPlaced',
    label: '攻击的伤害或恐惧分配给支援后：击败该支援，变换苋附属的密钥',
    criteria: ({ source, context }) => context.attack?.enemyId === source.id && Boolean(context.assetId)
      && (context.damage > 0 || context.horror > 0),
    resolve: ({ source, context, api }) => {
      api.defeatAsset(context.seat, context.assetId)
      const keys = api.tsk.keys.heldBy({ type: 'enemy', enemyId: source.id })
      for (const id of keys) api.tsk.keys.shift(id, { force: true, by: 'enemy' })
    },
  }],
}
