// 05006 玛丽·朗博
// 卡面：你控制的卡牌上有至少1个毁灭标记时，你可以在自己的回合期间进行一个额外行动，
//       但该额外行动只能用于打出[[法术]]卡牌或激活[[法术]][action]能力。
// 卡面：[elder_sign]效果：+1。你可以在你控制的一张卡牌上增加或移除1个毁灭标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 额外行动的授权、校验与扣费都在引擎的 src/engine/spell-actions.js（与「探索专用额外行动」同构）；
// 这里只声明门槛（至少 1 个毁灭标记）与旧印的增减毁灭。

import { investigatorSign } from './_shared.js'

const sign = investigatorSign('05006')

export default {
  code: '05006',
  kind: 'investigator',
  investigator: {
    spellActionCredit: { doomAtLeast: 1 },
    elderSign: { bonus: 1 },
  },
  elderSign: {
    id: '05006-eldersign',
    label: '旧印：+1，可在你控制的一张卡牌上增加或移除 1 个毁灭标记',
    resolve: ({ inv, api }) => {
      const bonus = Number(sign.bonus ?? 1)
      const controlled = [...(inv.assets || []), ...(inv.threat || [])]
      const addable = controlled.map(card => ({ card, label: api.cardName(card.code) }))
      const removable = addable.filter(item => (item.card.doom || 0) > 0)
      const options = [
        { id: 'skip', label: '不改变毁灭标记' },
        ...addable.map((item, index) => ({ id: `add:${index}`, label: `在「${item.label}」上放 1 个毁灭` })),
        ...removable.map((item, index) => ({ id: `remove:${index}`, label: `从「${item.label}」移除 1 个毁灭` })),
      ]
      if (options.length === 1) return { delta: bonus }
      const answer = api.choice({
        kind: 'effect', source: 'marieElderSign', seat: inv.seat,
        prompt: '旧印：是否在你控制的一张卡牌上增加或移除 1 个毁灭标记？',
        options,
      })
      if (answer === 'skip') return { delta: bonus }
      const [verb, rawIndex] = String(answer).split(':')
      if (verb === 'add') {
        const item = addable[Number(rawIndex)]
        if (item) api.placeDoomOnCard(item.card, 1)
      } else if (verb === 'remove') {
        const item = removable[Number(rawIndex)]
        if (item) {
          item.card.doom = Math.max(0, (item.card.doom || 0) - 1)
          api.info(`${inv.name} 从「${item.label}」移除 1 个毁灭标记。`)
        }
      }
      return { delta: bonus }
    },
  },
  abilities: [],
  modifiers: [],
}
