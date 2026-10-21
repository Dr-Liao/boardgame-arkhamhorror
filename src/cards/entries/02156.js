// 02156 诱敌深入
// 卡面：附属到你所在地点。
// 卡面：敌军阶段期间，所有要移动的敌人不照常移动，而是改为沿着最短路径，朝附属地点移动。
// 卡面：强制 - 附属在地点时，当一轮结束时：弃掉诱敌深入。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02156',
  abilities: [
    // Phase 5（5a-14）：标记用的卡号随效果数据一起走；第 4 批改成条目 resolve。
    {
      kind: 'played', label: '诱敌深入',
      resolve: ({ inv, api, descriptor }) => api.setLocationLure(inv.location, inv.seat, descriptor.code),
    },
  ],
  modifiers: [

  ],
}
