// 02004 吉姆·卡尔弗
// 卡面：将你揭示的[skull]标记的修正值视为“0”。
// 卡面：你每次揭示[elder_sign]标记，你可以选择改为将其视作[skull]标记。
// 卡面：[elder_sign]效果：+1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 吉姆·卡尔弗：旧印 +1；可以视为骷髅（修正为 0）。

import { investigatorSign } from './_shared.js'

const factory = () => {
    const es = investigatorSign('02004')
    return ({ inv, api }) => {
      const answer = api.choice({ kind: 'reaction', source: 'jimElderSign', seat: inv.seat,
        prompt: '旧印：是否视为骷髅？',
        options: [{ id: 'skip', label: '保留 +1' }, { id: 'skull', label: '视为骷髅（修正为 0）' }] })
      return { delta: answer === 'skull' ? 0 : (es.bonus || 1), asSkull: answer === 'skull' }
    }
  }

export default {
  code: '02004',
  investigator:   {
    "elderSign": {
      "kind": "jim",
      "bonus": 1
    },
    "tokenModifiers": {
      "skull": 0
    }
  },
  kind: 'investigator',
  elderSign: { id: '02004-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
