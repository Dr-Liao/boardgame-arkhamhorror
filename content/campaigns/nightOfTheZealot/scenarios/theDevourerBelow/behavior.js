import { declareScenario } from '../../../../scenario-declaration.js'

// Phase 3（D3）：地点与遭遇牌库组成是声明；脚本只剩额外毁灭、午夜弃牌、献祭行动与弱点。
export const behavior = declareScenario({
  id: 'theDevourerBelow',
  data: { includeSurvivingPriest: true, interruptRitualActIndex: 2, sacrificeLita: true },
  setup: {
    locations: { pool: 'woodsPool', count: 4, first: 'mainPath' },
    deck: { addAgentSet: true },
  },
  hooks: {
    afterDeckSetup(state, events, api) {
      const escaped = (state.campaign.records.cultistsEscaped || []).length
      const extraDoom = Math.floor((escaped + 1) / 2)
      if (extraDoom > 0) {
        state.doom += extraDoom
        api.info(state, events, `🌑 逃跑的异教徒 ${escaped} 名，密谋上额外放置 ${extraDoom} 点毁灭（当前 ${state.doom}）。`)
      }
    },
    afterMulligan(state, events, api) {
      if (!state.campaign.records.pastMidnight) return
      for (const inv of state.investigators) {
        api.discardRandomFromHand(state, inv, 2)
        api.info(state, events, `${inv.name} 因午夜已至，随机弃掉 2 张起始手牌。`)
      }
    },
    // 乌默尔多斯卡面上的 [action]：条件不满足时也返回，让 AI 知道这条路存在。
    actions(state, inv) {
      const boss = state.enemies.find(enemy => enemy.code === 'umordhoth')
      const controlled = inv.assets.some(asset => asset.code === '01117')
      const bossAt = boss && (state.locations.find(location => location.id === boss.location)?.name || boss.location)
      return [{ action: 'sacrificeLita', enemyId: boss?.id, scriptCard: 'enemy', label: '😱 献祭丽塔·钱德勒（→ 结局 3）',
        reason: !controlled ? '需要先控制丽塔·钱德勒'
          : !boss ? '乌默尔多斯尚未降临'
            : boss.location === inv.location ? null : `需要与乌默尔多斯位于同一地点（它在「${bossAt}」）` }]
    },
    describe(state) {
      return state.actIndex === 2 ? [`破坏仪式进度：${state.actClues}/${state.numInvestigators * 2}。`] : []
    },
    // Phase 3（D4）：记录/创伤/阵亡/失败都是声明；结局 3 的随机疯狂弱点留在钩子里。
    resolution(state, key, events, api) {
      const { campaign } = state
      if (key === 'noResolution') {
        return {
          bonus: 0,
          award: false,
          effects: [
            { record: { succumbedToUmordhoth: true }, failed: true },
            { investigatorStatus: 'killed', targets: 'all' },
          ],
        }
      }
      if (key === 'r3') {
        for (const inv of state.investigators) {
          const pool = api.basicWeaknessPool().filter(code => api.ALL_CARDS[code].traits.some(trait => trait.toLowerCase() === 'madness'))
          if (!pool.length) throw new Error('疯狂弱点依赖缺失')
          api.campaignCardChange(campaign, inv.seat, pool[Math.floor(api.randomValue(state) * pool.length)], 'add', 'sacrificedLita')
        }
      }
      return {
        bonus: key === 'r1' ? 5 : key === 'r2' ? 10 : 0,
        award: true,
        effects: [
          { record: { ritualBroken: true }, when: { resolution: 'r1' } },
          { record: { repelledUmordhoth: true }, when: { resolution: 'r2' } },
          { record: { sacrificedLita: true }, when: { resolution: 'r3' } },
          { trauma: { all: { mental: 2 } } },
          { trauma: { all: { physical: 2 } }, when: { not: { resolution: 'r1' } } },
        ],
      }
    },
  },
})
