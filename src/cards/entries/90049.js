// 90049 吉姆·卡尔弗（平行 / Laid to Rest，挑战「入土为安」必需调查员）。
//
// 卡面（cards-data 90049）：
//   [reaction] After you reveal 1 or more [skull] or [curse] tokens during a skill test you are
//     performing: Replenish 1 charge on an asset you control. (Limit once per round.)
//   [elder_sign] effect: +2. You may treat this token as if it were a [skull] or [curse] token instead.
//
// 引擎读点：
//   · 揭示标记后的能力窗口 `chaosTokenRevealed`（windows.js，tests.js 在每枚标记揭示后开窗；
//     context = { seat, token, tokenIndex, location }）。条件：本次检定是自己发起的
//     （state.skillTest.seat === inv.seat）、token 为 skull/curse、`limit: 'oncePerRound'`。
//   · 补 1 充能：`api.addUses(asset, 1)`（api-misc.js：通用实例 uses 增减；asset.uses 即充能/弹药计数）。
//     目标限定为「带 uses 的支援」由条目筛选（cards-data 没有 usesType 字段，故按实例 uses != null 判定，
//     并排除已满的支援由玩家选择——见 note）。
//   · 旧印「视为 skull/curse」：`elderSign.resolve` 返回 `asSkull: true` 被 tests.js 认可
//     （ES 结算时按 skull 处理）；[curse] 面没有对应返回字段 → 见 note + request。
//
// 见 note 与 primitive-requests/core-inv-90049-elder-sign-curse.json。

const code = '90049'
const isTargetToken = token => token === 'skull' || token === 'curse'
const chargeAssets = inv => (inv.assets || []).filter(asset => !asset.facedown && asset.uses != null)

export default {
  code,
  kind: 'investigator',
  investigator: { elderSign: { bonus: 2 } },
  elderSign: {
    id: '90049-eldersign',
    label: '旧印：+2。可将其视为 [skull] 或 [curse] 标记',
    resolve: ({ inv, api }) => {
      const answer = api.choice({
        kind: 'reaction', source: '90049-eldersign', seat: inv.seat,
        prompt: '旧印：是否将其视为 [skull] 标记？（[curse] 面缺读点）',
        options: [{ id: 'skip', label: '保留 +2 的旧印' }, { id: 'skull', label: '视为 [skull] 标记' }],
      })
      return { delta: 2, ...(answer === 'skull' ? { asSkull: true } : {}) }
    },
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'chaosTokenRevealed',
      limit: 'oncePerRound',
      label: '自己检定中揭示 [skull]/[curse] 后：补满一个支援上的 1 个充能',
      criteria: ({ inv, state, context }) => context?.seat === inv.seat
        && isTargetToken(context.token)
        && state.skillTest?.seat === inv.seat
        && chargeAssets(inv).length > 0,
      resolve: ({ inv, api }) => {
        const candidates = chargeAssets(inv)
        if (!candidates.length) return
        const id = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: code, seat: inv.seat,
          prompt: '选择要补满 1 个充能的支援。',
          options: candidates.map(asset => ({ id: asset.id, cardCode: asset.code, label: api.cardName(asset.code) })),
        })
        const asset = candidates.find(candidate => candidate.id === id)
        if (!asset) return
        api.addUses(asset, 1)
        api.info(`「${api.cardName(asset.code)}」补满 1 个充能。`)
      },
    },
  ],
  modifiers: [],
  note: '近似：充能支援按「实例带 uses」筛选（cards-data 无 usesType 字段）；旧印的 [curse] 面缺 `asCurse` 返回字段，仅支持视为 skull（primitive-requests/core-inv-90049-elder-sign-curse.json）。',
}
