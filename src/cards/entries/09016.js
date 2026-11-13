// 09016「达雷尔的柯达相机」（Darrell's Kodak）· 支援 · 达雷尔专属签名
// 卡面：达雷尔牌库专用。
//   [reaction] 在一个敌人或诡计进入游戏后，横置达雷尔的柯达相机：
//     从标记池放置 1 个资源到该敌人或诡计上，作为证据。
//   [reaction] 在你发现任意数量的线索后：把该地点（或不在任何地点）的敌人/诡计上
//     同等数量的证据移到达雷尔的柯达相机上。
//
// 读点（卡面 → 引擎读点）：
//   · 证据 = 卡实例具名计数器 'evidence'（src/engine/card-counters.js；白名单 id），
//     加/减走 api.addCardCounter，搬运走 api.moveCardCounters（两张卡之间，目标非 null）。
//   · 敌人进入游戏：enemies.js:593 派发的 `enemySpawn` 窗口（context.enemy）。
//   · 诡计进入游戏：threat-entry.js#afterThreatEntered 派发的 `threatEntered` 窗口
//     （context.card / cardCode）。
//   · 发现线索后：locations.js#discoverClueAt 派发的 `clueDiscovered` 窗口
//     （context.location / amount）。
//   · P1-6 重复结算修复：clueDiscovered 这一事件在 locations.js:468-469 会先后走
//     triggerReaction 与 reactionWindow，二者都会打开能力层窗口（triggerReaction 末尾同样调
//     openAbilityWindow），同一描述子会被询问/结算两次。这里用 limit { scope:'perWindow' }
//     按「同一窗口实例」去重（limits.js：窗口键 = 窗口名+轮/阶段/回合/动作序号+事件地点，
//     两次开窗完全一致），不会误伤不同动作里的后续线索发现。
//     根治（删掉重复开窗）属于引擎改造，已列给主进程；跳过第一次询问时仍会被问第二次，
//     但不会重复搬运证据。
const KODAK = '09016'
const isEvidenceSource = card => (Number(card?.markers?.evidence) || 0) > 0

export default {
  code: KODAK,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'enemySpawn',
      label: '敌人进入游戏后：横置柯达，在其上放 1 个证据',
      cost: { exhaust: true },
      criteria: [({ context }) => Boolean(context?.enemy)],
      resolve: ({ context, api }) => {
        if (context?.enemy) api.addCardCounter(context.enemy, 'evidence', 1)
      },
    },
    {
      kind: 'reaction',
      trigger: 'threatEntered',
      label: '诡计进入游戏后：横置柯达，在其上放 1 个证据',
      cost: { exhaust: true },
      criteria: [({ context }) => Boolean(context?.card || context?.threat || context?.cardId)],
      resolve: ({ context, api }) => {
        const card = context?.card || context?.threat
        if (card) api.addCardCounter(card, 'evidence', 1)
      },
    },
    {
      kind: 'reaction',
      trigger: 'clueDiscovered',
      // 同一线索发现事件只结算一次（见文件头「P1-6 重复结算修复」）。
      limit: { scope: 'perWindow', owner: 'instance' },
      label: '发现线索后：把该地点/不在任何地点的敌人与诡计上同等数量的证据移到柯达',
      criteria: [({ context }) => Number(context?.amount ?? context?.clues ?? 0) > 0],
      resolve: ({ state, inv, context, api }) => {
        const kodak = (inv.assets || []).find(asset => asset.code === KODAK)
        if (!kodak) return
        const discovered = Number(context.amount ?? context.clues ?? 0)
        let remaining = discovered
        const here = (state.locations || []).find(location => location.id === context?.location)
        // 卡面「该地点（或不在任何地点）的敌人/诡计」：
        //   敌人 = 在该地点的敌人；地点遭遇附属/地点附属 = 在该地点的诡计；
        //   威胁区的诡计不属于任何地点（「不在任何地点」），因此遍历全部调查员的威胁区。
        const cards = [
          ...(state.enemies || []).filter(enemy => enemy.location === context?.location),
          ...((here && here.attachments) || []),
          ...(state.playerLocationAttachments || []).filter(attachment => attachment.location === context?.location),
          ...(state.investigators || []).flatMap(owner => owner.threat || []),
        ].filter(isEvidenceSource)
        for (const card of cards) {
          if (!remaining) break
          const amount = Math.min(remaining, Number(card.markers?.evidence) || 0)
          const moved = api.moveCardCounters(card, kodak, 'evidence', amount)
          remaining -= moved
        }
        if (remaining !== discovered) {
          api.info(`📷 把 ${discovered - remaining} 个证据移到柯达相机。`)
        }
      },
    },
  ],
  modifiers: [],
}
