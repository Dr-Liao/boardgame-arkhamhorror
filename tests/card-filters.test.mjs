import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cardSource, filterCards, minorInvestigatorPackSet, OTHER_INVESTIGATOR_PACK } from '../web/card-filters.js'
import { investigatorPlaySignature, parallelVariantCodes, reprintDuplicateCodes } from '../web/investigator-versions.js'
import { packLabel } from '../web/pack-label.js'
import { setLocale } from '../web/i18n.js'
import { getCatalogMeta, queryCatalogView } from '../src/cards/card-catalog.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { deckBuilderData } from '../src/deck/deckbuilding.js'
const cards=[
  {code:'a',name:'基础工具',type:'asset',klass:'guardian',cost:0,pack:'core',traitsZh:['工具']},
  {code:'b',name:'扩展工具',type:'asset',klass:'seeker',faction2:'guardian',cost:4,pack:'dwl',traitsZh:['工具']},
  {code:'c',name:'博物馆事件',type:'event',klass:'seeker',cost:2,pack:'tmm'},
  {code:'d',name:'未来卡',type:'skill',cost:null,pack:'future',packName:'未来扩展'},
  {code:'e',name:'卡尔克萨卡牌',type:'skill',cost:1,pack:'ptc',packName:'The Path to Carcosa'},
]
test('按战役合并后续小包，保留精确扩展筛选并支持未知扩展',()=>{
  assert.equal(cardSource(cards[1]).id,cardSource(cards[2]).id)
  assert.deepEqual(filterCards(cards,{campaign:'dwl'}).map(c=>c.code),['b','c'])
  assert.deepEqual(filterCards(cards,{campaign:'dwl',pack:'tmm'}).map(c=>c.code),['c'])
  assert.deepEqual(filterCards(cards,{campaign:'future'}).map(c=>c.code),['d'])
  assert.equal(cardSource(cards[3]).name,'未来扩展')
  assert.equal(cardSource(cards[1]).packName,'敦威治遗产')
  assert.equal(cardSource(cards[4]).packName,'卡尔克萨之路')
  // 缺来源元数据的卡（如卡表里拿不到 pack 的核心升级卡）带 unknown 哨兵：
  // 空串会与「所有战役 / 系列」「所有扩展包」占位选项撞 value，把占位文案顶成「未标注来源」。
  const missing = cardSource({ code: '01040', name: '缺来源升级卡', type: 'asset' })
  assert.equal(missing.pack, 'unknown')
  assert.equal(missing.id, 'unknown')
  assert.equal(missing.name, '未标注来源')
  assert.equal(missing.packName, '未标注来源')
})
test('共用筛选取交集，支持中文特性、多职业、零费用及清除恢复',()=>{
  assert.deepEqual(filterCards(cards,{campaign:'dwl',klass:'guardian',type:'asset',cost:'4+',search:'工具'}).map(c=>c.code),['b'])
  assert.deepEqual(filterCards(cards,{cost:'0'}).map(c=>c.code),['a'])
  assert.deepEqual(filterCards(cards,{pack:'core',type:'skill'}),[])
  assert.deepEqual(filterCards(cards,{}),cards)
  assert.deepEqual(filterCards(cards.slice(0,3),{sort:'cost'}).map(c=>c.code),['a','c','b'])
})

test('调查员选择的扩展包署名不泄漏英文产品名（地球边缘调查员包回归）', () => {
  const englishTitle = 'Edge of the Earth Investigator Expansion'
  // 核心包走档案口径；其余循环复用卡牌筛选的系列表。
  assert.equal(packLabel('core', 'Core Set'), '核心包')
  assert.equal(packLabel('dwl', 'The Dunwich Legacy'), '敦威治遗产')
  // 调查员包与战役包分开编号（eoep/eoec）时，卡牌数据只有英文产品名，署名必须回落到系列中文名。
  assert.equal(packLabel('eoep', englishTitle), '地球边缘')
  assert.equal(packLabel('eoec', 'Edge of the Earth Campaign Expansion'), '地球边缘')
  // 未知扩展仍使用调用方给的名字；无名字时回退包代码。
  assert.equal(packLabel('future', '未来扩展'), '未来扩展')
  assert.equal(packLabel('future'), 'future')
  assert.equal(packLabel(''), '调查员')
  // 英文界面下同一扩展包显示英文系列名，不再是完整产品名（与其余循环的分组标题口径一致）。
  try {
    setLocale('en')
    assert.equal(packLabel('eoep', englishTitle), 'Edge of the Earth')
    assert.equal(packLabel('core', 'Core Set'), 'Core Set')
  } finally {
    setLocale('zh-CN')
  }
})

test('经验等级筛选保留零级，排除无经验字段并支持五级以上',()=>{
  const pool=[{code:'zero',xp:0},{code:'two',xp:2},{code:'five',xp:5},{code:'six',xp:6},{code:'none',xp:null},{code:'missing'}]
  assert.deepEqual(filterCards(pool,{xp:'0'}).map(c=>c.code),['zero'])
  assert.deepEqual(filterCards(pool,{xp:'2'}).map(c=>c.code),['two'])
  assert.deepEqual(filterCards(pool,{xp:'5+'}).map(c=>c.code),['five','six'])
  assert.equal(filterCards(pool,{}).length,6)
})

test('图鉴与构筑使用相同组合筛选，在分页前筛选并排序完整卡池',()=>{
  const filters={xp:'2',campaign:'core',klass:'guardian',cost:'4+',sort:'name'}
  const expected=filterCards(Object.values(ALL_CARDS),filters)
  assert.ok(expected.length)
  const result=queryCatalogView({...filters,limit:1,offset:1})
  assert.equal(result.total,expected.length)
  assert.deepEqual(result.cards.map(c=>c.code),expected.slice(1,2).map(c=>c.code))
  assert.ok(queryCatalogView({type:'location',limit:1}).total>100)
  assert.equal(queryCatalogView({type:'location',xp:'0'}).total,0)
})

// 只提供 1–2 位可选调查员的产品（调查员起始包、单调查员剧本包……）合并成「其他调查员」。
// 人数口径按「每位可选调查员属于哪个扩展包」推导；0 位调查员的剧本包不算「调查员包」，保持独立。
test('小调查员包按 ≤2 人合并成「其他调查员」分类，大循环与纯剧本包不合并', () => {
  const minor = minorInvestigatorPackSet(['core', 'core', 'core', 'nat', 'dwl', 'dwl', 'dwl', 'dre', 'blbe'])
  assert.deepEqual([...minor].sort(), ['blbe', 'dre', 'nat'])
  const metaMinor = getCatalogMeta().minorInvestigatorPacks
  for (const pack of ['nat', 'har', 'win', 'ste', 'dre', 'promo', 'blbe']) assert.ok(metaMinor.includes(pack), pack)
  for (const pack of ['core', 'dwl', 'ptc', 'tfa', 'tcu', 'tde', 'tic', 'eoep', 'tskp', 'fhvp', 'tdcp', 'core_2026']) {
    assert.ok(!metaMinor.includes(pack), pack + ' 是大循环，不应合并')
  }
  // 0 位可选调查员的剧本包（Carnevale of Horrors 等）不属于「调查员包」。
  for (const pack of ['coh', 'cotr', 'blob', 'hotel']) assert.ok(!metaMinor.includes(pack), pack)
})

test('卡牌筛选把合并包归入「其他调查员」，战役与扩展包两个下拉都能筛', () => {
  const minorPacks = minorInvestigatorPackSet(['core', 'core', 'core', 'dwl', 'dwl', 'dwl', 'nat', 'dre'])
  const pool = [
    { code: 'x1', name: '起始包卡', type: 'asset', pack: 'nat' },
    { code: 'x2', name: '启示卡', type: 'asset', pack: 'dre' },
    { code: 'x3', name: '核心卡', type: 'asset', pack: 'core' },
  ]
  const other = cardSource(pool[0], minorPacks)
  assert.equal(other.id, OTHER_INVESTIGATOR_PACK)
  assert.equal(other.pack, OTHER_INVESTIGATOR_PACK)
  assert.equal(other.name, '其他调查员')
  assert.equal(other.packName, '其他调查员')
  assert.deepEqual(filterCards(pool, { campaign: OTHER_INVESTIGATOR_PACK }, { minorPacks }).map(card => card.code), ['x1', 'x2'])
  assert.deepEqual(filterCards(pool, { pack: OTHER_INVESTIGATOR_PACK }, { minorPacks }).map(card => card.code), ['x1', 'x2'])
  assert.deepEqual(filterCards(pool, { campaign: 'core' }, { minorPacks }).map(card => card.code), ['x3'])
  // 不传合并集合时保持旧的逐包口径，服务端未接入口的调用方不受影响。
  assert.equal(cardSource(pool[0]).pack, 'nat')
  // 选人页署名同样使用「其他调查员」，不再泄漏英文产品名。
  assert.equal(packLabel('nat', 'Nathaniel Cho', minorPacks), '其他调查员')
  assert.equal(packLabel('core', 'Core Set', minorPacks), '核心包')
})

test('目录 API 的「其他调查员」筛选与图鉴列表口径一致', () => {
  const minorPacks = getCatalogMeta().minorInvestigatorPacks
  const expected = filterCards(Object.values(ALL_CARDS), { campaign: OTHER_INVESTIGATOR_PACK }, { minorPacks })
    .map(card => card.code).sort()
  assert.ok(expected.length > 0)
  const byCampaign = queryCatalogView({ campaign: OTHER_INVESTIGATOR_PACK, limit: 200 })
  assert.equal(byCampaign.total, expected.length)
  assert.deepEqual(byCampaign.cards.map(card => card.code), expected.slice(0, 200))
  // 扩展包筛选（packCode）走同一条合并口径。
  assert.equal(queryCatalogView({ packCode: OTHER_INVESTIGATOR_PACK, limit: 1 }).total, expected.length)
  // 大循环筛选不受影响。
  assert.ok(queryCatalogView({ campaign: 'core', limit: 1 }).total > 0)
  assert.equal(queryCatalogView({ campaign: OTHER_INVESTIGATOR_PACK, packCode: 'core' }).total, 0)
})

// 选人页：同名卡分「复刻」（规则/签名完全一致）与「平行版」（同名不同规则）。
test('同名复刻只保留主循环版本，平行版保留并参与标注', () => {
  const investigators = deckBuilderData().investigators
  const minorPacks = minorInvestigatorPackSet(investigators.map(inv => inv.pack || 'core'))
  const hidden = reprintDuplicateCodes(investigators, minorPacks)
  // 复刻：核心包 98004（与 01001 完全相同）、Jenny/Carolyn/Silas/Dexter/Marie 的小说或促销复刻。
  for (const code of ['98004', '98001', '98010', '98013', '98016', '99001']) assert.ok(hidden.has(code), code + ' 应作为复刻隐藏')
  // 主循环版本与「同名不同规则」的平行版都不能被隐藏。
  for (const code of ['01001', '02003', '05001', '07004', '07005', '05006', '90024', '90001', '90008', '98019']) {
    assert.ok(!hidden.has(code), code + ' 不应被隐藏')
  }
  // 平行版：核心罗兰与 By the Book 平行罗兰规则指纹不同（Directive 机制）。
  const roland = investigators.find(inv => inv.code === '01001')
  const parallelRoland = investigators.find(inv => inv.code === '90024')
  assert.notEqual(investigatorPlaySignature(roland), investigatorPlaySignature(parallelRoland))
  const visible = investigators.filter(inv => !hidden.has(inv.code))
  const variants = parallelVariantCodes(visible)
  assert.ok(variants.has('90024'), '平行罗兰应被标为平行版')
  assert.ok(variants.has('90001'), '平行黛西应被标为平行版')
  assert.ok(!variants.has('98004'), '被隐藏的复刻不参与平行版标注')
  // 候选列表只有单一版本时（小战役只允许某个复刻卡）不做任何隐藏。
  assert.equal(reprintDuplicateCodes([investigators.find(inv => inv.code === '98001')], minorPacks).size, 0)
})
