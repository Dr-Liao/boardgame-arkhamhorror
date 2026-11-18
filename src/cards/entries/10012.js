// 10012 鸣神琥珀（Kōhaku Narukami）· 潜修者 · 学者/祝福/诅咒萦绕
// 卡面：
//   [reaction] 当你回合开始时：在混乱袋中加入 1 个 [bless] 标记或 1 个 [curse] 标记
//     （取混乱袋中数量较少者；若数量相等则由你选择）；或者从混乱袋中移除 2 个 [bless] 标记和
//     2 个 [curse] 标记，以在本回合中进行一个额外行动。
//   [elder_sign] 效果：+2。在混乱袋中加入 1 个 [bless] 和 1 个 [curse] 标记。
//   卡背：30 张；[[祝福]]/[[诅咒萦绕]] 0–5、[[密教]] 0、潜修者 0–3、中立 0–5；
//   专属依赖 10013 / 10014（构筑数据在 cards-data，availability 由主进程接线）。
//
// 读点：
//   · 回合开始：`turnBegins` 窗口（turn.js#turnBeginningWindow，context.seat/location）+
//     `limit: perWindow`。引擎对同一个 turnBegins 会先后走 triggerReaction 与 reactionWindow
//     两条派发路径，perWindow 把同一窗口实例的第二次询问去重，避免同一回合开始结算两次。
//   · 标记增减：`api.chaosTokens`（chaos-token-pool 的 count/add/payMixed）；
//     组合费用「2 祝福 + 2 诅咒」必须整体支付，用 payMixed（P2 原语，不可部分支付）。
//   · 旧印：`elderSign` 描述子；`investigator.elderSign.bonus` 供 AI/预估读点。

import { poolTokenRoom } from '../../engine/chaos-token-pool.js'

const BLESS = 'bless'
const CURSE = 'curse'

function bagCount(state, token) {
  return (state.chaosBag || []).filter(face => face === token).length
}

// 可选的「加 1 个较少者」结果：较少的一方；并列时取仍可加入的两方（真正的选择在 resolve 里询问）。
function fewerFaces(state) {
  const bless = bagCount(state, BLESS)
  const curse = bagCount(state, CURSE)
  const faces = bless < curse ? [BLESS] : curse < bless ? [CURSE] : [BLESS, CURSE]
  return faces.filter(face => poolTokenRoom(state, face) > 0)
}

export default {
  code: '10012',
  kind: 'investigator',
  // 缺少的原语：运行期加入的祝福/诅咒只进当前混乱袋（chaosTokens.add），没有同时写
  // state.campaign.chaosBag 的能力面入口；现有 07x 祝福/诅咒卡同口径（按规则关卡结束回供应堆）。
  note: '祝福/诅咒加入当前混乱袋，不写战役袋；消耗时由 endChaosTest 同步战役袋。',
  investigator: { elderSign: { bonus: 2 } },
  elderSign: {
    id: '10012-eldersign',
    label: '鸣神琥珀旧印：+2；在混乱袋中加入 1 个祝福和 1 个诅咒',
    resolve: ({ api }) => {
      api.chaosTokens.add(BLESS, 1)
      api.chaosTokens.add(CURSE, 1)
      return { delta: 2 }
    },
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'turnBegins',
      id: 'kohakuTurnBegins',
      limit: { scope: 'perWindow', owner: 'instance' },
      label: '回合开始：加入 1 个较少者，或移除 2 祝福与 2 诅咒获得 1 个额外行动',
      criteria: [({ state, inv, context }) => context?.seat === inv.seat
        && (fewerFaces(state).length > 0 || (bagCount(state, BLESS) >= 2 && bagCount(state, CURSE) >= 2))],
      resolve: ({ state, inv, api }) => {
        const addable = fewerFaces(state)
        const canGainAction = bagCount(state, BLESS) >= 2 && bagCount(state, CURSE) >= 2
        const modes = [
          ...(addable.length ? [{ id: 'add', label: '加入 1 个较少者' }] : []),
          ...(canGainAction ? [{ id: 'action', label: '移除 2 个祝福与 2 个诅咒，获得 1 个额外行动' }] : []),
        ]
        if (!modes.length) return
        const mode = modes.length === 1 ? modes[0].id : api.choice({
          kind: 'effect', source: '10012', seat: inv.seat,
          prompt: '选择鸣神琥珀的回合开始效果。', options: modes,
        })
        if (mode === 'action') {
          // 组合费用不可部分支付：任一方不足 2 个时 payMixed 返回 false，不会扣掉单边标记。
          if (!api.chaosTokens.payMixed({ [BLESS]: 2, [CURSE]: 2 })) return
          api.gainAction(inv.seat, 1)
          api.info(`🎲 鸣神琥珀移除 2 个祝福与 2 个诅咒，本回合获得 1 个额外行动。`)
          return
        }
        const face = addable.length === 1 ? addable[0] : api.choice({
          kind: 'chaosToken', source: '10012', seat: inv.seat,
          prompt: '混乱袋中祝福与诅咒数量相等：选择要加入的标记。',
          options: addable.map(id => ({ id, label: id === BLESS ? '祝福' : '诅咒' })),
        })
        if (face !== BLESS && face !== CURSE) return
        if (api.chaosTokens.add(face, 1) === 1) {
          api.info(`🎲 鸣神琥珀在混乱袋中加入 1 个${face === BLESS ? '祝福' : '诅咒'}标记。`)
        }
      },
    },
  ],
  modifiers: [],
}
