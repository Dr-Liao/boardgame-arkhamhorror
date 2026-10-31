// 06324 阿比盖尔·福尔曼
// 卡面：[free]：附属你游戏区域的一张[[书籍]]支援到阿比盖尔·福尔曼，或将你游戏区域的一张[[书籍]]支援
//       与附属到阿比盖尔·福尔曼的支援互换。附属到阿比盖尔·福尔曼的支援不占手部槽位(附属的支援仅限1张)。
//       [reaction]你结算附属的[[书籍]]支援的[action]能力后，横置阿比盖尔·福尔曼：再次结算其效果。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06324 阿比盖尔·福尔曼（[[盟友]]）：
//   · [free] 附属一张[[书籍]]支援：api.moveCard({ id/code, from:'play', to:'attached', attachTo:source.id })
//     把该书籍从支援区移到她的 attachments——它因此不再占用（手部）槽位（槽位读点只看 inv.assets）；
//   · 「互换」：引擎没有把附属卡移回支援区的通用 API（findZoneCard 不扫描 attachments），
//     因此仅支持「尚未附属时附属一张；已附属时提示先用别的方式取回」——显式简化；
//   · 再结算附属书籍的 [action] 能力：引擎不枚举附属卡的 [action] 能力（能力源只看 inv.assets），
//     该 reaction 无法挂载——显式简化。
// 显式简化：书籍「互换」与「附属书籍的 [action] 能力再结算一次」未实现；附属本身与不占槽位已实现。

import { ALL_CARDS } from '../../cards/cards-data.js'

function isTomeAsset(code) {
  const def = code ? ALL_CARDS[code] : null
  return Boolean(def) && def.type === 'asset'
    && (def.traits || []).some(trait => String(trait).toLowerCase() === 'tome')
}

export default {
  code: '06324',
  simplified: true,
  note: '未实现：①「与你游戏区域的书籍支援互换」（引擎没有把附属卡移回支援区的通用 API，'
    + '现只支持从支援区附属一张书籍）；②「结算附属书籍的 [action] 能力后横置她再结算一次」'
    + '（引擎不把附属卡的 [action] 能力列入能力源，无法挂 reaction）。'
    + '已实现：附属一张[[书籍]]支援到阿比盖尔（仅限 1 张），且附属后不再占用槽位。',
  abilities: [
    {
      kind: 'action',
      label: '[free] 附属一张你游戏区域的[[书籍]]支援（附属后不占槽位，仅限 1 张）',
      cost: { action: false },
      target: {
        kind: 'asset',
        label: '你游戏区域的[[书籍]]支援',
        query: ({ candidate }) => isTomeAsset(candidate?.entity?.code ?? candidate?.id),
      },
      criteria: [({ source }) => (source?.attachments || []).length < 1],
      resolve: ({ inv, api, source, target }) => {
        const tome = target?.entity
        if (!source || !tome) return
        if ((source.attachments || []).length >= 1) {
          api.info('阿比盖尔·福尔曼上已经附属了一张支援（仅限 1 张）。')
          return
        }
        api.moveCard({ id: tome.id, code: tome.code, from: 'play', to: 'attached', attachTo: source.id })
        api.info(`📚 ${inv.name} 把「${api.cardName(tome.code)}」附属到阿比盖尔·福尔曼（不占手部槽位）。`)
      },
    },
  ],
  modifiers: [],
}
