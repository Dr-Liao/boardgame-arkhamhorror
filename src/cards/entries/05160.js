// 05160 勇闯虎穴
// 卡面：快速。在你成功躲避一个敌人且超过难度至少2点后打出。
// 卡面：发现该敌人所在地点的1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：快速事件挂在 evadeSuccess 窗口上（played + fast + trigger），
// 「成功且超过难度至少 2 点」由窗口候选条件 successByAtLeast:2 过滤（reactionWindow 的同一判定），
// 发现线索用 api.discoverAt 指定敌人所在地点（跨地点发现，与 05111 情报报告同一原语）。

export default {
  code: '05160',
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'evadeSuccess',
      criteria: { selfOnly: true, successByAtLeast: 2 },
      label: '勇闯虎穴：发现敌人所在地点的 1 个线索',
      resolve: ({ state, inv, context, api }) => {
        const enemy = context?.enemy
        const locationId = enemy?.location ?? state.locations.find(location => location.id === inv.location)?.id
        if (!locationId) return
        const gained = api.discoverAt(inv.seat, locationId, 1)
        if (gained) api.info(`勇闯虎穴：在「${api.locName(locationId)}」发现 1 个线索。`)
        else api.info(`勇闯虎穴：「${api.locName(locationId)}」没有可发现的线索。`)
      },
    },
  ],
  modifiers: [],
}
