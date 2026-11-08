// 08007 蒙特雷·杰克（Monterey Jack，地球边缘调查员）
//
// 卡面：
//   [reaction] 你的回合结束时，若本轮起始地点与当前地点的连接距离为 1：获得 1 资源或抽 1 张牌；
//              若距离至少为 2，改为两项都执行。
//   [elder_sign]：+1。若本轮起始地点与当前地点的连接距离至少为 1，获得 1 资源或抽 1 张牌。
//
// 读点：
//   · 本轮起始地点在轮初由 `roundStarts` 的强制能力记录（eote-round-distance.js，P2 原语）；
//     距离由地图连接现算（不存派生值），未记录/不连通时距离为 null，按 0 处理。
//   · 回合结束是「你自己的回合结束」：turnEnded 窗口，按 context.seat 只结算本人的反应。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
const rewardOnce = (inv, api) => {
  if (api.choice({ kind: 'effect', source: '08007', seat: inv.seat, prompt: '本轮移动过：获得 1 资源或抽 1 张牌。',
    options: [{ id: 'resource', label: '获得 1 资源' }, { id: 'draw', label: '抽 1 张牌' }] }) === 'draw') {
    api.drawCards(inv.seat, 1)
  } else {
    api.gainResources(inv.seat, 1)
  }
}

export default {
  code: '08007', kind: 'investigator',
  // 旧印静态 +1（AI/预览读点）；实际结算在下面的 elderSign 描述子里。
  investigator: { elderSign: { bonus: 1 } },
  elderSign: { label: '旧印：+1；本轮移动过则获得 1 资源或抽 1 张牌', resolve: ({ inv, api }) => {
    const distance = api.mechanics.roundDistance.distance(inv.seat)
    if (Number.isFinite(distance) && distance >= 1) rewardOnce(inv, api)
    return { delta: 1 }
  } },
  abilities: [
    // 轮初记录本轮起始地点（强制记录，无玩家可见提示）。
    { kind: 'forced', trigger: 'roundStarts', silent: true, label: '记录本轮起始地点',
      resolve: ({ inv, api }) => { api.mechanics.roundDistance.noteStartLocation(inv.seat, inv.location) } },
    // 回合结束反应：距离 1 二选一，距离 ≥2 两项都做；距离 0/null 不触发。
    { kind: 'reaction', trigger: 'turnEnded', label: '按本轮移动距离获得资源/抽牌', limit: 'oncePerTurn',
      criteria: ({ inv, context }) => context.seat === inv.seat,
      resolve: ({ inv, api }) => {
        const distance = api.mechanics.roundDistance.distance(inv.seat)
        if (!Number.isFinite(distance) || distance < 1) return
        if (distance >= 2) {
          api.gainResources(inv.seat, 1)
          api.drawCards(inv.seat, 1)
          return
        }
        rewardOnce(inv, api)
      } },
  ],
}
