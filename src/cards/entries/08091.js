// 08091 恩科西·马巴蒂
// 卡面：[reaction]在恩科西·马巴蒂入场后：指定一个非[elder_sign]的符号混乱标记。在本卡牌离场前，
//       指定的标记为你的「咒印」。
//       [reaction]在你所在地点的一位调查员揭示了一个[cultist]、[tablet]或[elder_thing]符号时，
//       横置恩科西·马巴蒂：改为从混乱袋中查找你的咒印并揭示它(将其他标记放回混乱袋)。
//
// 读点（引擎既有原语，真实 performTest 路径）：
//   · 入场：entersPlay 描述子 + api.playerTools.setSigilToken（标记记在支援实例的 `sigilToken` 上，
//     本卡离场实例消失即失效，不写调查员/全局状态）；
//   · 第二子句：kind:'reaction' + trigger:'tokenReveal'，在引擎的 tokenReveal 窗口
//     （src/engine/tests.js:918-941：符号揭示后、结算标记效果前）用
//     api.playerTools.replaceRevealedToken 设置 context.replacementToken=咒印，引擎取消原标记、
//     把它放回混乱袋并改为结算咒印（与「马泰奥的旧印」同一替换路径）。
//     花费/横置走 cost.exhaust；条件限定「同地点」「cultist/tablet/elderthing」「咒印仍在袋中」。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

const SYMBOL_TOKENS = ['skull', 'cultist', 'tablet', 'elderthing']
const TRIGGER_TOKENS = ['cultist', 'tablet', 'elderthing']

export default {
  code: '08091',
  abilities: [
    { kind: 'entersPlay', label: '入场：指定一个非旧印符号标记作为咒印',
      resolve: ({ inv, source, state, api }) => {
        if (!source) return
        const bag = state.chaosBag || []
        const available = SYMBOL_TOKENS.filter(token => bag.includes(token))
        if (!available.length) { api.info('混乱袋中没有可指定的符号标记。'); return }
        const token = available.length === 1 ? available[0] : api.choice({
          kind: 'effect', source: '08091', seat: inv.seat, prompt: '选择要指定为咒印的符号标记。',
          options: available.map(value => ({ id: value, label: api.tokenLabel?.(value) || value })),
        })
        if (!available.includes(token)) return
        api.playerTools.setSigilToken(inv.seat, token, { asset: source })
        api.info(`「恩科西·马巴蒂」：指定 ${api.tokenLabel?.(token) || token} 为你的咒印。`)
      } },
    { kind: 'reaction', trigger: 'tokenReveal',
      label: '横置：将同地点调查员刚揭示的符号标记改为你的咒印',
      cost: { exhaust: true },
      criteria: ({ state, inv, source, context }) => Boolean(source) && !source.exhausted
        && context?.when === 'tokenReveal'
        && TRIGGER_TOKENS.includes(context.token)
        && context.location === inv.location
        && Boolean(source.sigilToken)
        && (state.chaosBag || []).includes(source.sigilToken)
        && !context.replacementToken,
      resolve: ({ source, context, api }) => {
        api.playerTools.replaceRevealedToken(context, source.sigilToken)
      } },
  ],
  modifiers: [],
}
