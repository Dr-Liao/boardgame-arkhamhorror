// 08125 危险处境（In the Thick of It）
// 卡面：永久。每套牌库仅限 1 张。当构建牌库时购买。
//        当你购买危险处境时，承受总共 2 点肉体和/或精神创伤。然后，取得 3 经验。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：永久卡在 setup.js 的开局循环里入场并执行 kind:'setup' 描述子；创伤走 api.addTrauma、
//       经验走 api.addScenarioXpBonus（结算到本场冒险）、一次性记录走 api.recordSets（战役记录集合）。
// approximation: 构筑/购买层（选卡时结算创伤与经验）留 P7；本条目在每场冒险 setup 时一次性结算：
//   承受 2 点创伤（可选分配）+ 3 点额外经验；用战役记录 inTheThickOfItPurchased 防跨场景重复。
const code = '08125'

export default {
  code,
  note: 'approximation: 购买层（构筑时选卡）留 P7；开局 setup 一次性结算 2 点创伤 + 3 点额外经验，并用战役记录防重复。',
  abilities: [
    {
      kind: 'setup',
      label: '购买时：承受 2 点创伤并取得 3 经验（一次性）',
      resolve: ({ inv, api }) => {
        const claimed = api.recordSets.values('inTheThickOfItPurchased')
        if (claimed.includes(inv.code)) return
        const split = api.choice({
          kind: 'effect', source: code, seat: inv.seat,
          prompt: '「危险处境」：购买时分配 2 点创伤。',
          options: [
            { id: 'physical', label: '2 点肉体创伤' },
            { id: 'mental', label: '2 点精神创伤' },
            { id: 'split', label: '1 点肉体创伤 + 1 点精神创伤' },
          ],
        })
        const physical = split === 'physical' ? 2 : split === 'split' ? 1 : 0
        const mental = split === 'mental' ? 2 : split === 'split' ? 1 : 0
        if (physical) api.addTrauma(inv.seat, 'physical', physical)
        if (mental) api.addTrauma(inv.seat, 'mental', mental)
        api.addScenarioXpBonus(inv.seat, 3)
        api.recordSets.add('inTheThickOfItPurchased', inv.code)
        api.info(`⚖️ 「危险处境」：${inv.name} 承受 ${physical} 点肉体创伤、${mental} 点精神创伤，并取得 3 经验。`)
      },
    },
  ],
  modifiers: [],
}
