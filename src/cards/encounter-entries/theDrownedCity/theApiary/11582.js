// 11582 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
//
// P7 第二轮「受控剧情资产行动」原语：scope:'storyAsset' + controlledAsset:true 后，本条目声明的
// free 能力随 inv.assets 里的实例进入 legalMoves / 玩家能力窗口（controlledAbilityCards），
// 与玩家资产同一套 executeDescriptor 管线（费用、exhaust、目标枚举）。
//
// P7 第六轮收口：
//   · 「直到你的下个回合开始，你不能移动，且不能对敌人造成伤害或与敌人交战」= 引擎既有持续效果
//     `api.addEffect({ duration:'startOfNextTurn', controllerSeat, modifiers:[
//     {target:'capability:move'},{target:'capability:dealEnemyDamage'},{target:'capability:engage'}] })`
//     （effect-state.js 的 startOfNextTurn 到期点 + hidden-rules/combat/enemies 的 capability 读点）。
//   · 「符文 j/m/s/c/b 集齐后」= 第二条描述子的 criteria 读 campaign.records.discoveredGlyphs。
export default {
  code: '11582',
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  flags: {"glyphLine":["j","m","s","c","b"]},
  abilities: [
    {
      kind: 'free',
      label: '横置骇人“面具”：与你交战的每名敌人解除交战',
      cost: { exhaust: true },
      resolve: ({ inv, state, api }) => {
        for (const id of [...(inv.engaged || [])]) {
          const enemy = (state.enemies || []).find(item => item.id === id)
          if (enemy) api.disengageEnemy(enemy)
        }
        // 印刷后续限制：直到你的下个回合开始不能移动、不能对敌人造成伤害或与敌人交战。
        api.addEffect?.({
          duration: 'startOfNextTurn',
          sourceCode: '11582',
          controllerSeat: inv.seat,
          label: '骇人“面具”：直到你的下个回合开始不能移动、不能对敌人造成伤害或与敌人交战',
          modifiers: [
            { target: 'capability:move' },
            { target: 'capability:dealEnemyDamage' },
            { target: 'capability:engage' },
          ],
        })
      },
    },
    {
      kind: 'free',
      label: '受到 1 点直接恐惧并横置：对所在地点一名敌人造成 2 点伤害',
      cost: { exhaust: true, horror: 1 },
      target: { kind: 'enemy' },
      // 符文 j/m/s/c/b 集齐后才可用第二条 [fast]。
      criteria: ({ state }) => {
        const glyphs = new Set(state.campaign?.records?.discoveredGlyphs || [])
        return ['J', 'M', 'S', 'C', 'B'].every(letter => glyphs.has(letter))
      },
      resolve: ({ inv, target, api }) => {
        const enemy = target?.entity
        if (enemy) api.damageEnemy(enemy, 2, inv.seat, { code: '11582' })
      },
    },
  ],
  note: "印刷：[fast] 横置：与你交战的每名敌人解除交战；直到你的下个回合开始，你不能移动，且不能对敌人造成伤害或与敌人交战。符文 j/m/s/c/b 集齐后 [fast] 受到 1 点直接恐惧并横置：对你所在地点一名敌人造成 2 点伤害。已接线：两个 [fast] 走 controlledAsset:true 的 free 能力声明（legalMoves + executeDescriptor；解除交战走 api.disengageEnemy、伤害走 api.damageEnemy、exhaust/直接恐惧走描述子 cost）；「直到下个回合开始不能移动/造成伤害/交战」由 api.addEffect({duration:'startOfNextTurn', controllerSeat, modifiers:[capability:move / capability:dealEnemyDamage / capability:engage]})（引擎既有 effect-state + capability 读点）接线；「符文 j/m/s/c/b 集齐后才可用第二条」由描述子 criteria 读 campaign.records.discoveredGlyphs 门槛；结局时仍被控制记录 grislyMask（behavior.controlledGrislyMask / resolution）。全部子句已接线。",
}
