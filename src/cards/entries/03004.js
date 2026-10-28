// 03004 阿喀琦·奥耶莉
// 卡面：你带有“使用(充能)”的支援入场时带有额外1点充能。
// 卡面：[elder_sign]效果：+1。你控制的一张带有“使用(充能)”的支援增加1点充能。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 阿卡奇·奥涅莱：旧印 +1；可以在一个充能支援上放置 1 充能。

import { investigatorSign } from './_shared.js'

const factory = () => {
    const es = investigatorSign('03004')
    return ({ inv, api }) => {
      const candidates = api.countControlled(inv.seat, { usesType: 'charge' })
      if (candidates.length) {
        const answer = api.choice({ kind: 'elderSign', source: 'akachiElderSign', seat: inv.seat,
          prompt: '旧印：是否在一个由你控制的充能支援上放置1个充能？', canSkip: true,
          options: [{ id: 'skip', label: '不放置充能' },
            ...candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) }))] })
        const asset = candidates.find(item => item.id === answer)
        if (asset) api.addUses(asset, 1)
      }
      return { delta: es.bonus || 1 }
    }
  }

export default {
  code: '03004',
  investigator:   {
    "elderSign": {
      "kind": "akachi",
      "bonus": 1
    },
    "additionalChargeOnEnter": 1
  },
  kind: 'investigator',
  elderSign: { id: '03004-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
