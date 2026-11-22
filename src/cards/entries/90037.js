// 90037 温蒂·亚当斯（平行 / Red Tide Rising，挑战「血潮涌起」必需调查员）。
//
// 卡面（cards-data 90037）：
//   Add Tidal Memento to your deck.（牌库必然加入 90038 潮汐信物，永久——构筑接线由 Lead 负责）
//   [reaction] After you successfully evade a non-[[Elite]] enemy: Seal either 1 [bless] or [curse]
//     token from the chaos bag, or any [bless] or [curse] tokens revealed from the chaos bag during
//     this test, on that enemy.
//   [elder_sign] effect: +2. Search the chaos bag for up to 2 [bless] and/or [curse] tokens and
//     reveal them, ignoring their effects.
//
// 引擎读点：
//   · 躲避成功窗口 `evadeSuccess`（combat.js；context = { enemy, location, successBy }）→ 反应结算。
//   · 从混乱袋封印：`api.sealChaosTokenFromBag(token, card)`（api-misc.js：把 `state.chaosBag` 里的
//     标记移入 `state.chaos.sealed`，source = 实体 id；敌人实例带 id，可作封印宿主）。
//     袋内容只读 `state.chaosBag`（公开数组，牌面为 'bless'/'curse' 等）。
//   · 旧印：`elderSign.resolve` 返回 { delta: 2 }；「搜索并揭示至多 2 个 bless/curse、忽略效果」
//     缺「从袋中指定标记并作为本次检定揭示结果」的原语（只有随机 `api.revealChaosTokens`,
//     会按正常标记规则结算数值/效果）→ 近似为：只返回 +2，并在日志中说明；已排队
//     primitive-requests/core-inv-90037-chaos-bag-token-selection.json。
//   · 本次检定「已揭示的」bless/curse 令牌：引擎只在 `state.chaos.revealed` 里暂存（检定结束才归还袋），
//     没有把它们封印到敌人的 API；当前近似只支持「从袋中另取 1 个」这一支，
//     「封印本次检定已揭示的标记」并列在同一个 primitive request 里。

const code = '90037'
const isBlessOrCurse = token => token === 'bless' || token === 'curse'
const labelOf = token => (token === 'bless' ? '[bless]' : '[curse]')

export default {
  code,
  kind: 'investigator',
  // 平行温蒂的特性由 cards-data 提供（Drifter/Blessed/Cursed）；旧印 +2 是静态值，
  // AI/预览读 `investigator.elderSign.bonus`。
  investigator: { elderSign: { bonus: 2 } },
  elderSign: {
    id: '90037-eldersign',
    label: '旧印：+2。可搜索混乱袋并揭示至多 2 个 [bless]/[curse] 标记（忽略效果）',
    resolve: ({ inv, state, api }) => {
      // 近似：没有「指定袋中标记作为揭示结果」的原语，只列出可选项（见文件头）。
      const candidates = (state.chaosBag || []).filter(isBlessOrCurse).slice(0, 2)
      if (candidates.length) {
        api.info(`${inv.name} 的旧印：混乱袋中有 ${candidates.map(token => labelOf(token)).join('、')} 可供搜索（当前读点不支持指定揭示，忽略效果）。`)
      }
      return { delta: 2 }
    },
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'evadeSuccess',
      label: '成功躲避非精英敌人后：从混乱袋封印 1 个 [bless]/[curse] 标记到该敌人上',
      criteria: ({ context }) => Boolean(context?.enemy) && context.enemy.elite !== true,
      resolve: ({ inv, context, state, api }) => {
        const enemy = context.enemy
        if (!enemy || enemy.defeated) return
        const options = [...new Set((state.chaosBag || []).filter(isBlessOrCurse))]
        if (!options.length) return
        const token = options.length === 1 ? options[0] : api.choice({
          kind: 'effect', source: code, seat: inv.seat,
          prompt: `从混乱袋封印 1 个标记到「${enemy.name || enemy.code || '该敌人'}」上。`,
          options: options.map(face => ({ id: face, label: labelOf(face) })),
        })
        if (!isBlessOrCurse(token)) return
        const sealed = api.sealChaosTokenFromBag(token, enemy)
        if (sealed) api.info(`「${enemy.name || enemy.code || '敌人'}」上封印了 1 个${labelOf(token)}标记。`)
      },
    },
  ],
  modifiers: [],
  note: '近似：仅支持「从袋中另取 1 个 bless/curse 封印」；「封印本次检定已揭示的 bless/curse」与旧印的「指定袋中标记揭示并忽略效果」缺原语（primitive-requests/core-inv-90037-chaos-bag-token-selection.json）。',
}
