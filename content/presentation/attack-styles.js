// 攻击动画风格（第 125 轮，第 8 批）。
//
// 原先这张表写死在 `src/integration/attack-style.js` 的 `CARD_OVERRIDES` 里。
// 判定顺序仍是：本表（按卡号）→ 特质分类（firearm / melee+刀刃名）→ 'default'，
// 只是卡号这一段由内容层声明，前端只读结果。

export const ATTACK_STYLE_OVERRIDES = Object.freeze({
  '02301': 'lightning', // Lightning Gun
  '04305': 'default', // Flamethrower
  '09119': 'default', // Hyperphysical Shotcaster
  '04276': 'blade', // Timeworn Brand
  '11115': 'blade', // Storm Ruler
  '12086': 'blade', // Broken Bottle
  '09005': 'blade', // Bonesaw
})
