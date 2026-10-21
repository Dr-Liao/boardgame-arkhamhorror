// 04152 去伪存真
// 卡面：你所在地点有线索才能打出。
// 卡面：在你控制的一张支援卡牌上放置2秘密。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04152 洞悉真相：在控制的一个充能/秘密支援上放 2 个秘密。

import { investigatorClues } from '../../engine/matcher.js'

export default {
  code: '04152',
  playCondition: [{ when: investigatorClues(1), message: '需要至少 1 个线索才能打出' }],
  abilities: [
    {
      kind: 'played', label: '放置 2 个秘密',
      resolve: ({ inv, api }) => {
        const candidates = inv.assets.filter(asset => ['secrets', 'charges'].includes(String(asset.usesType || '')))
        if (!candidates.length) return api.info('没有可放置秘密的支援。')
        const chosen = candidates.length === 1 ? candidates[0].id
          : api.choice({ kind: 'target', source: '04152', seat: inv.seat, prompt: '选择要放置 2 秘密的支援。',
            options: candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })) })
        const asset = candidates.find(item => item.id === chosen) || candidates[0]
        api.addUses(asset, 2)
        api.info(`「${api.cardName(asset.code)}」获得 2 点秘密。`)
      },
    },
  ],
  modifiers: [

  ],
}
