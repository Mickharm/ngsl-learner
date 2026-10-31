/**
 * Word Parts — 字首、字尾、字根.
 *
 * Why this exists: a beginner meets `achievement`, `unemployment` and
 * `transport` as three unrelated strings to memorise. They are not. Every one
 * of them is a word the learner already half-knows plus a part that means
 * the same thing in hundreds of other words. Morphology instruction is one of
 * the better-supported interventions there is — Goodwin & Ahn (2010, Annals
 * of Dyslexia) found d = 0.40 on vocabulary overall and d = 0.62 for English
 * learners — and US classrooms teach it as a standing strand ("word study"),
 * not a one-off lesson.
 *
 * Order follows the usual US sequence: compound words first (two words you
 * know), then the high-frequency suffixes (they decide part of speech, which
 * is also what TOEIC Part 5 tests), then the top prefixes — the 20 most
 * common account for almost all prefixed words, un- alone for about a quarter
 * (White, Sowell & Yanagihara 1989) — and Greek/Latin roots last.
 *
 * Authoring format, one example per array:
 *
 *   [word, parts, 中文, pos]
 *
 * `parts` is a `+`-separated list that must spell the word exactly:
 *
 *   happy          a base word (an NGSL headword, an inflected form of one,
 *                  or an entry in EXTRA_BASES)
 *   un-  -ness     a prefix / suffix id from PARTS
 *   ~port          a root id from PARTS
 *   text=ref       the letters as they appear in this word, then what they
 *                  are: `happi=happy`, `sion=-tion`, `miss=~mit`
 *   .e             a linking letter with no meaning of its own
 *
 * scripts/test-morphology.mjs checks every example spells its word, uses only
 * known parts, and that every base is a word the learner can look up.
 */

/** kind: prefix | suffix | root. `of` groups spelling variants for games. */
export const PARTS = {
  /* ---------- prefixes ---------- */
  'un-':    { kind: 'prefix', label: 'un-',    zh: '不、沒有',   more: '接在動詞前是「倒回去」：lock 鎖上 → unlock 解鎖' },
  'in-':    { kind: 'prefix', label: 'in-',    zh: '不',         more: '遇到 p/b/m 變 im-，遇到 l 變 il-，遇到 r 變 ir-' },
  'im-':    { kind: 'prefix', label: 'im-',    zh: '不',         of: 'in-' },
  'il-':    { kind: 'prefix', label: 'il-',    zh: '不',         of: 'in-' },
  'ir-':    { kind: 'prefix', label: 'ir-',    zh: '不',         of: 'in-' },
  'dis-':   { kind: 'prefix', label: 'dis-',   zh: '不、相反',   more: '也有「分開」的意思：connect 連接 → disconnect 斷開' },
  'non-':   { kind: 'prefix', label: 'non-',   zh: '非、無' },
  're-':    { kind: 'prefix', label: 're-',    zh: '再一次；往回' },
  'pre-':   { kind: 'prefix', label: 'pre-',   zh: '之前、預先' },
  'mis-':   { kind: 'prefix', label: 'mis-',   zh: '錯誤地' },
  'over-':  { kind: 'prefix', label: 'over-',  zh: '太多、過度' },
  'under-': { kind: 'prefix', label: 'under-', zh: '在下面' },
  'out-':   { kind: 'prefix', label: 'out-',   zh: '向外' },
  'in-2':   { kind: 'prefix', label: 'in-',    zh: '進去、在裡面', more: '和「不」的 in- 長得一樣，要看整個字判斷' },
  'im-2':   { kind: 'prefix', label: 'im-',    zh: '進去',       of: 'in-2' },
  'ex-':    { kind: 'prefix', label: 'ex-',    zh: '向外、出去' },
  'inter-': { kind: 'prefix', label: 'inter-', zh: '在…之間、互相' },
  'trans-': { kind: 'prefix', label: 'trans-', zh: '穿過、轉換' },
  'sub-':   { kind: 'prefix', label: 'sub-',   zh: '在下面' },
  'tele-':  { kind: 'prefix', label: 'tele-',  zh: '遠的' },
  'con-':   { kind: 'prefix', label: 'con-',   zh: '一起',       more: '也拼成 com-、co-' },
  'ad-':    { kind: 'prefix', label: 'ad-',    zh: '朝向、到',   more: '常配合後面的字母變形：at-tract、ac-cept' },
  'de-':    { kind: 'prefix', label: 'de-',    zh: '向下；去掉' },
  'pro-':   { kind: 'prefix', label: 'pro-',   zh: '向前' },
  'uni-':   { kind: 'prefix', label: 'uni-',   zh: '一' },
  'bi-':    { kind: 'prefix', label: 'bi-',    zh: '二' },
  'tri-':   { kind: 'prefix', label: 'tri-',   zh: '三' },
  'multi-': { kind: 'prefix', label: 'multi-', zh: '很多' },
  'semi-':  { kind: 'prefix', label: 'semi-',  zh: '一半' },
  'auto-':  { kind: 'prefix', label: 'auto-',  zh: '自己' },
  'micro-': { kind: 'prefix', label: 'micro-', zh: '很小的' },

  /* ---------- suffixes: people ---------- */
  '-er':   { kind: 'suffix', label: '-er',   zh: '做這件事的人／機器', pos: 'n.' },
  '-or':   { kind: 'suffix', label: '-or',   zh: '做這件事的人',       pos: 'n.' },
  '-ist':  { kind: 'suffix', label: '-ist',  zh: '專門做…的人',        pos: 'n.' },
  '-ian':  { kind: 'suffix', label: '-ian',  zh: '…的人',              pos: 'n.' },
  '-ant':  { kind: 'suffix', label: '-ant',  zh: '做這件事的人',       pos: 'n.' },
  '-ee':   { kind: 'suffix', label: '-ee',   zh: '被…的人',            pos: 'n.' },
  /* nouns */
  '-tion': { kind: 'suffix', label: '-tion / -sion', zh: '把動作變成名詞', pos: 'n.' },
  '-ment': { kind: 'suffix', label: '-ment', zh: '把動作變成名詞',     pos: 'n.' },
  '-ness': { kind: 'suffix', label: '-ness', zh: '…的狀態（名詞）',    pos: 'n.' },
  '-ity':  { kind: 'suffix', label: '-ity',  zh: '…的性質（名詞）',    pos: 'n.' },
  '-ance': { kind: 'suffix', label: '-ance / -ence', zh: '…的狀態、行為（名詞）', pos: 'n.' },
  '-ship': { kind: 'suffix', label: '-ship', zh: '身分、關係（名詞）', pos: 'n.' },
  '-hood': { kind: 'suffix', label: '-hood', zh: '時期、群體（名詞）', pos: 'n.' },
  '-ure':  { kind: 'suffix', label: '-ure',  zh: '動作的結果（名詞）', pos: 'n.' },
  /* adjectives */
  '-ful':  { kind: 'suffix', label: '-ful',  zh: '充滿…的',   pos: 'adj.' },
  '-less': { kind: 'suffix', label: '-less', zh: '沒有…的',   pos: 'adj.' },
  '-able': { kind: 'suffix', label: '-able / -ible', zh: '可以…的', pos: 'adj.' },
  '-ous':  { kind: 'suffix', label: '-ous',  zh: '有…性質的', pos: 'adj.' },
  '-al':   { kind: 'suffix', label: '-al',   zh: '和…有關的', pos: 'adj.' },
  '-ive':  { kind: 'suffix', label: '-ive',  zh: '有…傾向的', pos: 'adj.' },
  '-y':    { kind: 'suffix', label: '-y',    zh: '有…的',     pos: 'adj.' },
  '-ic':   { kind: 'suffix', label: '-ic',   zh: '…的',       pos: 'adj.' },
  /* verbs, adverbs */
  '-ize':  { kind: 'suffix', label: '-ize',  zh: '使…化',     pos: 'v.' },
  '-ify':  { kind: 'suffix', label: '-ify',  zh: '使變成…',   pos: 'v.' },
  '-en':   { kind: 'suffix', label: '-en',   zh: '使變得…',   pos: 'v.' },
  '-ly':   { kind: 'suffix', label: '-ly',   zh: '…地（副詞）', pos: 'adv.' },
  // the same letters on a noun make an adjective: friend → friendly 友善的
  '-ly2':  { kind: 'suffix', label: '-ly',   zh: '像…的；每…的（形容詞）', pos: 'adj.' },
  // and -al on a verb makes a noun: arrive → arrival 抵達
  '-al2':  { kind: 'suffix', label: '-al',   zh: '把動作變成名詞', pos: 'n.' },

  /* ---------- roots ---------- */
  '~port':   { kind: 'root', label: 'port',   zh: '搬、帶' },
  '~spect':  { kind: 'root', label: 'spect',  zh: '看' },
  '~vis':    { kind: 'root', label: 'vis',    zh: '看見' },
  '~aud':    { kind: 'root', label: 'aud',    zh: '聽' },
  '~dict':   { kind: 'root', label: 'dict',   zh: '說' },
  '~tract':  { kind: 'root', label: 'tract',  zh: '拉' },
  '~press':  { kind: 'root', label: 'press',  zh: '壓' },
  '~ject':   { kind: 'root', label: 'ject',   zh: '丟' },
  '~mit':    { kind: 'root', label: 'mit / miss', zh: '送' },
  '~struct': { kind: 'root', label: 'struct', zh: '建造' },
  '~graph':  { kind: 'root', label: 'graph',  zh: '寫、畫' },
  '~scrib':  { kind: 'root', label: 'scrib / script', zh: '寫' },
  '~vent':   { kind: 'root', label: 'vent',   zh: '來' },
  '~fer':    { kind: 'root', label: 'fer',    zh: '帶' },
  '~scope':  { kind: 'root', label: 'scope',  zh: '看的工具' },
  '~photo':  { kind: 'root', label: 'photo',  zh: '光' }
}

/** Bases used in examples that are not NGSL headwords, with their meaning. */
export const EXTRA_BASES = {
  noon: '中午', polite: '有禮貌的', fame: '名聲', media: '媒體'
}

/**
 * Meanings for every base an example uses. Bundled so a word part reads in
 * full before the word has been enriched — the point of the unit is that the
 * learner already knows (or can learn) the base.
 */
export const BASE_ZH = {
  ...EXTRA_BASES,
  week: '週', end: '結束', news: '新聞', paper: '紙', foot: '腳', ball: '球', back: '後面',
  ground: '地面', after: '之後', bed: '床', room: '房間', birth: '出生', day: '天', home: '家',
  work: '工作', class: '班級；課', air: '空氣', port: '港口', sun: '太陽', light: '光',
  pass: '通過', word: '字', note: '筆記', book: '書', key: '鑰匙；按鍵', board: '板子',
  team: '團隊', net: '網子', every: '每個', one: '一個', some: '某些', thing: '東西',
  out: '外面', side: '邊', in: '裡面',
  teach: '教', play: '玩；比賽', drive: '開車', write: '寫', manage: '管理', employ: '雇用',
  visit: '拜訪', act: '行動；演戲', direct: '指揮、指導', art: '藝術', science: '科學',
  tour: '旅遊', music: '音樂', assist: '協助', consult: '請教', print: '列印', compute: '計算',
  collect: '收集', protect: '保護', inform: '通知', educate: '教育', decide: '決定',
  invite: '邀請', pay: '付錢', move: '移動', agree: '同意', develop: '發展', improve: '改善',
  achieve: '達成', govern: '治理',
  happy: '快樂的', kind: '善良的', dark: '暗的', ill: '生病的', weak: '虛弱的', able: '能夠的',
  real: '真的', major: '主要的', secure: '安全的', appear: '出現', differ: '不同', exist: '存在',
  friend: '朋友', leader: '領導者', member: '成員', child: '小孩', neighbor: '鄰居',
  care: '在乎；小心', use: '使用', help: '幫助', power: '力量', success: '成功', wonder: '驚奇',
  harm: '傷害', beauty: '美', regard: '看待', comfort: '舒適', reason: '道理',
  accept: '接受', value: '價值', rely: '依靠', response: '回應', danger: '危險',
  continue: '繼續', health: '健康', wealth: '財富', rain: '雨', wind: '風', luck: '運氣',
  nature: '自然', person: '人', culture: '文化', nation: '國家', tradition: '傳統',
  effect: '效果', create: '創造', attract: '吸引', expense: '費用', economy: '經濟',
  history: '歷史', modern: '現代的', special: '特別的', critic: '評論家', simple: '簡單的',
  just: '公正的', strength: '力量', short: '短的', wide: '寬的', threat: '威脅',
  quick: '快的', slow: '慢的', clear: '清楚的', easy: '容易的', careful: '小心的',
  usual: '平常的', fair: '公平的', known: '已知的', lock: '鎖', pack: '打包', correct: '正確的',
  possible: '可能的', legal: '合法的', regular: '規則的', like: '喜歡', honest: '誠實的',
  stop: '停', sense: '感覺；意義', likely: '可能的', do: '做', build: '蓋', turn: '轉',
  place: '放；地方', view: '看；景色', school: '學校', test: '測驗', take: '拿',
  understand: '了解', lead: '帶領', eat: '吃', sleep: '睡', weight: '重量', water: '水',
  line: '線', door: '門', put: '放', come: '來', change: '改變', national: '國家的',
  title: '標題', way: '路', vision: '視力', phone: '電話', form: '形狀', cycle: '循環；腳踏車',
  weekly: '每週的', angle: '角度', final: '最後的；決賽', circle: '圓', action: '行動'
}

/**
 * The course. `hook` is the one sentence the unit wants remembered; `rules`
 * are the spelling changes the examples show; `traps` look like they contain
 * the part and do not — the classroom "prefix imposter" check, which stops
 * a learner from cutting `uncle` into un + cle.
 */
export const UNITS = [
  {
    id: 'p01',
    title: '合成字：兩個字黏成一個',
    hook: '很多長字是兩個你已經會的短字黏在一起。先找出你認識的那一半。',
    parts: [],
    ex: [
      ['weekend', 'week+end', '週末', 'n.'],
      ['newspaper', 'news+paper', '報紙', 'n.'],
      ['football', 'foot+ball', '足球', 'n.'],
      ['background', 'back+ground', '背景', 'n.'],
      ['afternoon', 'after+noon', '下午', 'n.'],
      ['bedroom', 'bed+room', '臥室', 'n.'],
      ['birthday', 'birth+day', '生日', 'n.'],
      ['homework', 'home+work', '回家作業', 'n.'],
      ['classroom', 'class+room', '教室', 'n.'],
      ['airport', 'air+port', '機場', 'n.'],
      ['sunlight', 'sun+light', '陽光', 'n.'],
      ['password', 'pass+word', '密碼', 'n.'],
      ['notebook', 'note+book', '筆記本', 'n.'],
      ['keyboard', 'key+board', '鍵盤', 'n.'],
      ['teamwork', 'team+work', '團隊合作', 'n.'],
      ['everyone', 'every+one', '每個人', 'pron.'],
      ['something', 'some+thing', '某件事', 'pron.'],
      ['outside', 'out+side', '外面', 'adv.']
    ],
    traps: [
      ['carpet', 'carpet 是「地毯」，跟 car（車）和 pet（寵物）無關。'],
      ['season', 'season 是「季節」，不是 sea + son。'],
      ['message', 'message 是「訊息」，不是 mess + age。']
    ]
  },
  {
    id: 'p02',
    title: '「人」的字尾：-er / -or / -ist',
    hook: '動詞後面加 -er 或 -or，就是「做這件事的人」。-ee 是被做的那一方。',
    parts: ['-er', '-or', '-ist', '-ian', '-ant', '-ee'],
    ex: [
      ['teacher', 'teach+-er', '老師', 'n.'],
      ['player', 'play+-er', '球員；玩家', 'n.'],
      ['driver', 'driv=drive+-er', '司機', 'n.'],
      ['writer', 'writ=write+-er', '作家', 'n.'],
      ['manager', 'manag=manage+-er', '經理', 'n.'],
      ['employer', 'employ+-er', '雇主（雇用人的人）', 'n.'],
      ['employee', 'employ+-ee', '員工（被雇用的人）', 'n.'],
      ['visitor', 'visit+-or', '訪客', 'n.'],
      ['actor', 'act+-or', '演員', 'n.'],
      ['director', 'direct+-or', '導演；主管', 'n.'],
      ['artist', 'art+-ist', '藝術家', 'n.'],
      ['scientist', 'scient=science+-ist', '科學家', 'n.'],
      ['tourist', 'tour+-ist', '觀光客', 'n.'],
      ['musician', 'music+-ian', '音樂家', 'n.'],
      ['assistant', 'assist+-ant', '助理', 'n.'],
      ['consultant', 'consult+-ant', '顧問', 'n.'],
      ['printer', 'print+-er', '印表機', 'n.'],
      ['computer', 'comput=compute+-er', '電腦', 'n.']
    ],
    rules: ['字尾是 e 的動詞，加 -er 時去掉一個 e：drive → driver。', '-er 也可以是「機器」：print 列印 → printer 印表機。'],
    traps: [
      ['corner', 'corner 是「角落」，-er 不是字尾。'],
      ['water', 'water 本身就是一個字，沒有 wat 這個字。'],
      ['color', 'color 是「顏色」，-or 不是字尾。']
    ]
  },
  {
    id: 'p03',
    title: '名詞字尾：-tion / -ment',
    hook: '動詞加上 -tion 或 -ment 就變成名詞：decide 決定 → decision 一個決定。',
    parts: ['-tion', '-ment'],
    ex: [
      ['action', 'act+ion=-tion', '行動', 'n.'],
      ['collection', 'collect+ion=-tion', '收藏', 'n.'],
      ['protection', 'protect+ion=-tion', '保護', 'n.'],
      ['direction', 'direct+ion=-tion', '方向', 'n.'],
      ['information', 'inform+ation=-tion', '資訊', 'n.'],
      ['education', 'educat=educate+ion=-tion', '教育', 'n.'],
      ['decision', 'deci=decide+sion=-tion', '決定', 'n.'],
      ['invitation', 'invit=invite+ation=-tion', '邀請', 'n.'],
      ['payment', 'pay+-ment', '付款', 'n.'],
      ['movement', 'move+-ment', '動作；運動', 'n.'],
      ['agreement', 'agree+-ment', '協議', 'n.'],
      ['development', 'develop+-ment', '發展', 'n.'],
      ['improvement', 'improve+-ment', '改善', 'n.'],
      ['achievement', 'achieve+-ment', '成就', 'n.'],
      ['government', 'govern+-ment', '政府', 'n.']
    ],
    rules: ['字尾是 t 的動詞直接加 -ion：act → action。', '字尾是 de 的動詞常變成 -sion：decide → decision。'],
    traps: [['moment', 'moment 是「片刻」，沒有 mo 這個動詞。']]
  },
  {
    id: 'p04',
    title: '名詞字尾：-ness / -ity / -ship',
    hook: '形容詞加 -ness 或 -ity 變名詞：happy 快樂的 → happiness 快樂。',
    parts: ['-ness', '-ity', '-ance', '-ship', '-hood'],
    ex: [
      ['happiness', 'happi=happy+-ness', '快樂；幸福', 'n.'],
      ['kindness', 'kind+-ness', '善良', 'n.'],
      ['darkness', 'dark+-ness', '黑暗', 'n.'],
      ['illness', 'ill+-ness', '疾病', 'n.'],
      ['weakness', 'weak+-ness', '弱點', 'n.'],
      ['ability', 'abil=able+-ity', '能力', 'n.'],
      ['reality', 'real+-ity', '現實', 'n.'],
      ['majority', 'major+-ity', '大多數', 'n.'],
      ['security', 'secur=secure+-ity', '安全', 'n.'],
      ['appearance', 'appear+-ance', '外表；出現', 'n.'],
      ['difference', 'differ+ence=-ance', '差別', 'n.'],
      ['existence', 'exist+ence=-ance', '存在', 'n.'],
      ['friendship', 'friend+-ship', '友誼', 'n.'],
      ['leadership', 'leader+-ship', '領導能力', 'n.'],
      ['membership', 'member+-ship', '會員資格', 'n.'],
      ['childhood', 'child+-hood', '童年', 'n.'],
      ['neighborhood', 'neighbor+-hood', '社區', 'n.']
    ],
    rules: ['字尾 y 變 i 再加：happy → happiness。', '字尾 le 變 il 再加 -ity：able → ability。']
  },
  {
    id: 'p05',
    title: '形容詞字尾：-ful 有 / -less 沒有',
    hook: '-ful 是「充滿」，-less 是「沒有」。同一個字加兩種字尾，意思剛好相反。',
    parts: ['-ful', '-less'],
    ex: [
      ['careful', 'care+-ful', '小心的', 'adj.'],
      ['careless', 'care+-less', '粗心的', 'adj.'],
      ['useful', 'use+-ful', '有用的', 'adj.'],
      ['useless', 'use+-less', '沒用的', 'adj.'],
      ['helpful', 'help+-ful', '有幫助的', 'adj.'],
      ['helpless', 'help+-less', '無助的', 'adj.'],
      ['powerful', 'power+-ful', '強大的', 'adj.'],
      ['successful', 'success+-ful', '成功的', 'adj.'],
      ['wonderful', 'wonder+-ful', '很棒的', 'adj.'],
      ['beautiful', 'beauti=beauty+-ful', '美麗的', 'adj.'],
      ['homeless', 'home+-less', '無家可歸的', 'adj.'],
      ['endless', 'end+-less', '沒完沒了的', 'adj.'],
      ['harmless', 'harm+-less', '無害的', 'adj.']
    ],
    rules: ['-ful 只有一個 l：careful，不是 carefull。'],
    traps: [['unless', 'unless 是「除非」，不是「沒有 un」。']]
  },
  {
    id: 'p06',
    title: '形容詞字尾：-able / -ous / -y',
    hook: '-able 是「可以被…的」，-ous 和 -y 是「有…的」。',
    parts: ['-able', '-ous', '-y'],
    ex: [
      ['comfortable', 'comfort+-able', '舒服的', 'adj.'],
      ['reasonable', 'reason+-able', '合理的', 'adj.'],
      ['acceptable', 'accept+-able', '可以接受的', 'adj.'],
      ['valuable', 'valu=value+-able', '有價值的', 'adj.'],
      ['reliable', 'reli=rely+-able', '可靠的', 'adj.'],
      ['responsible', 'respons=response+ible=-able', '負責的', 'adj.'],
      ['dangerous', 'danger+-ous', '危險的', 'adj.'],
      ['famous', 'fam=fame+-ous', '有名的', 'adj.'],
      ['continuous', 'continu=continue+-ous', '連續的', 'adj.'],
      ['healthy', 'health+-y', '健康的', 'adj.'],
      ['wealthy', 'wealth+-y', '有錢的', 'adj.'],
      ['rainy', 'rain+-y', '下雨的', 'adj.'],
      ['windy', 'wind+-y', '颳風的', 'adj.'],
      ['lucky', 'luck+-y', '幸運的', 'adj.'],
      ['sunny', 'sun+ny=-y', '晴朗的', 'adj.']
    ],
    rules: ['短字最後是「母音＋子音」時，子音要重複：sun → sunny。'],
    traps: [
      ['table', 'table 是「桌子」，不是 t + able。'],
      ['city', 'city 的 y 不是字尾，沒有 cit 這個字。']
    ]
  },
  {
    id: 'p07',
    title: '形容詞字尾：-al / -ive / -ic',
    hook: '名詞加 -al 或 -ic 變成「和…有關的」：nation 國家 → national 國家的。',
    parts: ['-al', '-ive', '-ic'],
    ex: [
      ['natural', 'natur=nature+-al', '自然的', 'adj.'],
      ['personal', 'person+-al', '個人的', 'adj.'],
      ['cultural', 'cultur=culture+-al', '文化的', 'adj.'],
      ['musical', 'music+-al', '音樂的', 'adj.'],
      ['national', 'nation+-al', '國家的', 'adj.'],
      ['traditional', 'tradition+-al', '傳統的', 'adj.'],
      ['effective', 'effect+-ive', '有效的', 'adj.'],
      ['creative', 'creat=create+-ive', '有創意的', 'adj.'],
      ['active', 'act+-ive', '活躍的', 'adj.'],
      ['attractive', 'attract+-ive', '有吸引力的', 'adj.'],
      ['expensive', 'expens=expense+-ive', '昂貴的', 'adj.'],
      ['economic', 'econom=economy+-ic', '經濟的', 'adj.'],
      ['historic', 'histor=history+-ic', '有歷史意義的', 'adj.']
    ],
    traps: [
      ['animal', 'animal 是「動物」，-al 不是字尾。'],
      ['arrive', 'arrive 是「抵達」，-ive 不是字尾。']
    ]
  },
  {
    id: 'p08',
    title: '動詞與副詞：-ize / -en / -ly',
    hook: '-ize、-ify、-en 把字變成動詞；-ly 把形容詞變成副詞「…地」。',
    parts: ['-ize', '-ify', '-en', '-ly'],
    ex: [
      ['realize', 'real+-ize', '了解；實現', 'v.'],
      ['modernize', 'modern+-ize', '使現代化', 'v.'],
      ['specialize', 'special+-ize', '專攻', 'v.'],
      ['criticize', 'critic+-ize', '批評', 'v.'],
      ['simplify', 'simpl=simple+-ify', '簡化', 'v.'],
      ['justify', 'just+-ify', '證明…是對的', 'v.'],
      ['classify', 'class+-ify', '分類', 'v.'],
      ['strengthen', 'strength+-en', '加強', 'v.'],
      ['weaken', 'weak+-en', '削弱', 'v.'],
      ['shorten', 'short+-en', '縮短', 'v.'],
      ['widen', 'wid=wide+-en', '加寬', 'v.'],
      ['threaten', 'threat+-en', '威脅', 'v.'],
      ['quickly', 'quick+-ly', '很快地', 'adv.'],
      ['slowly', 'slow+-ly', '慢慢地', 'adv.'],
      ['clearly', 'clear+-ly', '清楚地', 'adv.'],
      ['easily', 'easi=easy+-ly', '輕鬆地', 'adv.'],
      ['carefully', 'careful+-ly', '小心地', 'adv.']
    ],
    traps: [
      ['friendly', 'friendly 是形容詞「友善的」。-ly 接在名詞後面，通常是形容詞。'],
      ['hardly', 'hardly 是「幾乎不」，不是 hard + ly 的「努力地」。'],
      ['family', 'family 的 ly 不是字尾。']
    ]
  },
  {
    id: 'p09',
    title: '「不」的字首：un- / in- / dis-',
    hook: '最常見的字首就是「不」。un- 一個就佔了所有字首字的四分之一。',
    parts: ['un-', 'in-', 'im-', 'il-', 'ir-', 'dis-', 'non-'],
    ex: [
      ['unhappy', 'un-+happy', '不快樂的', 'adj.'],
      ['unable', 'un-+able', '不能的', 'adj.'],
      ['unclear', 'un-+clear', '不清楚的', 'adj.'],
      ['unusual', 'un-+usual', '不尋常的', 'adj.'],
      ['unfair', 'un-+fair', '不公平的', 'adj.'],
      ['unknown', 'un-+known', '未知的', 'adj.'],
      ['unlikely', 'un-+likely', '不太可能的', 'adj.'],
      ['unlock', 'un-+lock', '解鎖', 'v.'],
      ['unpack', 'un-+pack', '打開行李', 'v.'],
      ['incorrect', 'in-+correct', '不正確的', 'adj.'],
      ['impossible', 'im-+possible', '不可能的', 'adj.'],
      ['impolite', 'im-+polite', '沒禮貌的', 'adj.'],
      ['illegal', 'il-+legal', '違法的', 'adj.'],
      ['irregular', 'ir-+regular', '不規則的', 'adj.'],
      ['dislike', 'dis-+like', '不喜歡', 'v.'],
      ['disagree', 'dis-+agree', '不同意', 'v.'],
      ['disappear', 'dis-+appear', '消失', 'v.'],
      ['dishonest', 'dis-+honest', '不誠實的', 'adj.'],
      ['nonstop', 'non-+stop', '不停的', 'adj.'],
      ['nonsense', 'non-+sense', '胡說八道', 'n.']
    ],
    rules: ['in- 遇到 p、b、m 變 im-：impossible。', '遇到 l 變 il-：illegal；遇到 r 變 ir-：irregular。'],
    traps: [
      ['uncle', 'uncle 是「叔叔」，un 不是字首。'],
      ['under', 'under 是「在下面」，本身就是一個字。'],
      ['dish', 'dish 是「盤子」，不是 dis + h。']
    ]
  },
  {
    id: 'p10',
    title: '次數與程度：re- / pre- / mis- / over-',
    hook: 're- 再一次、pre- 之前、mis- 弄錯、over- 太多。動詞前面加上去就好。',
    parts: ['re-', 'pre-', 'mis-', 'over-', 'under-', 'out-'],
    ex: [
      ['redo', 're-+do', '重做', 'v.'],
      ['rewrite', 're-+write', '重寫', 'v.'],
      ['replay', 're-+play', '重播', 'v.'],
      ['reuse', 're-+use', '重複使用', 'v.'],
      ['rebuild', 're-+build', '重建', 'v.'],
      ['return', 're-+turn', '回來；歸還', 'v.'],
      ['replace', 're-+place', '取代', 'v.'],
      ['review', 're-+view', '複習', 'v.'],
      ['preview', 'pre-+view', '預告；預習', 'n.'],
      ['prepay', 'pre-+pay', '預付', 'v.'],
      ['preschool', 'pre-+school', '幼兒園', 'n.'],
      ['pretest', 'pre-+test', '前測', 'n.'],
      ['mistake', 'mis-+take', '錯誤', 'n.'],
      ['misunderstand', 'mis-+understand', '誤會', 'v.'],
      ['misuse', 'mis-+use', '誤用', 'v.'],
      ['mislead', 'mis-+lead', '誤導', 'v.'],
      ['overeat', 'over-+eat', '吃太多', 'v.'],
      ['oversleep', 'over-+sleep', '睡過頭', 'v.'],
      ['overweight', 'over-+weight', '過重的', 'adj.'],
      ['underground', 'under-+ground', '地下的', 'adj.'],
      ['underwater', 'under-+water', '水面下的', 'adj.'],
      ['underline', 'under-+line', '畫底線', 'v.'],
      ['outdoor', 'out-+door', '戶外的', 'adj.'],
      ['output', 'out-+put', '產出', 'n.']
    ],
    traps: [
      ['really', 'really 是「真的」，re 不是字首。'],
      ['ready', 'ready 是「準備好的」，不是 re + ady。'],
      ['understand', 'understand 不是「站在下面」——整個字一起記：了解。']
    ]
  },
  {
    id: 'p11',
    title: '方向：in- / ex- / inter- / trans-',
    hook: 'in- 進去、ex- 出去、inter- 在中間、trans- 穿過去、sub- 在下面、tele- 很遠。',
    parts: ['in-2', 'im-2', 'ex-', 'inter-', 'trans-', 'sub-', 'tele-'],
    ex: [
      ['income', 'in-2+come', '收入（進來的錢）', 'n.'],
      ['input', 'in-2+put', '輸入', 'n.'],
      ['import', 'im-2+~port', '進口', 'v.'],
      ['export', 'ex-+~port', '出口', 'v.'],
      ['exchange', 'ex-+change', '交換', 'v.'],
      ['international', 'inter-+national', '國際的', 'adj.'],
      ['internet', 'inter-+net', '網際網路', 'n.'],
      ['interview', 'inter-+view', '面試；訪談', 'n.'],
      ['interaction', 'inter-+action', '互動', 'n.'],
      ['transport', 'trans-+~port', '運輸', 'v.'],
      ['transform', 'trans-+form', '轉變', 'v.'],
      ['transfer', 'trans-+~fer', '轉移；轉乘', 'v.'],
      ['subway', 'sub-+way', '地鐵', 'n.'],
      ['subtitle', 'sub-+title', '字幕', 'n.'],
      ['television', 'tele-+vision', '電視', 'n.'],
      ['telephone', 'tele-+phone', '電話', 'n.'],
      ['telescope', 'tele-+~scope', '望遠鏡', 'n.']
    ]
  },
  {
    id: 'p12',
    title: '數字字首：uni- / bi- / tri- / multi-',
    hook: 'uni- 一、bi- 二、tri- 三、multi- 很多、semi- 一半。看到就能數出來。',
    parts: ['uni-', 'bi-', 'tri-', 'multi-', 'semi-'],
    discover: {
      words: ['unicycle', 'bicycle', 'tricycle'],
      q: 'unicycle、bicycle、tricycle 三種車，差別在哪裡？',
      options: ['輪子的數量', '顏色', '速度', '價錢'],
      answer: '輪子的數量'
    },
    ex: [
      ['uniform', 'uni-+form', '制服（大家同一個樣子）', 'n.'],
      ['unicycle', 'uni-+cycle', '單輪車', 'n.'],
      ['bicycle', 'bi-+cycle', '腳踏車', 'n.'],
      ['biweekly', 'bi-+weekly', '兩週一次的', 'adj.'],
      ['triangle', 'tri-+angle', '三角形', 'n.'],
      ['tricycle', 'tri-+cycle', '三輪車', 'n.'],
      ['multimedia', 'multi-+media', '多媒體', 'n.'],
      ['multinational', 'multi-+national', '跨國的', 'adj.'],
      ['semifinal', 'semi-+final', '準決賽', 'n.'],
      ['semicircle', 'semi-+circle', '半圓', 'n.']
    ]
  },
  {
    id: 'p13',
    title: '字根：看、聽、說',
    hook: '字根是字的核心。spect 和 vis 是「看」，aud 是「聽」，dict 是「說」。',
    parts: ['~spect', '~vis', '~aud', '~dict'],
    ex: [
      ['inspect', 'in-2+~spect', '檢查（往裡面看）', 'v.'],
      ['respect', 're-+~spect', '尊敬（回頭再看一眼）', 'v.'],
      ['expect', 'ex-+pect=~spect', '期待（往外看）', 'v.'],
      ['vision', 'vis=~vis+ion=-tion', '視力；願景', 'n.'],
      ['visible', 'vis=~vis+ible=-able', '看得見的', 'adj.'],
      ['revise', 're-+~vis+.e', '修改（再看一次）', 'v.'],
      ['audience', '~aud+.i+ence=-ance', '觀眾（聽的人）', 'n.'],
      ['predict', 'pre-+~dict', '預測（事先說）', 'v.'],
      ['prediction', 'pre-+~dict+ion=-tion', '預測', 'n.']
    ],
    rules: ['字根通常不能單獨用，要接字首或字尾才是一個字。']
  },
  {
    id: 'p14',
    title: '字根：搬、拉、壓、丟、送',
    hook: 'port 搬、tract 拉、press 壓、ject 丟、mit 送。加上方向字首，意思就出來了。',
    parts: ['~port', '~tract', '~press', '~ject', '~mit', 'ad-', 'con-', 'pro-'],
    ex: [
      ['report', 're-+~port', '報導（把消息帶回來）', 'v.'],
      ['support', 'sup=sub-+~port', '支持（從下面撐著）', 'v.'],
      ['portable', '~port+-able', '可攜帶的', 'adj.'],
      ['attract', 'at=ad-+~tract', '吸引（拉過來）', 'v.'],
      ['contract', 'con-+~tract', '合約（拉在一起）', 'n.'],
      ['tractor', '~tract+-or', '拖拉機', 'n.'],
      ['distract', 'dis-+~tract', '使分心（拉開）', 'v.'],
      ['express', 'ex-+~press', '表達（從裡面壓出來）', 'v.'],
      ['impress', 'im-2+~press', '使印象深刻（壓進心裡）', 'v.'],
      ['pressure', '~press+-ure', '壓力', 'n.'],
      ['project', 'pro-+~ject', '計畫；投射（往前丟）', 'n.'],
      ['reject', 're-+~ject', '拒絕（丟回去）', 'v.'],
      ['inject', 'in-2+~ject', '注射（丟進去）', 'v.'],
      ['admit', 'ad-+~mit', '承認；准許進入', 'v.'],
      ['transmit', 'trans-+~mit', '傳送（送過去）', 'v.'],
      ['mission', 'miss=~mit+ion=-tion', '任務（被派出去做的事）', 'n.'],
      ['dismiss', 'dis-+miss=~mit', '解散；開除（送走）', 'v.']
    ]
  },
  {
    id: 'p15',
    title: '字根：建造、寫、來、帶',
    hook: 'struct 建造、graph 和 scrib 寫、vent 來、fer 帶。最後一個單元：把前面的字首全部用上。',
    parts: ['~struct', '~graph', '~scrib', '~vent', '~fer', 'de-'],
    ex: [
      ['structure', '~struct+-ure', '結構', 'n.'],
      ['construct', 'con-+~struct', '建造（一起蓋）', 'v.'],
      ['instruct', 'in-2+~struct', '指導', 'v.'],
      ['instruction', 'in-2+~struct+ion=-tion', '說明；指示', 'n.'],
      ['photograph', '~photo+~graph', '照片（用光畫出來）', 'n.'],
      ['autograph', 'auto-+~graph', '親筆簽名（自己寫）', 'n.'],
      ['graphic', '~graph+-ic', '圖像的', 'adj.'],
      ['describe', 'de-+~scrib+.e', '描述（寫下來）', 'v.'],
      ['subscribe', 'sub-+~scrib+.e', '訂閱（在下面簽名）', 'v.'],
      ['event', 'e=ex-+~vent', '事件（冒出來的事）', 'n.'],
      ['prevent', 'pre-+~vent', '預防（搶先來擋住）', 'v.'],
      ['invent', 'in-2+~vent', '發明', 'v.'],
      ['adventure', 'ad-+~vent+-ure', '冒險', 'n.'],
      ['refer', 're-+~fer', '提到；參考', 'v.'],
      ['prefer', 'pre-+~fer', '比較喜歡（擺到前面）', 'v.'],
      ['conference', 'con-+~fer+ence=-ance', '會議（把人帶到一起）', 'n.']
    ]
  }
]

export const UNIT_BY_ID = Object.fromEntries(UNITS.map(u => [u.id, u]))

/* ------------------------------------------------------------------ */

/**
 * Parse one `parts` string into tiles: { text, kind, ref }.
 * kind: prefix | suffix | root | base | link.
 */
export function parseParts (spec) {
  return spec.split('+').map(tok => {
    let text, ref
    if (tok.startsWith('.')) return { text: tok.slice(1), kind: 'link', ref: null }
    if (tok.includes('=')) [text, ref] = tok.split('=')
    else { ref = tok; text = null }
    const part = PARTS[ref]
    if (part) {
      return { text: text ?? part.label.split(' ')[0].replace(/^-|-$/g, '').replace(/^~/, ''), kind: part.kind, ref }
    }
    return { text: text ?? ref, kind: 'base', ref }
  })
}

/** Every example as a record, in course order. */
export const EXAMPLES = UNITS.flatMap(u => u.ex.map(([w, spec, zh, pos]) => ({
  w, zh, pos, unit: u.id, tiles: parseParts(spec)
})))

/** headword → first curated decomposition. */
export const EXAMPLE_BY_WORD = (() => {
  const m = new Map()
  for (const e of EXAMPLES) if (!m.has(e.w)) m.set(e.w, e)
  return m
})()

/** The meaning group of a part (im- → in-), for games that ask "which part means 不". */
export function familyOf (ref) {
  return PARTS[ref]?.of || ref
}
