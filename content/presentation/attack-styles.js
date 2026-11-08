// 攻击动画风格（第 125 轮，第 8 批）。
//
// 原先这张表写死在 `src/integration/attack-style.js` 的 `CARD_OVERRIDES` 里。
// 判定顺序仍是：本表（按卡号）→ 特质分类（spell / firearm / melee+刀刃名）→ 'default'，
// 只是卡号这一段由内容层声明，前端只读结果。

export const ATTACK_STYLE_OVERRIDES = Object.freeze({
  '02301': 'lightning', // Lightning Gun
  '03153': 'spiritStorm', // Storm of Spirits
  '04305': 'flamethrower',
  '09119': 'default', // Hyperphysical Shotcaster
  '04276': 'ancientBlade',
  '11115': 'blade', // Storm Ruler
  '12086': 'blade', // Broken Bottle
  '09005': 'blade', // Bonesaw
  '04266': 'bloodEclipse', '06201': 'spectralBlade',
  '05013': 'twilightBlade', '07302': 'holySpear',
  '02014': 'hound', '02115': 'flare', '02263': 'acid', '04204': 'bow',
  '05117': 'bottle', '05190': 'bottle', '05191': 'bottle',
  '06280': 'garrote', '06282': 'spectralHound', '07014': 'harpoon',
  '02112': 'deathSong', '04310': 'voidSpell',
  '05118': 'enchantedBlade', '05192': 'enchantedBlade', '05193': 'enchantedBlade',
  '06018': 'bloodBlade', '07153': 'holyStrike', '07159': 'abyssalTome', '07193': 'transformation',
})
