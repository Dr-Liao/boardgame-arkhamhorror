// 04270 骷髅钥匙
// 卡面：卓越。快速。
// 卡面：[action]：如果骷钥匙在你的游戏区域，将其附属到你所在地点。如果骷钥匙已经附属到你所在地点，改为将其解除附属并放回你的游戏区域。
// 卡面：将所附属地点的隐藏值设为1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04270 骷髅钥匙：快速支援；动作把它附属到所在地点，该地点的帷幕视为 1。
// 原先「解除附属」那半段在引擎里**永远走不到**（能力长在支援身上，附属期间它不在 inv.assets 里），
// 所以这一批只迁附属那半段；解除需要「地点附属上的能力枚举」，属未做机制（记在 §6）。

export default {
  code: '04270',
  fast: true,
  detachAction: true,
  abilities: [
    {
      kind: 'action', label: '附属/解除到所在地点',
      cost: { action: true },
      resolve: ({ state, inv, source, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        if (!here || !source) return
        api.attachSelfToLocation(source, here.id, { shroudAsOne: true })
        api.info(`「${api.cardName('04270')}」附属到「${here.name}」，该地点隐藏值视为 1。`)
      },
    },
  ],
  modifiers: [

  ],
}
