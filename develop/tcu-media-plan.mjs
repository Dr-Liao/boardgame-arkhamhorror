export const mediaPlan = [
  ['disappearanceAtTheTwilightEstate', '暮色庄园失踪事件', '庄园晚宴、失踪者、暮色疑云', ['Vanishing', 'Evening Fall (Piano)', 'This House']],
  ['theWitchingHour', '巫异时刻', '林间迷途、女巫集会、命运占卜', ['Baba Yaga', 'Myst on the Moor', 'Spellbound']],
  ['atDeathsDoorstep', '死亡门前', '幽灵庄园、现实翻面、看守人追猎', ['SCP-x5x (Outer Thoughts)', 'Ossuary 4 - Animate', 'Phantasm']],
  ['theSecretName', '隐秘之名', '女巫旧屋、异次元走廊、黑书秘密', ['Metaphysik', 'Crypto', 'Inner Sanctum']],
  ['theWagesOfSin', '恶罪报应', '绞刑山墓地、异端幽魂、未了之事', ['Ossuary 5 - Rest', 'Anguish', 'Land of the Dead']],
  ['forTheGreaterGood', '崇高利益', '秘社调查、机关钥匙、内殿阴谋', ['Hidden Past', 'Hidden Wonders', 'Mystic Force']],
  ['unionAndDisillusion', '聚合幻灭', '荒岛火盆、阵法仪式、阵营对峙', ['Shadowlands 1 - Horizon', 'Shadowlands 2 - Bridge', 'Final Battle of the Dark Wizards']],
  ['inTheClutchesOfChaos', '混沌魔掌', '阿卡姆裂口、连锁入侵、危机升级', ['The Escalation', 'Darkling', 'Volatile Reaction']],
  ['beforeTheBlackThrone', '黑色王座', '宇宙漂流、虚空吞噬、终末倒计时', ['Ossuary 3 - Words', 'Symmetry', 'Shadowlands 6 - The Pit']],
]
export const slug = title => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const trackId = title => 'tcu' + slug(title).split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('')
