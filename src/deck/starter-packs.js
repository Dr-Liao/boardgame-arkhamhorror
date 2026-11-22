// The starting deck, signature dependencies and draft availability share this release list.
// 批次 1：nat/har/win/jac/ste 五个入门包；批次 3：tom/car/and/mar/mig 五个入门包。
// 跨包重印号不在这里（由 src/cards/entries/_reprint-aliases.js 归并到 canonical）。
const released = [{
  investigator: '60101',
  signatures: Object.freeze(['60102', '60103']),
  basicWeakness: '60104',
  playerCards: Object.freeze([
    '60105', '60106', '60107', '60109', '60110', '60111', '60112', '60114', '60115', '60116',
    '60117', '60118', '60120', '60121', '60122', '60123', '60124', '60125', '60126', '60127',
    '60128', '60129', '60130', '60131', '60132',
  ]),
}, {
  investigator: '60201',
  signatures: Object.freeze(['60202', '60203']),
  basicWeakness: '60204',
  playerCards: Object.freeze([
    '60205', '60206', '60207', '60208', '60209', '60210', '60211', '60213', '60214', '60215',
    '60216', '60217', '60220', '60221', '60222', '60223', '60224', '60225', '60226', '60227',
    '60228', '60229', '60230', '60231', '60232', '60233',
  ]),
}, {
  investigator: '60301',
  signatures: Object.freeze(['60302', '60303']),
  basicWeakness: '60304',
  playerCards: Object.freeze([
    '60305', '60306', '60309', '60310', '60311', '60315', '60316', '60317', '60318', '60320',
    '60321', '60322', '60323', '60324', '60325', '60326', '60327', '60328', '60329', '60330',
    '60331', '60332',
  ]),
}, {
  investigator: '60401',
  signatures: Object.freeze(['60402', '60403']),
  basicWeakness: '60404',
  playerCards: Object.freeze([
    '60406', '60407', '60408', '60409', '60410', '60411', '60412', '60415', '60416', '60419',
    '60420', '60421', '60422', '60423', '60424', '60425', '60426', '60427', '60428', '60429',
    '60430', '60431', '60432',
  ]),
}, {
  investigator: '60501',
  signatures: Object.freeze(['60502', '60503']),
  basicWeakness: '60504',
  playerCards: Object.freeze([
    '60505', '60506', '60507', '60508', '60509', '60511', '60512', '60513', '60515', '60520',
    '60521', '60522', '60523', '60524', '60525', '60526', '60527', '60528', '60529', '60530',
    '60531',
  ]),
}, {
  // 批次 3：Tommy Muldoon（tom）。60155/60169/60176 为跨包重印号。
  investigator: '60151',
  signatures: Object.freeze(['60152', '60153']),
  basicWeakness: '60154',
  playerCards: Object.freeze([
    '60156', '60157', '60158', '60159', '60160', '60161', '60162', '60163', '60164', '60165',
    '60166', '60167', '60168', '60170', '60171', '60172', '60173', '60174', '60175', '60177',
    '60178', '60179', '60180', '60181', '60182',
  ]),
}, {
  // 批次 3：Carolyn Fern（car）。
  investigator: '60251',
  signatures: Object.freeze(['60252', '60253']),
  basicWeakness: '60254',
  playerCards: Object.freeze([
    '60255', '60256', '60257', '60258', '60259', '60260', '60261', '60262', '60264', '60265',
    '60266', '60268', '60269', '60271', '60272', '60273', '60274', '60276', '60277', '60278',
    '60279', '60280', '60281', '60282',
  ]),
}, {
  // 批次 3：André Patel（and），四张签名/专属卡。
  investigator: '60351',
  signatures: Object.freeze(['60352', '60353', '60354', '60355']),
  basicWeakness: '60356',
  playerCards: Object.freeze([
    '60357', '60358', '60359', '60360', '60362', '60363', '60364', '60365', '60366', '60367',
    '60368', '60369', '60370', '60373', '60374', '60375', '60376', '60377', '60378', '60380',
    '60382', '60383',
  ]),
}, {
  // 批次 3：Marie Lambeau（mar）。
  investigator: '60451',
  signatures: Object.freeze(['60452', '60453']),
  basicWeakness: '60454',
  playerCards: Object.freeze([
    '60456', '60457', '60458', '60461', '60462', '60463', '60464', '60465', '60466', '60467',
    '60468', '60470', '60471', '60472', '60473', '60474', '60475', '60476', '60477', '60478',
    '60479', '60480', '60481', '60482', '60483',
  ]),
}, {
  // 批次 3：Miguel de la Cruz（mig）。
  investigator: '60551',
  signatures: Object.freeze(['60552', '60553']),
  basicWeakness: '60554',
  playerCards: Object.freeze([
    '60555', '60556', '60557', '60558', '60559', '60561', '60562', '60563', '60564', '60565',
    '60566', '60567', '60568', '60569', '60570', '60571', '60572', '60573', '60574', '60575',
    '60576', '60577', '60578', '60579', '60580', '60581', '60582',
  ]),
}]

const investigatorPacks = released.filter(pack => pack.investigator)
export const starterInvestigators = Object.freeze(investigatorPacks.map(pack => pack.investigator))
export const starterSignatures = Object.freeze(Object.fromEntries(investigatorPacks.map(
  pack => [pack.investigator, pack.signatures],
)))
export const starterWeaknesses = Object.freeze(investigatorPacks.map(pack => pack.basicWeakness))
export const starterPlayerCards = Object.freeze(released.flatMap(pack => pack.playerCards))

const byInvestigator = new Map(investigatorPacks.map(pack => [pack.investigator, pack]))
export const starterPlayerCardsFor = code => byInvestigator.get(code)?.playerCards || []
export const starterWeaknessFor = code => byInvestigator.get(code)?.basicWeakness
