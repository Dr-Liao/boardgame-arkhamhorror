// 11688 黏土恐怖 · 梦之雕塑 · [[神器]]剧情资产（阿卡姆的毁灭 第一部分）。
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartI（P7 终章上篇）。
// 卡面：每名[[星之眷族]]敌人失去巡逻和其印刷的猎物指示，并获得猎手和「猎物 - 你」。
//       [tdc_rune_u]·[tdc_rune_x]·[tdc_rune_o]·[tdc_rune_o]·[tdc_rune_d]·[tdc_rune_f]·[tdc_rune_z]
//       [fast] 横置黏土恐怖：将本支援的印刷文本框视为空白，直到本轮结束（除特性外），
//       或将一名[[星之眷族]]敌人向任意方向移动一次。
// 印刷：[[Item]][[Artifact]][[R'lyeh]]；本关争夺目标（结局 1 时若被控制则记录「黏土恐怖」）。
// 读点（PRIMITIVES 已落地，全部接线）：
//   · 被动：`storyAssetRule.enemyOverride = { trait:'Star Spawn', lose:['patrol','prey'],
//     gain:['hunter'], prey:'controller' }` → story-asset-rules.js 被 turn.js#enemyHasHunter /
//     turn.js#patrolMove / card-ops.js#preyTarget（猎物 = 控制者）读取；
//   · [fast]：`scope:'storyAsset' + controlledAsset:true` 让受控实例进入合法动作表
//     （moves.js#controlledAbilityCards）；`kind:'free'` + `cost:{exhaust:true}`；
//     resolve 二选一：`api.scenario.blankStoryAssetText(asset,{untilRoundEnd:true})`（文本空白，
//     card-text.js#assetTextBlanked / turn.js 轮末恢复）或 `api.scenario.moveEnemy(enemy, destination)`
//     移动一名[[星之眷族]]敌人一次（移动到相连地点一次；与印刷口径一致，见 note）。
// 读点：behavior.artifactsControlled（flag.artifact：控制它计入「控制 ≥1 张神器」与结局记录）。
const CODE = '11688'
const traitOf = (value, name) => (value?.traits || [])
  .some(trait => String(trait).toLowerCase() === name.toLowerCase())
const starSpawnInPlay = state => (state?.enemies || []).filter(enemy => traitOf(enemy, 'Star Spawn'))
const myAsset = (state, inv) => (inv?.assets || []).find(asset => String(asset.originalCode || asset.code) === CODE) || null

export default {
  code: CODE,
  name: '黏土恐怖',
  scope: 'storyAsset',
  controlledAsset: true,
  implemented: true,
  flags: { artifact: true, horrorInClay: true },
  storyAssetRule: {
    enemyOverride: { trait: 'Star Spawn', lose: ['patrol', 'prey'], gain: ['hunter'], prey: 'controller' },
  },
  abilities: [{
    kind: 'free',
    label: '[fast] 横置黏土恐怖：本轮文本空白，或移动一名[[星之眷族]]敌人一次',
    cost: { exhaust: true },
    criteria: [({ state, inv }) => Boolean(myAsset(state, inv)) && starSpawnInPlay(state).length > 0],
    resolve: ({ state, inv, api }) => {
      const asset = myAsset(state, inv)
      if (!asset) return false
      const spawn = starSpawnInPlay(state)
      const mode = String(api.choose?.({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '黏土恐怖：选择一种模式',
        options: [
          { id: 'blank', label: '本轮将本支援的印刷文本框视为空白' },
          ...(spawn.length ? [{ id: 'move', label: '将一名[[星之眷族]]敌人向任意方向移动一次' }] : []),
        ],
      }) ?? 'blank')
      if (mode === 'move' && spawn.length) {
        const enemy = spawn.length === 1 ? spawn[0] : spawn[Number(api.choose?.({
          kind: 'enemy', source: CODE, seat: inv.seat,
          prompt: '选择要移动的[[星之眷族]]敌人',
          options: spawn.map((item, index) => ({ id: String(index), label: item.name || item.code })),
        })) || 0] || spawn[0]
        const origin = state.locations?.find(location => location.id === enemy.location)
        const destinations = (state.locations || []).filter(location => location.id !== enemy.location
          && (origin?.connections || []).includes(location.id))
        if (destinations.length) {
          const destination = destinations.length === 1 ? destinations[0] : destinations[Number(api.choose?.({
            kind: 'location', source: CODE, seat: inv.seat,
            prompt: '选择移动方向',
            options: destinations.map(item => ({ id: item.id, label: item.name })),
          })) || 0] || destinations[0]
          const moved = api.scenario?.moveEnemy?.(enemy, destination.id)
          if (moved) {
            api.info?.(`黏土恐怖：将「${enemy.name || enemy.code}」移动到「${destination.name}」。`)
            return true
          }
        }
      }
      const blanked = api.scenario?.blankStoryAssetText?.(asset, { untilRoundEnd: true }) === true
      if (blanked) api.info?.('黏土恐怖：本轮本支援的印刷文本框视为空白（特性仍在）。')
      return blanked
    },
  }],
  note: '被动「星之眷族失去巡逻/猎物、获得猎手、猎物=控制者」走 storyAssetRule.enemyOverride（引擎读点）；'
    + '[fast] 走受控剧情资产 free 能力：文本空白到本轮结束（blankStoryAssetText）或把一名[[星之眷族]]敌人移动到相连地点一次。'
    + '印刷「move a Star Spawn enemy one location」按规则术语即「移动到相连地点一次」，实现与印刷一致，无近似。',
}
