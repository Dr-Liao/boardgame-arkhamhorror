// 05004 黛安娜·史丹利
// 卡面：黛安娜·史丹利底下每有一张卡牌，其得到+1[willpower]。
// 卡面：[reaction]你拥有的一张卡牌取消或忽略卡牌效果或游戏效果后，如果黛安娜·史丹利底下的卡牌数量少于5张：
//       将该卡牌正面朝下放在她底下。抽取1张卡牌并获得1资源。(每阶段仅限一次。)
// 卡面：[elder_sign]效果：+2。你可以选择黛安娜·史丹利底下的一张卡牌加入手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 「压在她底下」用调查员自带的 beneath 区域（与 P2.6 无牌组调查员同一块状态）。
// 反应挂在 cardCancelled 窗口上：引擎在取消/忽略效果时用 src/engine/cancel-note.js 记账，
// 取消方的卡号由 executeDescriptor 在结算期间写在 state._resolvingCardCode 上。
// 已知缺口（第三轮审计仍判 approximation）：直接写 context.cancelled 的旧取消路径
// （如 01523 闪避、05280 否决存在）不经过 noteCardCancelled，cardCancelled 窗口不会打开。
// 第五轮修复（2026-10-25）：引擎已在 executeDescriptor 结算后检测「直接写 context.cancelled」
// 并自动补记 cardCancelled（src/engine/reveal.js:285-299），上述旧路径现在也能触发本反应；
// 回归用例见 tests/tcu-investigators.test.mjs 的本卡段。

import { investigatorSign } from './_shared.js'

const sign = investigatorSign('05004')

const beneathLimit = 5

export default {
  code: '05004',
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 2 },
    // 「每场游戏开始时，你的起始手牌中额外有一张黑暗洞察」（额外冒险设置）。
    openingHandExtra: ['05014'],
  },
  elderSign: {
    id: '05004-eldersign',
    label: '旧印：+2，可把底下的一张卡牌加入手牌',
    resolve: ({ inv, api }) => {
      const bonus = Number(sign.bonus ?? 2)
      const beneath = inv.beneath || []
      if (!beneath.length) return { delta: bonus }
      const answer = api.choice({
        kind: 'beneath', source: 'dianaElderSign', seat: inv.seat, canSkip: true,
        prompt: '旧印：是否把黛安娜底下的一张卡牌加入手牌？',
        options: [{ id: 'skip', label: '不加入' },
          ...beneath.map((code, index) => ({ id: String(index), cardCode: code, label: api.cardName(code) }))],
      })
      if (answer === 'skip') return { delta: bonus }
      const index = Number(answer)
      if (Number.isInteger(index) && index >= 0 && index < beneath.length) {
        // 先取出所选卡号再 splice：旧实现先 `inv.beneath.splice(index, 1)` 再读
        // `beneath[index]`，会把「所选卡牌的下一张」加入手牌（选最后一张时是 undefined）。
        // 审计第三轮（reaudit-h）修复；回归用例见 tests/tcu-investigators.test.mjs 旧印段。
        const [cardCode] = inv.beneath.splice(index, 1)
        inv.hand.push(cardCode)
        api.info(`${inv.name} 把「${api.cardName(cardCode)}」加入手牌。`)
      }
      return { delta: bonus }
    },
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'cardCancelled',
      id: 'dianaBeneathCancelledCard',
      label: '取消效果后：把那张卡压在黛安娜底下，抽 1 张并获得 1 资源',
      limit: 'oncePerPhase',
      criteria: [({ inv, state, context }) => context?.cardSeat === inv.seat
        && typeof context?.cardCode === 'string'
        // 05013 银暮匕首：「以此方式打出/投入卡牌时，你不能触发黛安娜的[reaction]能力」。
        // 引擎在 beneath 通道打出/投入结算期间置 state._playedFromBeneath（dispatch.js:444-448）。
        && !(state?._playedFromBeneath && state._playedFromBeneath.seat === inv.seat)
        && (inv.beneath || []).length < beneathLimit],
      resolve: ({ state, inv, api, context }) => {
        const code = context.cardCode
        // 取消方可能是场上的支援（直接离场进弃牌堆），也可能是刚打出的事件/技能
        // （它们要等自己的结算走完才进弃牌堆）——两种都汇到 executeDescriptor 的延后搬运里。
        const asset = (inv.assets || []).find(item => item.code === code)
        if (asset) api.discardAsset(inv.seat, asset)
        inv.beneath ||= []
        api.deferCardBeneath(inv.seat, code)
        api.drawCards(inv.seat, 1)
        api.gainResources(inv.seat, 1)
        api.info(`${inv.name} 把「${api.cardName(code)}」压在黛安娜·史丹利底下。`)
      },
    },
  ],
  modifiers: [
    // 底下每有一张卡牌 +1[willpower]（读点：statPipeline 的声明式修正管线）。
    {
      target: 'skill:willpower',
      amount: ({ controller }) => (controller?.beneath || []).length,
    },
  ],
}
