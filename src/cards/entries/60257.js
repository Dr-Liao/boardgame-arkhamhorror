// 60257 私家营业（Private Practice）
// 卡面：每位调查员仅限 1 张。[reaction] 你治愈恐惧后，横置：获得 1 资源。
// 读点：reaction trigger horrorHealed（context.cardSeat=治疗方）+ cost.exhaust + api.gainResources。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60257',
  abilities: [{
    kind: 'reaction',
    trigger: 'horrorHealed',
    label: '你治愈恐惧后横置：获得 1 资源',
    cost: { exhaust: true },
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: [({ inv, context }) => context?.cardSeat === inv.seat && Number(context?.amount) > 0],
    resolve: ({ inv, api }) => api.gainResources(inv.seat, 1),
  }],
  modifiers: [],
}
