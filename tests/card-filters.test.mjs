import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cardSource, filterCards } from '../web/card-filters.js'
import { packLabel } from '../web/pack-label.js'
import { setLocale } from '../web/i18n.js'
import { queryCatalogView } from '../src/cards/card-catalog.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
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
