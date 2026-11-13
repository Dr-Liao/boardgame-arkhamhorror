// 09716a 结社特工（A）（Coterie Agent (A)）· 敌人 · crimson_conspiracy
// 卡面：隐匿 2。强制 - 在结社特工进入阴影后：在上面放置 1 个毁灭标记。
//   [reaction] 在结社特工揭露时：将其弃掉。
// 读点：enemySpawnRule.doomOnSpawn（enemies.js#enterExistingEnemy 在入场后放毁灭）；
//   reaction 挂在 tskExposed 窗口（P4 注册的揭露后时机，context 带 kind/decoy/seat/location——
//   内容层在 exposeMiniCard 返回真身后把 kind 设为敌人卡号并开窗）。
// 近似：① 隐匿 X 没有引擎读点（concealed 值放 flags 供内容层建迷你卡）；
//   ② 「进入阴影」用生成时的 doomOnSpawn 等价实现；③ tskExposed 需内容层开窗（primitive-requests/09716a.json）。
const CODE = '09716a'

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  flags: { concealed: 2, coterie: true, agentLetter: 'A' },
  enemySpawnRule: { doomOnSpawn: 1 },
  abilities: [{
    kind: 'reaction',
    trigger: 'tskExposed',
    label: '结社特工被揭露时：将其弃掉',
    criteria: ({ source, context }) => Boolean(source) && source.defeated !== true
      && context?.decoy !== true && String(context?.code ?? context?.kind) === String(source.code),
    resolve: ({ source, api }) => {
      api.discardEnemy?.(source)
      api.info?.('揭露「结社特工（A）」：将其弃掉。')
      return true
    },
  }],
  note: 'approximation: 隐匿 2 只登记 flags.concealed（无引擎读点）；「进入阴影后放 1 毁灭」用入场'
    + 'doomOnSpawn 等价；揭露弃掉依赖 tskExposed 窗口由内容层开（primitive-requests/09716a.json）。',
}
