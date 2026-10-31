// 06029 开启大门
// 卡面：多重。 快速。
//       只能在你回合期间打出。
//       附属到你所在地点。团队在场上仅限3张。
//       调查员可以在任意两个附属有开启大门的地点之间移动，如同两个地点互相连接。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06029 开启大门（显式简化）：
//   · 快速 + 只能在自己回合打出 → played 描述子 fast + playCondition ownTurn。
//   · 团队仅限 3 张 → playCondition 统计 state.playerLocationAttachments 里的同名附属
//     （引擎的 teamLimit 读点只数支援区，门是地点附属，故用 playCondition 这个真实读点表达）。
//   · 附属到你所在地点 → keepOnPlay + api.attachToLocation(scope:'player')（state.playerLocationAttachments）。
//   · 显式简化：「两个附属有开启大门的地点互相连接」没有读点——移动目的地只读 location.connections，
//     卡条目无法驱动动态连接图（见 primitive-requests/w-m2-1-06029-*）。

const GATE_CODE = '06029'
// 只能在自己回合打出（等价 matcher.ownTurn()；写成内联 predicate 让卡文件不依赖任何 import）。
const ownTurn = () => ({ state, inv }) => state.phase === 'investigation' && state.currentSeat === inv.seat

export default {
  code: '06029',
  fast: true,
  keepOnPlay: true,
  simplified: true,
  note: '未实现：两个附属有「开启大门」的地点互相连接（移动图只读 location.connections，无卡条目可驱动的动态连接读点）；'
    + '已实现快速（played 描述子 fast + 条目 fast 数据）/只能自己回合/附属到所在地点/团队上限 3（playCondition 读 playerLocationAttachments）。'
    + '注：引擎的快速事件候选需要固定触发时机，本卡没有「任意玩家窗口」原语，实际按自己回合的普通事件打出。',
  playCondition: [
    ownTurn(),
    {
      when: ({ state }) => (state.playerLocationAttachments || []).filter(item => item.code === GATE_CODE).length < 3,
      message: '团队中已有 3 张「开启大门」在场',
    },
  ],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '附属到你所在地点',
      resolve: ({ inv, api }) => {
        const attached = api.attachToLocation(inv.location, { code: GATE_CODE, ownerSeat: inv.seat })
        if (!attached) {
          api.info('「开启大门」找不到可附属的地点。')
          return
        }
        api.info(`「开启大门」附属到「${api.locationName(inv.location)}」。`)
      },
    },
  ],
  modifiers: [],
}
