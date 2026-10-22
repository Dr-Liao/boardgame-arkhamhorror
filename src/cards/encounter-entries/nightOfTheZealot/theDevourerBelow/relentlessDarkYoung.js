// relentlessDarkYoung 坚韧的黑山羊幼崽
// 归属：关卡专用 · theDevourerBelow（夜之狂热 · 第三幕：地底噬魔）
// 遭遇组：无（story）
// 卡面：强制 - 回合结束时：治愈它 2 点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 坚韧的黑山羊幼崽（01179）：回合结束时治愈它 2 点伤害。
// 迁移自 turn.js 的 `enemy.code === 'relentlessDarkYoung'` 分支。

export default {
  code: 'relentlessDarkYoung',
  name: '坚韧的黑山羊幼崽',
  scope: 'enemy',
  text: '强制 - 回合结束时：治愈它 2 点伤害。',
  abilities: [{
    kind: 'forced', trigger: 'enemyRoundEnd', silent: true,
    criteria: { when: ({ source, context }) => source?.id === context?.enemy?.id },
    resolve: ({ api, source }) => {
      api.healEnemy(source, 2)
      api.info(`💉 「${source.name}」治愈 2 点伤害。`)
    },
  }],
}
