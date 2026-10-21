// 04018 冒险家
// 卡面：使用(3补给)。
// 卡面：[free]花费1补给并横置冒险家：在你所在地点一位调查员控制的一个支援上放置1补给或子弹。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// ---- 失落的时代：支援 ----
// 04018 冒险家：横置并花 1 补给，为同地点一个支援补 1 补给/子弹。

export default {
  code: '04018',
  uses: 3,
  usesType: 'supplies',
  abilities: [
    {
      kind: 'free', label: '放置 1 补给或子弹', cost: { action: false, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => {
        const targets = api.investigatorsAt(inv.location).flatMap(owner => owner.assets)
          .filter(asset => ['supplies', 'ammo'].includes(String(asset.usesType || '')))
        if (!targets.length) return api.info('这里没有可以补充补给或子弹的支援。')
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04018', seat: inv.seat, prompt: '选择要补充补给/子弹的支援。',
            options: targets.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })) })
        const asset = targets.find(item => item.id === chosen) || targets[0]
        api.addUses(asset, 1)
        api.info(`「${api.cardName(asset.code)}」获得 1 点${asset.usesType === 'ammo' ? '子弹' : '补给'}。`)
      },
    },
  ],
  modifiers: [

  ],
}
