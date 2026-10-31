// 06156 “吃一堑……”
// 卡面：快速。在你结算一张诡计卡牌的任何效果后，将要弃掉该卡牌时打出。
//       将“吃一堑……”放置入场，放到你的游戏区域，附属该诡计卡牌到“吃一堑……”上。
//       [reaction]在任意一位调查员抽取与附属的诡计卡牌同名的卡牌时，弃掉“吃一堑……”：取消该卡牌的显现效果。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 近似实现（显式简化，详见 note）：快速事件挂在 encounterDrawn 窗口，用引擎唯一的遭遇取消读点
// api.cancelEncounterDraw 取消「当前抽到的这张诡计」的显现效果（读点 state._reaction.context，
// 由 playReactionCard 在执行前写入；参考 05014 的取消显现写法）。
// 完整卡面（结算后弃置时点打出、把该诡计附属到本卡、只取消后续同名副本）需要
// 「诡计结算后将要弃掉」窗口 + 附属存储 + 同名副本过滤，已提原语请求，P8 前不实现。

import { ALL_CARDS } from '../../cards/cards-data.js'

const isTreachery = (state, code) => ALL_CARDS[code]?.type === 'treachery'
  || state.cards?.[code]?.type === 'treachery'

export default {
  code: '06156',
  simplified: true,
  note: '近似实现：当前在「你抽到一张诡计」的 encounterDrawn 窗口快速打出，取消这张诡计本次的显现效果；'
    + '未实现：①「结算诡计效果后、将要弃掉时」这个打出时机（引擎没有该窗口）；'
    + '②把该诡计附属到本卡并只取消后续同名副本（没有「已结算诡计附属」的存储/查询原语），'
    + '因此本卡不会留在场上，取消的是当前这张而不是同名副本。完整原语请求见 '
    + 'artifacts/migration/tde/primitive-requests/w-m2-2-06156-treachery-discard-window.json。',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'encounterDrawn',
      label: '快速：取消本次抽到的诡计的显现效果（近似「吃一堑……」）',
      criteria: [({ state, inv, context }) => context?.seat === inv.seat
        && Boolean(context?.cardCode) && isTreachery(state, context.cardCode)
        && context.cancelled !== true && context.cannotCancel !== true],
      resolve: ({ inv, api }) => {
        const cancelled = api.cancelEncounterDraw(inv.seat, { shuffleBack: false })
        if (!cancelled) { api.info('当前没有可取消的诡计显现。'); return }
        api.info(`🛡️ ${inv.name} 打出「${api.cardName('06156')}」：取消这张诡计的显现效果（近似卡面）。`)
      },
    },
  ],
  modifiers: [],
}
