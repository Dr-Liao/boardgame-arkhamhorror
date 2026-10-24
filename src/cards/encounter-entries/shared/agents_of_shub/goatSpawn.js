// goatSpawn 黑山羊眷族
// 归属：关卡专用 · theDevourerBelow（夜之狂热 · 第三幕：地底噬魔）
// 遭遇组：无（story）
// 卡面：强制 - 被击败时：它所在地点的每位调查员受到 1 点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 黑山羊眷族（01180）：被击败时，它所在地点的每位调查员受到 1 点恐惧。
// 迁移自 enemies.js 的 `enemy.code === 'goatSpawn'` 分支；窗口在胜利区结算之前。

export default {
  code: 'goatSpawn',
  name: '黑山羊眷族',
  scope: 'enemy',
  text: '强制 - 被击败时：它所在地点的每位调查员受到 1 点恐惧。',
  abilities: [{
    kind: 'forced', trigger: 'enemyDefeated', silent: true,
    criteria: { when: ({ source, context }) => source?.id === context?.enemy?.id },
    resolve: ({ api, source }) => {
      for (const inv of api.investigatorsAt(source.location)) {
        api.info(`😱 「${source.name}」的临死反噬：${inv.name} 受到 1 点恐惧。`)
        api.horror(inv.seat, 1)
      }
    },
  }],
}
