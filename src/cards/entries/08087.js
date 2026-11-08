// 08087 狙击
// 卡面：你本回合下一个使用了[[远程]]或[[枪械]]支援的攻击行动期间，将你揭示的每个
//       [skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]标记视为「0」标记。本行动不会触发趁乱攻击。
//
// 读点：api.addEffect 的延迟效果 + 效果 abilities 参与窗口枚举（effect-state.js 的
// effectAbilitySources → ability-rules.js）；forced 在 tokenEffectWouldResolve 窗口用
// effect 数据体 cancelSymbolToken 取消符号标记效果。
//
// approximation:
//   1) 作用域是「本回合余下的检定」，而非精确限定「下一个使用远程/枪械支援的攻击行动」；
//   2) cancelSymbolToken 是既有最接近「符号标记视为 0」的读点（取消该标记的符号效果）；
//   3) 「本行动不会触发趁乱攻击」暂无延迟 noOpportunityAttack 读点，已提交请求 m2-3-08087。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08087',
  abilities: [
    { kind: 'played', label: '本回合攻击检定：符号标记视为 0',
      resolve: ({ inv, api }) => {
        api.addEffect({
          duration: 'endOfTurn',
          label: '狙击：攻击检定中符号标记视为 0',
          sourceCode: '08087',
          controllerSeat: inv.seat,
          abilities: [{ kind: 'forced', label: '攻击检定中符号标记视为 0', trigger: 'tokenEffectWouldResolve',
            effect: { type: 'cancelSymbolToken' } }],
          modifiers: [],
        })
      } },
  ],
  modifiers: [],
}
