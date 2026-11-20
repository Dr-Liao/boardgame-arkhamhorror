// 11638 伊克雷希特碎片 · 剧情资产（异界残片）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 印刷行为：
//   · 每轮中，你可以忽略一名[[星之眷族]]或[[深潜者]]敌人对你进行的首次攻击。
//   · [reaction] 一名[[星之眷族]]或[[深潜者]]敌人进入你所在地点时，横置本卡牌：横置该敌人。
// 读点：
//   · 被动 = storyAssetRule.ignoreFirstAttack { traits }（引擎 story-asset-rules#ignoredEnemyAttackOffer，
//     enemies.js#enemyAttack 每轮首次询问玩家；选择写 asset.ignoredAttackRound，同轮不再询问）；
//   · 反应描述子（trigger:'enemySpawn'，cost.exhaust）——受控剧情资产实例在 inv.assets 时按玩家卡来源询问；
//     横置敌人走 api.exhaustEnemy。
export default {
  code: '11638',
  scope: 'storyAsset',
  implemented: true,
  storyAssetRule: { ignoreFirstAttack: { traits: ['Star Spawn', 'Deep One'] } },
  flags: { shardOfYchlecht: true },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'enemySpawn',
      label: '横置伊克雷希特碎片：横置进入你所在地点的[[星之眷族]]/[[深潜者]]敌人',
      cost: { exhaust: true },
      criteria: ({ inv, context }) => {
        const enemy = context?.enemy
        if (!enemy || !inv) return false
        if (enemy.location !== inv.location) return false
        return (enemy.traits || []).some(trait => {
          const name = String(trait).toLowerCase()
          return name === 'star spawn' || name === 'deep one'
        })
      },
      resolve: ({ inv, context, api }) => {
        const enemy = context?.enemy
        if (!enemy) return
        api.exhaustEnemy(enemy)
        api.info?.(`${inv.name} 横置伊克雷希特碎片：横置进入所在地点的「${enemy.name}」。`)
      },
    },
  ],
  note: '「每轮忽略首次[[星之眷族]]/[[深潜者]]攻击」= storyAssetRule.ignoreFirstAttack（enemyAttack 每轮询问，ignoredAttackRound 记账）；'
    + '[reaction]（敌人进入地点→横置该敌人）走 enemySpawn 反应窗口 + api.exhaustEnemy。',
}
