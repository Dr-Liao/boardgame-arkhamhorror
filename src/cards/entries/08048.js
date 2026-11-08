// 08048 21点
// 卡面：依次随机揭示任意个混乱标记，直到你自己选择停下。[skull]、[cultist]、[tablet] 或
//       [elder_thing] 视作 5；[auto_fail] 视作 10；[elder_sign] 可视作 1 或 11。
//       如果这些标记的总和(忽视 +/-)是……
//       - ……18 或更少，获得 4 资源。
//       - ……19，获得 5 资源。
//       - ……20，获得 6 资源。
//       - ……21，获得 9 资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：逐枚 api.revealChaosTokens(1)；每枚后询问「继续 / 停下」。数值按绝对值相加
// （「忽视 +/-」），符号标记按卡面固定值，[elder_sign] 每枚询问 1 或 11；总和 22+ 没有奖励。
const SYMBOL_VALUES = Object.freeze({ skull: 5, cultist: 5, tablet: 5, elderthing: 5, autofail: 10 })
const SYMBOL_LABELS = Object.freeze({ skull: '[skull]', cultist: '[cultist]', tablet: '[tablet]', elderthing: '[elder_thing]', autofail: '[auto_fail]', eldersign: '[elder_sign]' })

const tokenValue = (face, api, inv) => {
  if (face === 'eldersign') {
    const answer = api.choice({
      kind: 'effect', source: '08048', seat: inv.seat,
      prompt: '21点：[elder_sign] 视作 1 还是 11？',
      options: [{ id: '1', label: '视作 1' }, { id: '11', label: '视作 11' }],
    })
    return answer === '11' ? 11 : 1
  }
  if (Object.hasOwn(SYMBOL_VALUES, face)) return SYMBOL_VALUES[face]
  const numeric = Number(face)
  return Number.isFinite(numeric) ? Math.abs(numeric) : 0
}

export default {
  code: '08048',
  abilities: [
    {
      kind: 'played',
      label: '依次揭示混乱标记直到停下，按总和获得资源（18 以下 4 / 19 5 / 20 6 / 21 9）',
      resolve: ({ inv, api }) => {
        const revealed = []
        let total = 0
        for (let guard = 0; guard < 100; guard++) {
          const answer = api.choice({
            kind: 'effect', source: '08048', seat: inv.seat,
            prompt: `21点：当前已揭示 ${revealed.length} 枚（总和 ${total}）。继续揭示，还是停下？`,
            options: [{ id: 'stop', label: '停下' }, { id: 'continue', label: '继续揭示' }],
          })
          if (answer !== 'continue') break
          const face = api.revealChaosTokens(1)[0]
          if (face == null) {
            api.info('21点：混乱袋里没有标记了。')
            break
          }
          const value = tokenValue(face, api, inv)
          revealed.push(face)
          total += value
          api.info(`21点：揭示 ${SYMBOL_LABELS[face] || api.tokenLabel(face)}（视作 ${value}），当前总和 ${total}。`)
        }
        if (!revealed.length) {
          api.info('21点：没有揭示任何混乱标记。')
          return
        }
        const reward = total >= 22 ? 0
          : total === 21 ? 9
            : total === 20 ? 6
              : total === 19 ? 5 : 4
        if (!reward) {
          api.info(`21点：总和 ${total} 没有奖励。`)
          return
        }
        api.gainResources(inv.seat, reward)
        api.info(`21点：总和 ${total}，获得 ${reward} 资源。`)
      },
    },
  ],
  modifiers: [],
}
