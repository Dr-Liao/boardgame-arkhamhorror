// 04026 彩饰骷髅
// 卡面：使用(0充能)。
// 卡面：[reaction]在你所在地点有调查员、[[盟友]]支援或敌人被击败后：在彩饰骷髅上放置1资源(从供应堆拿取)，作为充能。
// 卡面：[action]花费1充能：抽取1张卡牌并获得1资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04026 彩饰骷髅：本地点每次有调查员/盟友/敌人被击败各放 1 充能（卡面无上限）；花 1 充能抽 1 并获得 1 资源。
//
// 去重说明：同一个“被击败”事件在引擎里会分别经过 triggerReaction / reactionWindow 两次窗口调用
// （见 src/engine/enemies.js:395-409、499-505），本卡只需要结算 1 次。引擎的 perWindow 限额键依赖
// context.windowInstance，但全仓没有任何地方写入它（src/engine/limits.js:87），若用 perWindow 会退化为
// “整局只能 1 次”。因此这里在内容层用结算上下文（轮/阶段/回合/动作序号 + 事件实体）做一次去重，
// 保证“每个击败事件各 1 充能、不同击败事件各自触发”。根治方案见
// artifacts/tfa-fix/primitive-requests/player-1-04026.json（窗口上下文补 windowInstance）。

import { ownSeat } from '../../engine/matcher.js'

// 本次“被击败”事件的去重键：同一事件的两次窗口调用上下文不同，但事件实体与动作序号相同。
const chargeEventKey = ctx => {
  const state = ctx?.state
  const context = ctx?.context || {}
  return [
    state?.round, state?.phase, state?.turnSerial ?? 0, state?.moveCount ?? 0,
    context.enemy?.id || '', context.kind || '', context.assetCode || '', context.location || '',
  ].join('|')
}

const differentDefeatEvent = ctx => {
  const source = ctx?.source
  return !source || source._lastDefeatChargeKey !== chargeEventKey(ctx)
}

export default {
  code: '04026',
  uses: 0,
  usesType: 'charges',
  abilities: [
    {
      kind: 'reaction', trigger: ['defeatEnemy', 'defeatAtLocation'], label: '本地点的调查员/盟友/敌人被击败后放置 1 充能',
      criteria: [ownSeat(), differentDefeatEvent],
      resolve: ({ state, source, api, context }) => {
        if (!source) return
        const key = chargeEventKey({ state, context })
        if (source._lastDefeatChargeKey === key) return
        source._lastDefeatChargeKey = key
        api.addUses(source, 1)
        api.info(`「${api.cardName('04026')}」获得 1 充能（${source.uses}）。`)
      },
    },
    {
      kind: 'action', label: '花费 1 充能：抽 1 张牌并获得 1 资源', cost: { action: true, uses: 1 },
      resolve: ({ inv, api }) => { api.drawCards(inv.seat, 1); api.gainResources(inv.seat, 1) },
    },
  ],
  modifiers: [

  ],
}
