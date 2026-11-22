// 12070 艾洛科斯的密契（Augur of Elokoss）
// 卡面：调查([intellect])。本次调查将你的[willpower]加入你的[intellect]。
//       如果你检定成功，发现你所在地点额外1个线索。
//       如果你检定成功，且本次检定期间揭示了带有符号的标记，你可以弃掉任意调查员威胁区域的一张
//       [[恐怖]]或[[巫术]]诡计。
//
// 读点：
//   · 事件「调查」→ countsAs:'investigate' + api.investigate（actions.js#runInvestigate 同一结算）；
//   · 「把意志加入智力」→ opts.addSkill:'willpower'（06117/03031 同一读点）；
//   · 「成功额外 1 线索」→ opts.clueBonus:1（runInvestigate 的既有读点）；
//   · 「成功且揭示符号」→ onInvestigateSuccess 的成功回调参数 r.drawn（检定结果的标准形状）+
//     api.removeThreat 弃掉威胁区的恐怖/巫术诡计（08009/03191 同一入口）。
import { ALL_CARDS } from '../cards-data.js'

const CODE = '12070'
const SYMBOLS = ['skull', 'cultist', 'tablet', 'elderthing', 'autofail']

function isTerrorOrHex(code) {
  const def = ALL_CARDS[code]
  return Boolean(def) && (def.traits || []).some(trait => ['terror', 'hex'].includes(String(trait).toLowerCase()))
}

export default {
  code: CODE,
  abilities: [
    {
      kind: 'played',
      countsAs: 'investigate',
      label: '调查：加入意志；成功额外发现 1 线索；成功且揭示符号时可弃掉威胁区的恐怖/巫术诡计',
      resolve: ({ state, inv, api }) => {
        api.investigate(inv.seat, {
          addSkill: 'willpower',
          clueBonus: 1,
          onInvestigateSuccess: result => {
            const drawn = result?.drawn || []
            if (!drawn.some(token => SYMBOLS.includes(token))) return
            const threats = []
            for (const owner of state.investigators) {
              for (const threat of owner.threat || []) {
                if (isTerrorOrHex(threat.code)) threats.push({ owner, threat })
              }
            }
            if (!threats.length) return
            const answer = api.choice({
              kind: 'target', source: CODE, seat: inv.seat, canSkip: true,
              prompt: '本次检定揭示了符号标记：是否弃掉威胁区的一张[[恐怖]]或[[巫术]]诡计？',
              options: [
                { id: 'skip', label: '不弃掉' },
                ...threats.map((entry, index) => ({ id: String(index),
                  label: `${entry.owner.name}：${api.cardName(entry.threat.code)}` })),
              ],
            })
            if (answer === 'skip') return
            const picked = threats[Number(answer)]
            if (!picked) return
            api.removeThreat(picked.threat)
            api.info(`🔮「艾洛科斯的密契」：弃掉「${api.cardName(picked.threat.code)}」。`)
          },
        })
      },
    },
  ],
  modifiers: [],
}
