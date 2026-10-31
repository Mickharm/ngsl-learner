/**
 * Grammar Studio content — what the 30 points needed beyond explanation + six
 * drills to stop "每次都是同一套邏輯，照順序做就好".
 *
 * Per point:
 *
 *   discover  An inductive question asked BEFORE the rule is shown: look at
 *             these sentences, what is the pattern? (noticing → consciousness
 *             raising). The learner commits to a guess, then sees the rule.
 *
 *   model     The visual shape of the point:
 *               { kind: 'slots',    slots: [['S','主詞'], ['V','動詞'], ...] }
 *               { kind: 'timeline', tense: 'habit'|'past'|'now'|'past-ongoing'|'future'|'past-now'|'past-past' }
 *
 *   items     Structured-input tasks (VanPatten): the learner has to process
 *             the FORM to get the MEANING right — which picture matches, where
 *             on the timeline is this action, did she finish or not. Types:
 *               picture   { scene, q, options, answer, explain }
 *               timeline  { s, zh, answer: <tense>, explain }
 *               meaning   { s, q, options, answer, explain }
 *               blocks    { zh, blocks: [[text, role]], explain }  roles: S V O C P T X
 *
 * These items are mixed with the point's original drills and, in the 混合挑戰
 * round, with items from every point learned before — interleaving forces the
 * learner to decide WHICH rule applies, which blocked practice never asks
 * (Nakata & Suzuki 2019, "Mixing grammar exercises facilitates long-term
 * retention"; Pan et al. 2019 for the study-blocked / practice-mixed split).
 */

/** Timeline zones the timeline items and diagrams share. */
export const TENSES = Object.freeze({
  habit: { label: '習慣 / 事實', hint: '一再發生、現在也成立' },
  past: { label: '過去某一點', hint: '發生了，已經結束' },
  now: { label: '此刻正在', hint: '說話的這一刻還在進行' },
  'past-ongoing': { label: '過去某刻正在', hint: '過去那一刻還在進行中' },
  future: { label: '未來', hint: '還沒發生' },
  'past-now': { label: '從過去到現在', hint: '過去開始，影響或狀態延續到現在' },
  'past-past': { label: '過去的過去', hint: '比另一件過去的事更早' }
})

export const ROLES = Object.freeze({
  S: { label: '主詞', tone: 's' },
  V: { label: '動詞', tone: 'v' },
  O: { label: '受詞', tone: 'o' },
  C: { label: '補語', tone: 'c' },
  P: { label: '地點', tone: 'p' },
  T: { label: '時間', tone: 't' },
  X: { label: '其他', tone: 'x' }
})

export default {
  g01: {
    discover: {
      shown: ['The dog bit the man.', 'The man bit the dog.'],
      q: '兩句用的字完全一樣，意思為什麼相反？',
      options: ['站在動詞前面的那個人才是「做的人」', '後面那個字才是做的人', '英文其實兩句意思一樣'],
      answer: 0,
      why: '英文靠「位置」決定誰做誰：動詞前 = 主詞（做的人），動詞後 = 受詞（被做的）。'
    },
    model: { kind: 'slots', slots: [['S', '誰'], ['V', '做什麼'], ['O', '對誰/什麼']] },
    items: [
      { type: 'picture', scene: '🐕 ➡️ 🧑', q: '圖：狗咬人。哪一句對？', options: ['The dog bit the man.', 'The man bit the dog.'], answer: 0, explain: '做動作的狗要站在動詞 bit 前面。' },
      { type: 'blocks', zh: '我姊姊昨天買了一支新手機。', blocks: [['My sister', 'S'], ['bought', 'V'], ['a new phone', 'O'], ['yesterday', 'T']], explain: '骨架是 S + V + O，時間放最後。' },
      { type: 'blocks', zh: '工程師修好了機器。', blocks: [['The engineer', 'S'], ['fixed', 'V'], ['the machine', 'O']], explain: '修東西的人是主詞，被修的機器是受詞。' }
    ]
  },
  g02: {
    discover: {
      shown: ['I am tired.', 'She is a nurse.', 'They are at the station.'],
      q: 'am / is / are 後面接的東西有什麼共同點？',
      options: ['都在說主詞「是什麼、怎麼樣、在哪裡」', '都在說主詞「做了什麼動作」', '後面一定接動詞'],
      answer: 0,
      why: 'be 動詞不是動作，它把主詞和「身分 / 狀態 / 位置」連起來。'
    },
    model: { kind: 'slots', slots: [['S', '誰'], ['V', 'am/is/are'], ['C', '身分/狀態/地點']] },
    items: [
      { type: 'picture', scene: '🥶', q: '圖中的人怎麼了？', options: ['He is cold.', 'He cold.', 'He is cold it.'], answer: 0, explain: '形容詞 cold 前面需要 be 動詞 is。' },
      { type: 'meaning', s: 'The keys are on the table.', q: '這句在說鑰匙的什麼？', options: ['位置', '身分', '動作'], answer: 0, explain: 'be + 地點 = 在哪裡。' },
      { type: 'blocks', zh: '我的同事很忙。', blocks: [['My colleague', 'S'], ['is', 'V'], ['busy', 'C']], explain: 'busy 是狀態（補語），不需要再加別的動詞。' }
    ]
  },
  g03: {
    discover: {
      shown: ['I take the MRT to work.', 'She takes the bus to work.', 'They take a taxi to work.'],
      q: '為什麼第二句的動詞多了 -s？',
      options: ['主詞是 she（第三人稱單數）', '因為她比較忙', '因為是過去發生的'],
      answer: 0,
      why: '現在簡單式：主詞是 he / she / it / 單數名詞時，動詞加 -s。'
    },
    model: { kind: 'timeline', tense: 'habit' },
    items: [
      { type: 'timeline', s: 'He checks his email every morning.', zh: '他每天早上收信。', answer: 'habit', explain: 'every morning = 一再發生的習慣。' },
      { type: 'meaning', s: 'Water boils at 100 degrees.', q: '這句在說什麼？', options: ['一個永遠成立的事實', '水現在正在滾', '水昨天滾了'], answer: 0, explain: '現在簡單式也用來講不變的事實。' },
      { type: 'picture', scene: '☕ 🌅 ×7', q: '他每天早上喝咖啡。哪一句對？', options: ['He drinks coffee every morning.', 'He is drinking coffee every morning.', 'He drink coffee every morning.'], answer: 0, explain: '習慣用現在簡單式，he 後動詞加 -s。' }
    ]
  },
  g04: {
    discover: {
      shown: ['I visit my parents every week.', 'I visited my parents last week.'],
      q: '-ed 讓句子的意思怎麼變？',
      options: ['變成已經發生、結束的事', '變成正在發生', '變成還沒發生'],
      answer: 0,
      why: '過去簡單式：發生在過去、已經結束，常配 yesterday / last week / ago。'
    },
    model: { kind: 'timeline', tense: 'past' },
    items: [
      { type: 'timeline', s: 'We missed the train yesterday.', zh: '我們昨天錯過火車。', answer: 'past', explain: 'yesterday 是過去的一個時間點。' },
      { type: 'meaning', s: 'I lived in Tainan for five years.', q: '他現在還住在台南嗎？', options: ['不住了', '還住著', '看不出來'], answer: 0, explain: '過去簡單式 = 那段時間已經結束。若還住著要用 have lived。' },
      { type: 'picture', scene: '✈️ 🛬 ⬅️📅', q: '飛機昨天降落了。', options: ['The plane landed yesterday.', 'The plane lands yesterday.', 'The plane is landing yesterday.'], answer: 0, explain: 'yesterday → 過去式 landed。' }
    ]
  },
  g05: {
    discover: {
      shown: ['a laptop → two laptops', 'some advice → (no "advices")', 'some water → (no "a water")'],
      q: '為什麼 advice 和 water 不能加 a 也不能加 -s？',
      options: ['它們是「不可數」的，英文不把它們一個一個數', '它們太短了', '它們是動詞'],
      answer: 0,
      why: '可數名詞：a + 單數 / 複數加 -s。不可數（advice, information, water, equipment）：不加 a、不加 -s，用 some / much。'
    },
    model: null,
    items: [
      { type: 'picture', scene: '🍎🍎🍎', q: '圖裡有什麼？', options: ['three apples', 'three apple', 'a three apples'], answer: 0, explain: '超過一個 → 名詞加 -s。' },
      { type: 'picture', scene: '💧', q: '請給我一些水。', options: ['Please give me some water.', 'Please give me a water.', 'Please give me some waters.'], answer: 0, explain: 'water 不可數：不加 a、不加 -s。' },
      { type: 'meaning', s: 'She gave me some useful information.', q: 'information 為什麼沒有 -s？', options: ['它是不可數名詞', '因為只有一個', '打錯了'], answer: 0, explain: 'information 永遠不加 -s。' }
    ]
  },
  g06: {
    discover: {
      shown: ['I saw a dog.', 'The dog was huge.'],
      q: '第一句用 a，第二句為什麼改用 the？',
      options: ['第二次提到，雙方都知道是哪一隻', '第二隻狗比較大', 'the 用在句子開頭'],
      answer: 0,
      why: '第一次提到 → a/an；說的人和聽的人都知道是哪一個 → the。'
    },
    model: null,
    items: [
      { type: 'meaning', s: 'Please close the door.', q: '說話的人指的是哪扇門？', options: ['雙方都知道的那一扇', '隨便一扇門', '世界上所有的門'], answer: 0, explain: 'the = 你我都知道是哪一個。' },
      { type: 'picture', scene: '🧑‍🔧', q: '她是一位工程師。', options: ['She is an engineer.', 'She is engineer.', 'She is a engineer.'], answer: 0, explain: '職業要加冠詞；engineer 母音開頭用 an。' },
      { type: 'meaning', s: 'Cars are expensive in Taiwan.', q: '這句在說哪些車？', options: ['泛指所有車', '某幾台特定的車', '說話者自己的車'], answer: 0, explain: '泛指一整類 → 複數不加 the。' }
    ]
  },
  g07: {
    discover: {
      shown: ['in 2026 · in July', 'on Friday · on July 4th', 'at 3 p.m. · at noon'],
      q: 'in → on → at，時間的範圍怎麼變？',
      options: ['越來越小：年月 → 某一天 → 時間點', '越來越大', '沒有規律，要死背'],
      answer: 0,
      why: '大範圍 in（年、月、季節）、某一天 on（星期、日期）、一個點 at（幾點）。地點也一樣：in Taipei / on the table / at the door。'
    },
    model: null,
    items: [
      { type: 'picture', scene: '📦 ⬇️ 🐈', q: '貓在箱子裡面。', options: ['The cat is in the box.', 'The cat is on the box.', 'The cat is at the box.'], answer: 0, explain: '在容器裡面 → in。' },
      { type: 'picture', scene: '🪑 ⬆️ 👜', q: '包包在椅子上。', options: ['The bag is on the chair.', 'The bag is in the chair.', 'The bag is at the chair.'], answer: 0, explain: '放在表面上 → on。' },
      { type: 'meaning', s: 'The meeting is at 3 p.m. on Friday.', q: 'at 和 on 各接什麼？', options: ['at 接時間點，on 接某一天', 'at 接某一天，on 接時間點', '兩個可以互換'], answer: 0, explain: '點用 at，一天用 on。' }
    ]
  },
  g08: {
    discover: {
      shown: ['There is a bank near here.', 'There are two banks near here.'],
      q: 'is 和 are 是跟著哪個字變的？',
      options: ['跟著後面的名詞是單數還是複數', '跟著 There', '跟著地點'],
      answer: 0,
      why: 'There is + 單數 / 不可數；There are + 複數。動詞看後面的名詞。'
    },
    model: { kind: 'slots', slots: [['X', 'There'], ['V', 'is / are'], ['S', '什麼東西'], ['P', '在哪裡']] },
    items: [
      { type: 'picture', scene: '🏨🏨🏨', q: '這附近有三家飯店。', options: ['There are three hotels near here.', 'There is three hotels near here.', 'It has three hotels near here.'], answer: 0, explain: '複數 hotels → There are。「有」不能直譯成 It has。' },
      { type: 'blocks', zh: '冰箱裡有一些牛奶。', blocks: [['There', 'X'], ['is', 'V'], ['some milk', 'S'], ['in the fridge', 'P']], explain: 'milk 不可數 → There is。' },
      { type: 'meaning', s: 'There is no time left.', q: '這句的意思是？', options: ['沒有時間了', '時間在那裡', '有很多時間'], answer: 0, explain: 'There is no + 名詞 = 沒有…。' }
    ]
  },
  g09: {
    discover: {
      shown: ['She called me.', 'I called her.', 'This is her phone.'],
      q: 'she 為什麼一下變 her？',
      options: ['看它在句子裡的位置：動詞前用 she，動詞後或表示「她的」用 her', '隨便換都可以', '女生的名字變了'],
      answer: 0,
      why: '主格（動詞前）I / he / she；受格（動詞或介系詞後）me / him / her；所有格（＋名詞）my / his / her。'
    },
    model: { kind: 'slots', slots: [['S', 'I / he / she'], ['V', '動詞'], ['O', 'me / him / her']] },
    items: [
      { type: 'picture', scene: '👩 📞 👨', q: '她打電話給他。', options: ['She called him.', 'Her called him.', 'She called he.'], answer: 0, explain: '動詞前用主格 She，動詞後用受格 him。' },
      { type: 'meaning', s: 'The manager gave us his number.', q: 'his 指的是誰的號碼？', options: ['經理的', '我們的', '看不出來'], answer: 0, explain: 'his = 他的，指前面的 manager。' },
      { type: 'blocks', zh: '他們邀請我們。', blocks: [['They', 'S'], ['invited', 'V'], ['us', 'O']], explain: 'we 在動詞後要變受格 us。' }
    ]
  },
  g10: {
    discover: {
      shown: ['a quiet room', 'The room is quiet.', 'She always arrives early.', 'She is always early.'],
      q: 'always 放的位置有什麼規則？',
      options: ['放在一般動詞前、be 動詞後', '一律放句尾', '一律放句首'],
      answer: 0,
      why: '形容詞放名詞前或 be 後；頻率副詞（always, usually, often, never）放一般動詞前、be 動詞後。'
    },
    model: { kind: 'slots', slots: [['S', '誰'], ['X', 'always / often'], ['V', '動詞'], ['O', '…']] },
    items: [
      { type: 'blocks', zh: '他通常走路上班。', blocks: [['He', 'S'], ['usually', 'X'], ['walks', 'V'], ['to work', 'P']], explain: 'usually 放在一般動詞 walks 前面。' },
      { type: 'picture', scene: '😴 ⏰ 🚫', q: '他從不遲到。', options: ['He is never late.', 'He never is late.', 'He is late never.'], answer: 0, explain: 'be 動詞後放頻率副詞：is never。' },
      { type: 'meaning', s: 'She rarely eats meat.', q: '她多常吃肉？', options: ['很少', '常常', '每天'], answer: 0, explain: 'rarely = 很少。' }
    ]
  },
  g11: {
    discover: {
      shown: ['I eat lunch at noon.', "I'm eating lunch now."],
      q: '第二句的 am + eating 想強調什麼？',
      options: ['說話這一刻正在進行', '每天都這樣', '已經吃完了'],
      answer: 0,
      why: '現在進行式 am/is/are + V-ing = 此刻正在發生；現在簡單式 = 平常習慣。'
    },
    model: { kind: 'timeline', tense: 'now' },
    items: [
      { type: 'timeline', s: 'Look! It is raining.', zh: '你看！在下雨。', answer: 'now', explain: 'Look! 提醒是此刻正在發生。' },
      { type: 'picture', scene: '🏊 👀', q: '（你正看著）她在游泳。', options: ['She is swimming.', 'She swims.', 'She swimming.'], answer: 0, explain: '此刻正在 → is + swimming；不能漏掉 is。' },
      { type: 'meaning', s: 'He works in Taipei, but this week he is working in Tainan.', q: '他平常在哪裡工作？', options: ['台北', '台南', '兩邊輪流'], answer: 0, explain: 'works = 平常；is working = 這段期間暫時。' }
    ]
  },
  g12: {
    discover: {
      shown: ['I was cooking when the phone rang.'],
      q: '哪件事先開始、而且被打斷了？',
      options: ['煮飯（was cooking）', '電話響（rang）', '同時開始'],
      answer: 0,
      why: '過去進行式 was/were + V-ing = 過去某刻正在進行；常被另一個過去簡單式的短動作打斷。'
    },
    model: { kind: 'timeline', tense: 'past-ongoing' },
    items: [
      { type: 'timeline', s: 'At 8 p.m. last night, we were watching a movie.', zh: '昨晚八點我們正在看電影。', answer: 'past-ongoing', explain: '過去某一刻（8 p.m.）正在進行。' },
      { type: 'meaning', s: 'She was sleeping when I called.', q: '我打電話時她在做什麼？', options: ['正在睡覺', '剛睡醒', '還沒睡'], answer: 0, explain: 'was sleeping = 那一刻正在睡。' },
      { type: 'picture', scene: '🚿 + 🔔', q: '門鈴響的時候我正在洗澡。', options: ['I was taking a shower when the doorbell rang.', 'I took a shower when the doorbell was ringing.', 'I am taking a shower when the doorbell rang.'], answer: 0, explain: '長動作用過去進行式，打斷它的短動作用過去簡單式。' }
    ]
  },
  g13: {
    discover: {
      shown: ["It's cold. I'll close the window.", "I'm going to visit Japan next month. I booked the hotel."],
      q: 'will 和 be going to 的差別是？',
      options: ['will 是當下決定；going to 是早就計畫好的', '完全一樣', 'will 比較久以後'],
      answer: 0,
      why: 'will：說話當下決定、承諾、預測。be going to：之前就打算好的計畫，或看到跡象的預測。'
    },
    model: { kind: 'timeline', tense: 'future' },
    items: [
      { type: 'timeline', s: 'I will call you tomorrow.', zh: '我明天打給你。', answer: 'future', explain: 'tomorrow，還沒發生。' },
      { type: 'meaning', s: "Look at those clouds. It's going to rain.", q: '為什麼用 going to？', options: ['看到跡象（烏雲）做的預測', '當下突然決定', '下雨是習慣'], answer: 0, explain: '有證據的預測 → be going to。' },
      { type: 'picture', scene: '📞 ❗', q: '電話響了。「我來接！」', options: ["I'll get it!", "I'm going to get it!", 'I get it yesterday!'], answer: 0, explain: '當下決定 → will。' }
    ]
  },
  g14: {
    discover: {
      shown: ['I lost my key yesterday.', "I've lost my key. (I can't get in.)"],
      q: '第二句 have lost 比 lost 多了什麼意思？',
      options: ['結果還影響現在（現在進不去）', '比較久以前', '只是比較禮貌'],
      answer: 0,
      why: '現在完成式 have/has + 過去分詞：過去發生、和現在有關（結果、經驗、持續到現在）。'
    },
    model: { kind: 'timeline', tense: 'past-now' },
    items: [
      { type: 'timeline', s: 'She has worked here since 2020.', zh: '她從 2020 年就在這裡工作。', answer: 'past-now', explain: 'since 2020 → 從過去延續到現在，現在還在做。' },
      { type: 'meaning', s: 'I have finished the report.', q: '報告現在的狀態？', options: ['已經完成，可以交了', '還在寫', '昨天寫完但弄丟了'], answer: 0, explain: '完成的結果延續到現在。' },
      { type: 'timeline', s: 'I finished the report two hours ago.', zh: '我兩小時前完成報告。', answer: 'past', explain: 'ago 指明過去的時間點 → 過去簡單式，不能用 have finished。' }
    ]
  },
  g15: {
    discover: {
      shown: ['cheap → cheaper → the cheapest', 'expensive → more expensive → the most expensive'],
      q: '什麼時候用 -er，什麼時候用 more？',
      options: ['短字加 -er；長字（三個音節以上）用 more', '隨便選', '形容人用 -er'],
      answer: 0,
      why: '短形容詞 + -er / -est；長的用 more / most；比較兩個用 than，三個以上用 the + 最高級。'
    },
    model: null,
    items: [
      { type: 'picture', scene: '🐘 ＞ 🐕', q: '大象比狗大。', options: ['The elephant is bigger than the dog.', 'The elephant is more big than the dog.', 'The elephant is biggest than the dog.'], answer: 0, explain: 'big 是短字 → bigger（子音重複）+ than。' },
      { type: 'picture', scene: '💎 💰💰💰', q: '這是最貴的一個。', options: ['This is the most expensive one.', 'This is the expensivest one.', 'This is more expensive one.'], answer: 0, explain: '長字 expensive → the most expensive。' },
      { type: 'meaning', s: 'Taipei is busier than Tainan.', q: '哪個城市比較繁忙？', options: ['台北', '台南', '一樣'], answer: 0, explain: 'A is busier than B = A 比 B 忙。' }
    ]
  },
  g16: {
    discover: {
      shown: ['You must wear a badge.', 'You should rest.', 'You can park here.'],
      q: 'must / should / can 後面的動詞有什麼共同點？',
      options: ['一律原形，不加 s、不加 to', '要加 -ing', '要加 to'],
      answer: 0,
      why: '情態動詞 + 原形動詞。must = 必須，should = 應該（建議），can = 可以 / 會，may = 可能 / 可以。'
    },
    model: null,
    items: [
      { type: 'meaning', s: "You don't have to come to the meeting.", q: '這句的意思是？', options: ['你可以不用來', '你絕對不准來', '你一定要來'], answer: 0, explain: "don't have to = 不必；mustn't 才是「不准」。" },
      { type: 'picture', scene: '🚭', q: '這個標誌的意思是？', options: ['You must not smoke here.', "You don't have to smoke here.", 'You should to smoke here.'], answer: 0, explain: 'must not = 禁止。' },
      { type: 'meaning', s: 'It may rain this afternoon.', q: '會不會下雨？', options: ['有可能', '一定會', '一定不會'], answer: 0, explain: 'may = 可能（不確定）。' }
    ]
  },
  g17: {
    discover: {
      shown: ['The company built the factory in 2020.', 'The factory was built in 2020.'],
      q: '第二句為什麼把 factory 放前面？',
      options: ['重點是工廠「被蓋」，誰蓋的不重要', '工廠自己蓋了自己', '因為比較短'],
      answer: 0,
      why: '被動語態 be + 過去分詞：主詞是「被做的」那一方。執行者重要才加 by …。'
    },
    model: { kind: 'slots', slots: [['S', '被做的'], ['V', 'be + 過去分詞'], ['X', '(by 誰)']] },
    items: [
      { type: 'meaning', s: 'The window was broken by the kids.', q: '誰打破了窗戶？', options: ['小孩', '窗戶', '看不出來'], answer: 0, explain: 'by the kids = 執行者是小孩。' },
      { type: 'blocks', zh: '這封信昨天寄出了。', blocks: [['The letter', 'S'], ['was sent', 'V'], ['yesterday', 'T']], explain: '信是被寄的 → was sent。' },
      { type: 'picture', scene: '🍰 ← 👩‍🍳', q: '這個蛋糕是我媽做的。', options: ['This cake was made by my mom.', 'This cake made by my mom.', 'This cake was make by my mom.'], answer: 0, explain: 'be 不能少，make 要用過去分詞 made。' }
    ]
  },
  g18: {
    discover: {
      shown: ['We decided to wait.', 'She enjoys cooking.', 'I look forward to meeting you.'],
      q: '為什麼 decided 後接 to wait，enjoys 後卻接 cooking？',
      options: ['是由前面的動詞決定的，要跟著動詞一起記', '看心情', 'to 比較正式'],
      answer: 0,
      why: 'decide / want / plan + to V；enjoy / avoid / finish + V-ing；介系詞（包括 look forward to 的 to）後面一律 V-ing。'
    },
    model: null,
    items: [
      { type: 'meaning', s: 'He stopped smoking.', q: '他現在還抽菸嗎？', options: ['不抽了', '停下來去抽菸', '還在抽'], answer: 0, explain: 'stop + V-ing = 停止那件事；stop to V = 停下來去做。' },
      { type: 'meaning', s: 'He stopped to smoke.', q: '這句的意思是？', options: ['他停下手邊的事去抽菸', '他戒菸了', '他不想抽'], answer: 0, explain: 'stop to V = 停下來是為了去做 V。' },
      { type: 'picture', scene: '😋 🍳', q: '我喜歡下廚。', options: ['I enjoy cooking.', 'I enjoy to cook.', 'I enjoy cook.'], answer: 0, explain: 'enjoy 後面只能接 V-ing。' }
    ]
  },
  g19: {
    discover: {
      shown: ['It was late, so we took a taxi.', 'We took a taxi because it was late.'],
      q: 'so 和 because 後面接的分別是？',
      options: ['so 接結果，because 接原因', 'so 接原因，because 接結果', '兩個意思一樣可以互換位置'],
      answer: 0,
      why: 'because + 原因；so + 結果；but 轉折；although 雖然（不能再加 but）。'
    },
    model: null,
    items: [
      { type: 'meaning', s: 'Although it rained, we went hiking.', q: '他們有去爬山嗎？', options: ['有', '沒有', '看不出來'], answer: 0, explain: 'although = 雖然…（但還是做了）。' },
      { type: 'picture', scene: '🌧️ ➡️ ☂️', q: '下雨了，所以我帶傘。', options: ['It was raining, so I took an umbrella.', 'It was raining, because I took an umbrella.', 'Because it was raining, so I took an umbrella.'], answer: 0, explain: 'so 接結果；because 和 so 不能同時用。' },
      { type: 'meaning', s: 'The design is simple but effective.', q: 'but 前後的關係是？', options: ['轉折：簡單，卻有效', '因果：因為簡單所以有效', '並列：簡單而且漂亮'], answer: 0, explain: 'but 表示兩件事有對比。' }
    ]
  },
  g20: {
    discover: {
      shown: ["I'll text you when I land.", 'Wait until the light turns green.'],
      q: '講的是未來的事，為什麼 when 後面用 land 不用 will land？',
      options: ['時間子句裡用現在式代替未來式', '打錯了', '因為主詞是 I'],
      answer: 0,
      why: 'when / before / after / until / as soon as 引導的時間子句，就算講未來也用現在式。'
    },
    model: null,
    items: [
      { type: 'meaning', s: 'After she left, the room felt empty.', q: '哪件事先發生？', options: ['她離開', '房間變空', '同時'], answer: 0, explain: 'after A, B = A 先，B 後。' },
      { type: 'meaning', s: 'Before you submit, check the format.', q: '要先做什麼？', options: ['檢查格式', '送出', '都可以'], answer: 0, explain: 'before A, B = 先做 B，再做 A。' },
      { type: 'picture', scene: '🛬 ➡️ 📱', q: '我一降落就傳訊息給你。', options: ["I'll text you as soon as I land.", "I'll text you as soon as I will land.", 'I text you as soon as I landed.'], answer: 0, explain: '時間子句用現在式 land，主要子句才用 will。' }
    ]
  },
  g21: {
    discover: {
      shown: ['When I arrived, the train had left.'],
      q: '我到的時候，火車在哪裡？',
      options: ['已經開走了（had left 更早發生）', '剛好要開', '還沒來'],
      answer: 0,
      why: '過去完成式 had + 過去分詞 = 在另一件過去的事「之前」就已經發生了。'
    },
    model: { kind: 'timeline', tense: 'past-past' },
    items: [
      { type: 'timeline', s: 'She had finished dinner before I called.', zh: '我打電話之前她就吃完晚餐了。', answer: 'past-past', explain: '吃完晚餐比打電話更早。' },
      { type: 'meaning', s: 'When I got to the store, it had closed.', q: '我有買到東西嗎？', options: ['沒有，店早就關了', '有', '店剛好開門'], answer: 0, explain: 'had closed = 我到之前就關了。' },
      { type: 'meaning', s: 'When I got to the store, it closed.', q: '和上一句比，店什麼時候關？', options: ['我一到就關（幾乎同時）', '我到之前早就關了', '沒關'], answer: 0, explain: '兩個過去簡單式 → 依序發生，幾乎同時。' }
    ]
  },
  g22: {
    discover: {
      shown: ['If you heat ice, it melts.', 'If it rains tomorrow, we will stay home.'],
      q: '兩句的 if 後面都用現在式，差別在？',
      options: ['第一句永遠成立；第二句是未來可能發生的事', '第一句是過去', '沒有差別'],
      answer: 0,
      why: 'Type 0：If + 現在式, 現在式（定律）。Type 1：If + 現在式, will + 原形（真的可能發生）。if 子句裡不用 will。'
    },
    model: null,
    items: [
      { type: 'meaning', s: 'If the test fails, we will roll back.', q: '這件事可能發生嗎？', options: ['可能，這是實際的計畫', '不可能，純假設', '已經發生了'], answer: 0, explain: 'Type 1 = 真實可能。' },
      { type: 'picture', scene: '🧊 + 🔥 = 💧', q: '冰加熱就會融化。', options: ['If you heat ice, it melts.', 'If you will heat ice, it melts.', 'If you heated ice, it will melt.'], answer: 0, explain: '永遠成立的事實 → Type 0，兩邊都現在式。' },
      { type: 'meaning', s: 'Unless we get approval, the project cannot start.', q: 'unless 的意思是？', options: ['除非', '因為', '雖然'], answer: 0, explain: 'unless = if not。' }
    ]
  },
  g23: {
    discover: {
      shown: ['If I were you, I would ask for a discount.'],
      q: '說話的人真的是「你」嗎？',
      options: ['不是，這是和現實相反的假設', '是', '未來會變成你'],
      answer: 0,
      why: 'Type 2：If + 過去式, would + 原形 = 和「現在」事實相反的想像。be 動詞一律用 were。'
    },
    model: null,
    items: [
      { type: 'meaning', s: 'If I had more time, I would learn Japanese.', q: '他現在有很多時間嗎？', options: ['沒有', '有', '以後會有'], answer: 0, explain: 'Type 2 的過去式表示「現實不是這樣」。' },
      { type: 'meaning', s: 'If I have time, I will learn Japanese.', q: '和上一句比，這句？', options: ['真的有可能有時間', '一定沒時間', '已經學了'], answer: 0, explain: 'Type 1 = 可能發生；Type 2 = 與現實相反。' },
      { type: 'picture', scene: '🦅 ✈️', q: '如果我是一隻鳥，我會飛到日本。', options: ['If I were a bird, I would fly to Japan.', 'If I am a bird, I will fly to Japan.', 'If I was a bird, I will fly to Japan.'], answer: 0, explain: '不可能的假設 → were ... would。' }
    ]
  },
  g24: {
    discover: {
      shown: ['The woman who called you is my boss.', 'The phone which I bought is broken.'],
      q: 'who 和 which 怎麼選？',
      options: ['前面是人用 who，是東西用 which（兩者都可用 that）', '主詞用 who，受詞用 which', '一樣，隨便選'],
      answer: 0,
      why: '關係子句幫前面的名詞加說明：人 → who，物 → which，兩者都可以用 that。'
    },
    model: { kind: 'slots', slots: [['S', '名詞'], ['X', 'who / which + 說明'], ['V', '主要動詞'], ['C', '…']] },
    items: [
      { type: 'meaning', s: 'The man who lives next door is a pilot.', q: '誰是飛行員？', options: ['住隔壁的那個男人', '說話的人', '隔壁的房子'], answer: 0, explain: 'who lives next door 在說明 the man。' },
      { type: 'blocks', zh: '你寄來的檔案打不開。', blocks: [['The file', 'S'], ['that you sent', 'X'], ["doesn't open", 'V']], explain: 'that you sent 夾在主詞和動詞中間，說明是哪個檔案。' },
      { type: 'picture', scene: '🐕 🦴', q: '那隻在吃骨頭的狗是我的。', options: ['The dog that is eating a bone is mine.', 'The dog who is eat a bone is mine.', 'The dog is eating a bone is mine.'], answer: 0, explain: '物 / 動物用 that 或 which 引導說明。' }
    ]
  },
  g25: {
    discover: {
      shown: ['"I am busy," she said.', 'She said (that) she was busy.'],
      q: '轉述時 am 為什麼變成 was？',
      options: ['轉述過去說的話，時態往過去退一格', '因為主詞變了', '打錯了'],
      answer: 0,
      why: '間接引語：said / told + (that) + 子句，時態後退一格（am → was，will → would），人稱跟著換。'
    },
    model: null,
    items: [
      { type: 'meaning', s: 'He told me that he would call back.', q: '他原本說的話是？', options: ['"I will call back."', '"I called back."', '"You will call back."'], answer: 0, explain: 'would ← will；he ← I。' },
      { type: 'meaning', s: 'The manager asked if I had finished.', q: '經理原本問的是？', options: ['"Have you finished?"', '"I have finished."', '"Will you finish?"'], answer: 0, explain: 'yes/no 問題轉述用 if，時態後退一格。' },
      { type: 'picture', scene: '🗣️ "I\'m tired."', q: '她說她累了。', options: ['She said she was tired.', 'She said she is tired yesterday.', 'She told she was tired.'], answer: 0, explain: 'said + 子句；tell 後面要接人（told me）。' }
    ]
  },
  g26: {
    discover: {
      shown: ['She let me use her charger.', 'The boss made us work late.'],
      q: 'let / make 後面的動詞有什麼特別？',
      options: ['人後面直接接原形動詞，不加 to', '要加 to', '要加 -ing'],
      answer: 0,
      why: 'make / let / have + 人 + 原形；get + 人 + to V；have + 物 + 過去分詞（請人處理）。'
    },
    model: null,
    items: [
      { type: 'meaning', s: 'I had my hair cut.', q: '誰剪的頭髮？', options: ['別人（理髮師）幫我剪', '我自己剪', '頭髮自己斷了'], answer: 0, explain: 'have + 物 + 過去分詞 = 請別人處理。' },
      { type: 'meaning', s: 'My parents let me travel alone.', q: '爸媽的態度是？', options: ['允許', '強迫', '禁止'], answer: 0, explain: 'let = 讓、允許；make = 強迫。' },
      { type: 'picture', scene: '👔 ➡️ 🧑‍💻🌙', q: '老闆要我們加班。', options: ['The boss made us work late.', 'The boss made us to work late.', 'The boss made us working late.'], answer: 0, explain: 'make + 人 + 原形 work。' }
    ]
  },
  g27: {
    discover: {
      shown: ['We watched the plane take off.', 'I saw him waiting outside.'],
      q: 'take off 和 waiting 的差別是？',
      options: ['原形 = 看完整個動作；-ing = 看到正在進行的片段', '沒有差別', '-ing 是過去'],
      answer: 0,
      why: '感官動詞 + 受詞 + 原形（從頭到尾）；+ V-ing（正在進行的那一段）。'
    },
    model: null,
    items: [
      { type: 'meaning', s: 'I heard someone knock on the door.', q: '敲門聲你聽完整了嗎？', options: ['聽到完整的敲門', '只聽到一部分', '沒聽到'], answer: 0, explain: '原形 knock = 完整動作。' },
      { type: 'meaning', s: 'I felt the floor shaking.', q: '地板的晃動？', options: ['當時正在晃', '晃完了才感覺到', '沒晃'], answer: 0, explain: 'V-ing = 正在進行。' },
      { type: 'picture', scene: '👀 🏃‍♂️', q: '我看見他跑過馬路。', options: ['I saw him run across the street.', 'I saw him to run across the street.', 'I saw he run across the street.'], answer: 0, explain: '感官動詞 + 受格 him + 原形 run，不加 to。' }
    ]
  },
  g28: {
    discover: {
      shown: ['The movie was boring.', 'I was bored.'],
      q: '-ing 和 -ed 各在描述誰？',
      options: ['-ing 是「讓人有這感覺的東西」，-ed 是「有這感覺的人」', '-ing 是人，-ed 是東西', '一樣'],
      answer: 0,
      why: 'boring 電影（造成無聊）→ bored 的我（感到無聊）。confusing / confused、exciting / excited 都一樣。'
    },
    model: null,
    items: [
      { type: 'picture', scene: '🥱 📺', q: '這個節目很無聊。', options: ['The show is boring.', 'The show is bored.', 'The show is bore.'], answer: 0, explain: '節目造成無聊 → boring。' },
      { type: 'picture', scene: '🤩 ✈️', q: '大家對這趟旅行很興奮。', options: ['Everyone was excited about the trip.', 'Everyone was exciting about the trip.', 'Everyone was excite about the trip.'], answer: 0, explain: '人感到興奮 → excited。' },
      { type: 'meaning', s: 'He is a confusing teacher.', q: '這句在說老師怎樣？', options: ['他讓學生搞不懂', '他自己很困惑', '他很有趣'], answer: 0, explain: 'confusing = 讓人困惑。' }
    ]
  },
  g29: {
    discover: {
      shown: ['He enjoys hiking and swimming.', '✗ He enjoys hiking and to swim.'],
      q: '第二句錯在哪裡？',
      options: ['and 兩邊形式不一致', '少了主詞', 'enjoys 錯了'],
      answer: 0,
      why: '平行結構：and / or / but 連接的兩邊，詞性與形式要一樣（V-ing and V-ing、adj and adj）。'
    },
    model: null,
    items: [
      { type: 'meaning', s: 'The job requires patience, focus, and creativity.', q: '三個被列出的東西是什麼詞性？', options: ['都是名詞', '名詞、形容詞、動詞', '都是形容詞'], answer: 0, explain: '平行：三個都是名詞。' },
      { type: 'picture', scene: '🏃 + 🏊', q: '她喜歡跑步和游泳。', options: ['She likes running and swimming.', 'She likes running and to swim.', 'She likes run and swimming.'], answer: 0, explain: 'and 兩邊都用 V-ing。' },
      { type: 'meaning', s: 'She is not only smart but also reliable.', q: 'smart 和 reliable 的關係？', options: ['兩個都是形容詞，平行', '一個名詞一個動詞', '前後矛盾'], answer: 0, explain: 'not only A but also B，A、B 形式一致。' }
    ]
  },
  g30: {
    discover: {
      shown: ['The box was too heavy to lift.', 'The box was so heavy that I couldn\'t lift it.'],
      q: '兩句的意思？',
      options: ['一樣：箱子重到搬不動', '第一句搬得動', '第二句搬得動'],
      answer: 0,
      why: 'too + adj + to V = 太…以致於不能；so + adj + that + 子句 = 如此…以致於；It is + adj + to V = 做…是…的。'
    },
    model: null,
    items: [
      { type: 'meaning', s: 'He is old enough to drive.', q: '他可以開車嗎？', options: ['可以', '不可以', '看不出來'], answer: 0, explain: 'adj + enough to V = 夠…可以。' },
      { type: 'meaning', s: 'I used to work night shifts.', q: '他現在還上夜班嗎？', options: ['不上了', '還在上', '明天開始上'], answer: 0, explain: 'used to V = 以前常常（現在不了）。' },
      { type: 'picture', scene: '☕ 🔥', q: '咖啡太燙了，不能喝。', options: ['The coffee is too hot to drink.', 'The coffee is very hot to drink.', 'The coffee is too hot to drink it.'], answer: 0, explain: 'too ... to V，後面不再加受詞 it。' }
    ]
  }
}
