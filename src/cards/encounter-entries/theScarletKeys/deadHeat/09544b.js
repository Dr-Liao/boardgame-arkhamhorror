// 09544b 末绽之花（动荡面）
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：变换 - 治愈场上每个敌人 1 点伤害。然后，若由调查员变换此密钥，将其翻到其[[稳定]]面。
export default {
  code: '09544b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    keyCard: true,
    keyId: '09544',
    face: 'unstable',
    stableFaceCode: '09544a',
    shiftEffect: 'healAllEnemies',
    shiftEffects: { healDamage: 1, scope: 'allEnemies', flipIfInvestigatorShifted: true },
  },
  assetRule: {
    shift({ state, api }) {
      for (const enemy of state.enemies) {
        if (!enemy.defeated && enemy.damageTaken > 0) api.healEnemy(enemy, 1)
      }
    },
  },
}
