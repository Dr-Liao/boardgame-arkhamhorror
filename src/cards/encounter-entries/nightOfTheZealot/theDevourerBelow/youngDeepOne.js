// youngDeepOne 年幼的深潜者
// 归属：关卡专用 · theDevourerBelow（夜之狂热 · 第三幕：地底噬魔）
// 遭遇组：无（story）
// 卡面：强制 - 与它交战时：受到 1 点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 年幼的深潜者（01181）：与它交战时受到 1 点恐惧。
// 迁移自 enemies.js 的 `enemy.code === 'youngDeepOne'` 分支。

export default {
  code: 'youngDeepOne',
  name: '年幼的深潜者',
  scope: 'enemy',
  text: '强制 - 与它交战时：受到 1 点恐惧。',
  abilities: [{
    kind: 'forced', trigger: 'enemyEngaged', silent: true,
    criteria: { when: ({ source, context, inv }) => source?.id === context?.enemy?.id && inv?.seat === context?.seat },
    resolve: ({ api, inv, source }) => {
      api.info(`😱 「${source.name}」交战强制：${inv.name} 受到 1 点恐惧。`)
      api.horror(inv.seat, 1)
    },
  }],
}
