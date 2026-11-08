// 08028 追猎行动
// 卡面：快速。在神话阶段期间你将抽取遭遇卡牌时打出。
//       改为从遭遇牌库中查找一个敌人，将其生成并与你交战(而非在本来的位置生成它)，
//       将追猎行动附属到该敌人上，并混洗遭遇牌库。
//       [reaction] 在你击败被附属的敌人时：获得 3 资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（真实神话阶段路径）：
//   · 触发窗口 mythosEncounterStep（src/engine/turn.js:144-146）：反应窗口返回的 context 带
//     `skip` 标志时，引擎不再为调查员抽遭遇卡；条目用 api.playerTools.skipEncounterStep(context)
//     写这个标志（同一入口 07269 使用），实现卡面「Instead」替代本次遭遇抽取；
//   · 遭遇牌库「查找」用只读 state.encounterDeck 枚举敌人 code + api.spawnEncounterEnemy
//     （从遭遇牌库取走该敌人 → 按你所在地点生成并与你交战 → 混洗遭遇牌库）；
//   · 击败奖励用持续效果上的 defeatEnemy 反应（effect DSL gainResource 3）表达。
//
// approximation（如实披露，不计入完整实现）：
//   · 「将追猎行动附属到该敌人上」：引擎没有「结算后的玩家事件卡附到敌人」的通用原语
//     （played 描述子结算时卡已离手；attachTo 声明只支持 asset/investigator 宿主）。
//     本实现用持续效果 sourceInstanceId 指向被追猎的敌人来标记归属（敌人实体上没有附属卡，
//     投影不可见；请求 m2-1-08028.json 待原语）；
//   · 「在你击败被附属的敌人时」：近似为效果有效期内任意敌人被击败都可触发一次
//     （duration endOfRound + oncePerGame 限制滥触发）。
const isEnemy = (api, code) => api.cardType(code) === 'enemy'

export default {
  code: '08028',
  note: 'approximation: 事件附属到敌人与击败奖励归属仍为近似（缺玩家事件附敌通用原语）；神话遭遇替代已接真实 skip 读点。',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'mythosEncounterStep',
      label: '神话阶段抽遭遇前：改为从遭遇牌库查找敌人生成并交战，替代本次遭遇抽取；击败被追猎敌人获得 3 资源',
      resolve: ({ state, inv, context, api }) => {
        const candidates = [...new Set((state.encounterDeck || []).filter(code => isEnemy(api, code)))]
        // 卡面「Instead」：无论能否找到敌人，本次遭遇抽取都被替代（不抽遭遇卡）。
        api.playerTools.skipEncounterStep(context)
        if (!candidates.length) {
          api.info('追猎行动：遭遇牌库中没有敌人；本次遭遇抽取被替代。')
          return
        }
        const chosen = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'encounter', source: '08028', seat: inv.seat,
          prompt: '追猎行动：从遭遇牌库中查找一个敌人。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        const code = candidates.includes(chosen) ? chosen : candidates[0]
        const spawned = api.spawnEncounterEnemy(inv.seat, code)
        if (!spawned) {
          api.info('追猎行动：无法生成该敌人；本次遭遇抽取被替代。')
          return
        }
        api.info(`追猎行动：「${api.cardName(code)}」在 ${inv.name} 的地点生成并交战；遭遇牌库已混洗，本次遭遇抽取被替代。`)
        api.addEffect({
          duration: 'endOfRound',
          sourceCode: '08028',
          sourceInstanceId: spawned.id,
          label: '追猎行动：击败被追猎的敌人获得 3 资源',
          modifiers: [],
          abilities: [{
            kind: 'reaction',
            trigger: 'defeatEnemy',
            label: '击败被追猎的敌人：获得 3 资源',
            limit: 'oncePerGame',
            effect: { type: 'gainResource', amount: 3 },
          }],
        })
      },
    },
  ],
  modifiers: [],
}
