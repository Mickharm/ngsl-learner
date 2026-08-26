/**
 * Essentials — everyday usage.
 *
 * The sets you reach for the moment you land somewhere: asking questions,
 * saying where things are, the verb phrases that carry ordinary conversation,
 * and handling money.
 */

export default [
  {
    id: 'e09',
    group: 'question',
    title: '疑問詞與問句語序',
    summary: '會問問題比會回答重要——旅遊時你多半是問的那一方。語序是固定的，記住公式就好。',
    intro: [
      '公式：**疑問詞 + 助動詞 + 主詞 + 動詞原形**。`Where **did you go**?`',
      '助動詞是 do / does / did / be / can / will 等。**助動詞提前，主要動詞回原形**。',
      '**例外**：問句的主詞本身就是疑問詞時，不用助動詞、也不倒裝。`Who called you?`（不是 Who did call you?）',
      '**間接問句要變回直述語序**：`Could you tell me where **the station is**?`（不是 where is the station）。這是禮貌問法，旅遊超實用。'
    ],
    table: {
      caption: '疑問詞',
      head: ['疑問詞', '問什麼', '例句'],
      rows: [
        ['What', '什麼', 'What time does it open?'],
        ['Where', '哪裡', 'Where is the restroom?'],
        ['When', '何時', 'When does the train leave?'],
        ['Who', '誰', 'Who is in charge?'],
        ['Why', '為什麼', 'Why is it closed?'],
        ['How', '如何', 'How do I get there?'],
        ['How much', '多少錢/量', 'How much is this?'],
        ['How many', '多少個', 'How many stops?'],
        ['How long', '多久', 'How long does it take?'],
        ['How far', '多遠', 'How far is the airport?'],
        ['Which', '哪一個', 'Which platform?'],
        ['Whose', '誰的', 'Whose bag is this?']
      ]
    },
    pitfalls: [
      '❌ `Where you are going?` → ✅ `Where are you going?`（助動詞要提前）',
      '❌ `What time it starts?` → ✅ `What time does it start?`',
      '❌ `Can you tell me where is the station?` → ✅ `...where the station is?`（間接問句用直述語序）',
      '❌ `How much people?` → ✅ `How many people?`（可數用 many）'
    ],
    drills: [
      { type: 'choice', q: '_____ does the museum close?', options: ['What time', 'How much', 'Which', 'Whose'], answer: 0, explain: '問時間用 What time。' },
      { type: 'choice', q: 'Could you tell me where _____?', options: ['is the exit', 'the exit is', 'does the exit', 'the exit does be'], answer: 1, explain: '間接問句要用直述語序：the exit is。' },
      { type: 'choice', q: '_____ took my umbrella?', options: ['Who did', 'Who', 'Whom did', 'Who does'], answer: 1, explain: '疑問詞本身就是主詞時不用助動詞：Who took...?' },
      { type: 'choice', q: '_____ does it take to get downtown?', options: ['How far', 'How long', 'How many', 'How much'], answer: 1, explain: '問花費的時間用 How long。' },
      { type: 'correct', wrong: 'Where I can buy a ticket?', answer: 'Where can I buy a ticket?', explain: '助動詞 can 要放在主詞前面。' },
      { type: 'order', tokens: ['how', 'much', 'does', 'this', 'one', 'cost'], answer: 'How much does this one cost', zh: '這個多少錢？' }
    ]
  },

  {
    id: 'e10',
    group: 'place',
    title: '方位介系詞：東西在哪裡',
    summary: '問路、找東西、描述位置都靠這一組。搭配 in / on / at 的地點用法一起記。',
    intro: [
      '**in**（在裡面）／**on**（在表面上）／**at**（在某個點）——和時間那組是同一個由大到小的邏輯。',
      '`in Taipei`（城市內）、`on the second floor`（樓層固定用 on）、`at the station`（把場所當一個點）。',
      '相對位置：**next to**（旁邊）、**between A and B**（兩者之間）、**across from / opposite**（對面）、**behind**（後面）、**in front of**（前面）、**near**（附近）、**around the corner**（轉角處）。',
      '問路必備：`Excuse me, how do I get to ___?` / `Is it far from here?` / `Is it within walking distance?`'
    ],
    table: {
      caption: '常用方位',
      head: ['英文', '中文', '例句'],
      rows: [
        ['next to', '在…旁邊', 'The bank is next to the post office.'],
        ['between A and B', '在 A 和 B 之間', 'It is between the café and the bank.'],
        ['across from', '在…對面', 'The hotel is across from the station.'],
        ['in front of', '在…前面', 'Wait in front of the entrance.'],
        ['behind', '在…後面', 'Parking is behind the building.'],
        ['near / close to', '在…附近', 'Is there a pharmacy near here?'],
        ['on the corner of', '在…轉角', "It's on the corner of Main and 5th."],
        ['upstairs / downstairs', '樓上 / 樓下', 'The restrooms are downstairs.'],
        ['at the end of', '在…盡頭', "It's at the end of this hallway."]
      ]
    },
    pitfalls: [
      '❌ `in the second floor` → ✅ `on the second floor`',
      '❌ `I arrived to the airport` → ✅ `I arrived at the airport`（arrive 配 at/in，不配 to）',
      '❌ `opposite to the station` → ✅ `opposite the station` 或 `across from the station`',
      '❌ `in front of` 不等於 `in the front of`：前者是「在外面前方」，後者是「在內部的前段」。'
    ],
    drills: [
      { type: 'choice', q: 'The pharmacy is _____ the bank and the café.', options: ['among', 'between', 'in', 'across'], answer: 1, explain: '兩者之間用 between A and B。' },
      { type: 'choice', q: 'Our seats are _____ the third row.', options: ['at', 'on', 'in', 'to'], answer: 2, explain: '排、列這種內部位置用 in：in the third row。' },
      { type: 'choice', q: 'We _____ the hotel around midnight.', options: ['arrived to', 'arrived at', 'arrived in to', 'arrive to'], answer: 1, explain: 'arrive 後面接 at（地點）或 in（城市），不接 to。' },
      { type: 'sort', prompt: '這些地點配哪個介系詞？', buckets: ['in', 'on', 'at'],
        items: [
          { t: 'Taipei', b: 'in' }, { t: 'the fifth floor', b: 'on' }, { t: 'the bus stop', b: 'at' },
          { t: 'the room', b: 'in' }, { t: 'the wall', b: 'on' }, { t: 'the airport', b: 'at' }
        ] },
      { type: 'correct', wrong: 'The restroom is in the end of the hallway.', answer: 'The restroom is at the end of the hallway.', explain: '「盡頭」是一個點，用 at the end of。' },
      { type: 'order', tokens: ['the', 'hotel', 'is', 'across', 'from', 'the', 'train', 'station'], answer: 'The hotel is across from the train station', zh: '飯店在火車站對面。' }
    ]
  },

  {
    id: 'e11',
    group: 'phrase',
    title: '高頻動詞片語',
    summary: '母語者講話大量用片語動詞。看得懂單字卻聽不懂句子，多半就卡在這裡。',
    intro: [
      '片語動詞＝**動詞 + 介副詞**，意思常常和字面無關：`look for`（尋找）不是「往…看」。',
      '**可分開的**：受詞是代名詞時必須放中間。`turn it on`（✅）/ `turn on it`（❌）。受詞是名詞時兩種都可以：`turn on the light` = `turn the light on`。',
      '**不可分開的**：`look for`, `look after`, `get on`, `run into`——受詞一律放後面。`look for it`（✅）',
      '學習策略：不要背清單，遇到就記整組搭配。'
    ],
    table: {
      caption: '最常用的片語動詞',
      head: ['片語', '中文', '例句'],
      rows: [
        ['get up', '起床', 'I get up at six.'],
        ['get on / off', '上車 / 下車', 'Get off at the next stop.'],
        ['turn on / off', '開 / 關（電器）', 'Please turn it off.'],
        ['look for', '尋找', "I'm looking for my passport."],
        ['look after', '照顧', 'Can you look after my bag?'],
        ['pick up', '拿取 / 接人', "I'll pick you up at seven."],
        ['drop off', '放下 / 送人到', 'Drop me off here, please.'],
        ['check in / out', '入住 / 退房', 'What time is check-out?'],
        ['fill out', '填寫（表格）', 'Please fill out this form.'],
        ['find out', '查明', 'I need to find out the price.'],
        ['give up', '放棄', "Don't give up."],
        ['run out of', '用完', 'We ran out of cash.'],
        ['take off', '起飛 / 脫下', 'The plane took off late.'],
        ['show up', '出現 / 到場', 'He never showed up.'],
        ['put off', '延後', 'They put off the meeting.'],
        ['work out', '運動 / 順利解決', 'It worked out fine.']
      ]
    },
    pitfalls: [
      '❌ `turn on it` → ✅ `turn it on`（代名詞一定放中間）',
      '❌ `I am looking my key.` → ✅ `I am looking for my key.`',
      '❌ `We ran out cash.` → ✅ `We ran out of cash.`',
      '`take off` 有兩個意思（飛機起飛 / 脫下衣物），靠上下文判斷。'
    ],
    drills: [
      { type: 'choice', q: 'The light is too bright. Could you turn _____?', options: ['off it', 'it off', 'off', 'out it'], answer: 1, explain: '受詞是代名詞 it 時必須放中間：turn it off。' },
      { type: 'choice', q: "I'm _____ my boarding pass. Have you seen it?", options: ['looking', 'looking for', 'looking after', 'finding out'], answer: 1, explain: '「尋找」是 look for。' },
      { type: 'choice', q: 'What time do we have to _____ of the hotel?', options: ['check in', 'check out', 'check up', 'check off'], answer: 1, explain: '退房是 check out。' },
      { type: 'choice', q: 'We _____ gas on the highway.', options: ['ran out', 'ran out of', 'ran of', 'run out'], answer: 1, explain: 'run out of + 名詞，且句子是過去式。' },
      { type: 'correct', wrong: 'Please fill this form out and give back it to me.', answer: 'Please fill this form out and give it back to me.', explain: '代名詞 it 要放在動詞和介副詞中間：give it back。' },
      { type: 'order', tokens: ['can', 'you', 'pick', 'me', 'up', 'at', 'the', 'airport'], answer: 'Can you pick me up at the airport', zh: '你可以來機場接我嗎？' }
    ]
  },

  {
    id: 'e12',
    group: 'money',
    title: '錢、價格與購物',
    summary: '出國一定用得到的一組。重點在數字唸法和幾個固定句型。',
    intro: [
      '價格唸法：`$12.50` = **twelve fifty** 或 twelve dollars (and) fifty cents。`$1,200` = **twelve hundred** 或 one thousand two hundred。',
      '問價格：`How much is it?` / `How much does it cost?` / `What\'s the total?`',
      '付款：`Do you take credit cards?` / `Can I pay by card?` / `Cash or card?` / `Can I get a receipt?`',
      '折扣：`on sale`（特價中）、`20% off`（打八折，注意是「減去 20%」不是「打 2 折」）、`buy one get one free`（買一送一）。',
      '**台灣的「打八折」= 英文的 20% off**，這個換算最容易講錯。'
    ],
    table: {
      caption: '購物常用句',
      head: ['英文', '中文'],
      rows: [
        ['How much is this?', '這個多少錢？'],
        ["I'm just looking, thanks.", '我只是看看，謝謝。'],
        ['Do you have this in a larger size?', '這個有大一號的嗎？'],
        ['Can I try it on?', '可以試穿嗎？'],
        ['Is this on sale?', '這個有特價嗎？'],
        ['Do you take credit cards?', '可以刷卡嗎？'],
        ["I'll take it.", '我要這個。'],
        ['Can I get a receipt?', '可以給我收據嗎？'],
        ['Can I return this?', '這個可以退嗎？'],
        ["It doesn't fit.", '這個不合身。']
      ]
    },
    pitfalls: [
      '❌ `How much money is it?` → ✅ `How much is it?`',
      '❌ `Can I try it?` 語感是「可以試用嗎」；試穿衣服要說 `try it on`。',
      '❌ 「打八折」直譯成 `80% off` 是打二折，差很多 → ✅ `20% off`',
      '❌ `I want this.` 太直接 → ✅ `I\'ll take it.` 或 `Could I get this one?`'
    ],
    drills: [
      { type: 'choice', q: 'How do you read "$24.99"?', options: ['twenty-four ninety-nine', 'twenty-four point ninety-nine', 'two four nine nine', 'twenty-four and ninety-nine'], answer: 0, explain: '價格直接唸「元 + 分」：twenty-four ninety-nine。' },
      { type: 'choice', q: '台灣說「打八折」，英文是：', options: ['80% off', '20% off', '8% off', 'eighty percent price'], answer: 1, explain: '英文說的是「減掉多少」，打八折＝付 80%＝減 20%＝20% off。' },
      { type: 'choice', q: 'You want to try on a shirt. You say:', options: ['Can I try it?', 'Can I try it on?', 'Can I wear it?', 'Can I test it?'], answer: 1, explain: '試穿固定說 try it on。' },
      { type: 'choice', q: 'The cashier asks "Cash or card?" You want to pay by card:', options: ['Card, please.', 'I pay card.', 'By the card.', 'Card money.'], answer: 0, explain: '簡短自然就好：Card, please.' },
      { type: 'correct', wrong: 'How much money does this shirt?', answer: 'How much does this shirt cost?', explain: '問價格用 How much + does + 主詞 + cost，或直接 How much is this shirt?' },
      { type: 'order', tokens: ['do', 'you', 'have', 'this', 'in', 'a', 'larger', 'size'], answer: 'Do you have this in a larger size', zh: '這個有大一號的嗎？' }
    ]
  }
]
