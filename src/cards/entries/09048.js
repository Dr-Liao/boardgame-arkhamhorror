// 09048 地区测绘（Map the Area）· 探寻者（Seeker）事件 · 0 经验。
//
// 卡面：调查。本次调查将你的[意志]或[敏捷]加入你的技能值。如果你检定成功，不发现该地点的线索，
//       改为将地区测绘附属到该地点。每个地点仅限 1 张。
//       所附属地点的所有技能检定难度降低 1 点。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 「调查 + 把[意志]/[敏捷]加入技能值 + 成功改为附属」→ api.investigate 的 addSkill /
//     noClueDiscovery / onInvestigateSuccess（actions.js#runInvestigate 的同一份结算流程）。
//   · 附属 → api.attachToLocation（location-attachments.js#attachLocationCard，scope:'player'）。
//   · 「所附属地点所有技能检定难度 -1」→ 附属条目在 descriptorSources 里以同地点共享能力登记
//     （assetRule.sharedLocationAbility），forced 描述子挂 testBegins 窗口调 api.reduceTestDifficulty。
const CODE = '09048'

export default {
  code: CODE,
  // 同一地点任意调查员的检定都要受影响：地点附属在能力层的枚举条件是「同地点 + 共享地点能力」。
  assetRule: { sharedLocationAbility: true },
  abilities: [
    {
      kind: 'played',
      countsAs: 'investigate',
      label: '调查：将[意志]或[敏捷]加入技能值；成功后改为附属到该地点',
      resolve: ({ state, inv, api }) => {
        const here = api.locationById(inv.location)
        if (!here) {
          api.info('「地区测绘」：你不在任何地点，无法测绘。')
          return
        }
        const attached = (state.playerLocationAttachments || [])
          .some(item => item.code === CODE && item.location === here.id)
        if (attached) {
          api.info(`「地区测绘」：「${api.locationName(here.id)}」已经有 1 张地区测绘（每个地点仅限 1 张）。`)
          return
        }
        const skill = api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: '「地区测绘」：把[意志]或[敏捷]加入本次调查的技能值。',
          options: [{ id: 'willpower', label: '意志' }, { id: 'agility', label: '敏捷' }],
        })
        api.info(`🗺️ 「地区测绘」：${inv.name} 用${skill === 'willpower' ? '意志' : '敏捷'}进行本次调查。`)
        api.investigate(inv.seat, {
          addSkill: skill === 'agility' ? 'agility' : 'willpower',
          // 成功时「不发现线索，改为附属」，因此关掉线索发现，由 onInvestigateSuccess 写附属。
          noClueDiscovery: true,
          onInvestigateSuccess: () => {
            api.attachToLocation(here.id, { code: CODE, ownerSeat: inv.seat })
            api.info(`🗺️ 「地区测绘」附属到「${api.locationName(here.id)}」：本地点所有技能检定难度 -1。`)
          },
        })
      },
    },
    {
      kind: 'forced',
      trigger: 'testBegins',
      // 同一窗口实例只结算一次：tests.js 对 testBegins 同时开 triggerReaction 与 reactionWindow，
      // 两处都会枚举到强制描述子，perWindow 上限把重复结算挡掉。
      limit: { scope: 'perWindow', owner: 'player' },
      label: '所附属地点的所有技能检定难度 -1',
      criteria: [({ inv, source, context }) => Boolean(source?.location)
        && source.location === (context?.location || inv.location)],
      resolve: ({ api, source }) => {
        api.reduceTestDifficulty(1)
        api.info(`🗺️ 「地区测绘」：${api.locationName(source.location)} 的技能检定难度 -1。`)
      },
    },
  ],
  modifiers: [],
}
