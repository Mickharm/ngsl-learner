/**
 * Essentials — time and number.
 *
 * These are closed sets: unlike open vocabulary, there are exactly twelve
 * months and exactly three time prepositions, so they can genuinely be
 * finished. That makes them the highest-value thing a 450-word learner can
 * spend a week on, and none of it is reachable through NGSL flashcards.
 */

export default [
  {
    id: 'e01',
    group: 'time',
    title: '時間介系詞：at / on / in',
    summary: '三個字，一條規則：範圍越小用越短的字。中文沒有這個區分，所以要靠規則不是語感。',
    intro: [
      '**in** 用在大範圍：年、季節、月、一天中的時段（in 2026, in summer, in July, in the morning）。',
      '**on** 用在特定某一天：星期、日期、節日（on Monday, on May 5, on my birthday）。',
      '**at** 用在一個時間點：幾點鐘、用餐時間（at 7:30, at noon, at night）。',
      '記憶方式：**in 月 > on 日 > at 點**。範圍越小，字越短。'
    ],
    table: {
      caption: '常用搭配',
      head: ['at', 'on', 'in'],
      rows: [
        ['at 6 o’clock', 'on Monday', 'in April'],
        ['at noon', 'on May 5', 'in 2026'],
        ['at night', 'on Friday night', 'in the morning'],
        ['at lunchtime', 'on my birthday', 'in winter'],
        ['at the moment', 'on New Year’s Day', 'in two weeks']
      ]
    },
    pitfalls: [
      '❌ `in Monday` → ✅ `on Monday`（星期用 on）',
      '❌ `on night` → ✅ `at night`（但 `on Friday night` 是對的）',
      '❌ `at July` → ✅ `in July`',
      '中文「早上七點」拆成兩層：`at seven` **in** `the morning`。'
    ],
    drills: [
      { type: 'sort', prompt: '把下面的時間放進正確的介系詞', buckets: ['at', 'on', 'in'],
        items: [
          { t: '8:15', b: 'at' }, { t: 'Tuesday', b: 'on' }, { t: 'March', b: 'in' },
          { t: 'noon', b: 'at' }, { t: '2025', b: 'in' }, { t: 'my birthday', b: 'on' },
          { t: 'the evening', b: 'in' }, { t: 'night', b: 'at' }, { t: 'January 1', b: 'on' }
        ] },
      { type: 'choice', q: 'The store opens _____ 9 a.m. _____ weekdays.', options: ['at / on', 'on / at', 'in / on', 'at / in'], answer: 0, explain: '幾點用 at，星期幾用 on。' },
      { type: 'choice', q: 'We usually travel _____ summer.', options: ['at', 'on', 'in', 'to'], answer: 2, explain: '季節屬於大範圍，用 in。' },
      { type: 'choice', q: 'The meeting is _____ Friday afternoon.', options: ['at', 'on', 'in', 'by'], answer: 1, explain: '指定某一天的某個時段，整組用 on：on Friday afternoon。' },
      { type: 'correct', wrong: 'I will call you in Monday morning.', answer: 'I will call you on Monday morning.', explain: '有指定星期時用 on，即使後面接 morning。' },
      { type: 'correct', wrong: 'She was born on 1998.', answer: 'She was born in 1998.', explain: '年份用 in。' },
      { type: 'order', tokens: ['the', 'flight', 'leaves', 'at', 'six', 'in', 'the', 'morning'], answer: 'The flight leaves at six in the morning', zh: '班機早上六點起飛。' }
    ]
  },

  {
    id: 'e02',
    group: 'time',
    title: '月份、星期、日期',
    summary: '封閉的 19 個字，背完就永遠夠用。重點是日期的「說法」和「寫法」不一樣。',
    intro: [
      '月份和星期**開頭一律大寫**，這點和中文習慣不同，寫 email 時很容易被看出來。',
      '日期用**序數**唸：May 5 寫出來是 5，但唸作 **May fifth**。',
      '美式寫法 `May 5, 2026`（月/日/年），英式寫法 `5 May 2026`（日/月/年）。TOEIC 兩種都會出現。',
      '常用縮寫：Jan. Feb. Mar. Apr. Jun. Jul. Aug. Sep. Oct. Nov. Dec.（May 不縮寫）。'
    ],
    table: {
      caption: '十二個月 / 七天',
      head: ['月份', '縮寫', '星期'],
      rows: [
        ['January 一月', 'Jan.', 'Monday 週一'],
        ['February 二月', 'Feb.', 'Tuesday 週二'],
        ['March 三月', 'Mar.', 'Wednesday 週三'],
        ['April 四月', 'Apr.', 'Thursday 週四'],
        ['May 五月', '—', 'Friday 週五'],
        ['June 六月', 'Jun.', 'Saturday 週六'],
        ['July 七月', 'Jul.', 'Sunday 週日'],
        ['August 八月', 'Aug.', ''],
        ['September 九月', 'Sep.', ''],
        ['October 十月', 'Oct.', ''],
        ['November 十一月', 'Nov.', ''],
        ['December 十二月', 'Dec.', '']
      ]
    },
    pitfalls: [
      '❌ `january` → ✅ `January`（月份星期永遠大寫）',
      '❌ 唸成 `May five` → ✅ `May fifth`（日期唸序數）',
      '❌ `next Friday` 的意思很模糊，講清楚說 `this coming Friday` 或直接講日期。',
      'Wednesday 的 d 不發音，唸 /ˈwenzdeɪ/。'
    ],
    drills: [
      { type: 'choice', q: 'The conference is on _____ 12.', options: ['september', 'September', 'Septembre', 'Sept'], answer: 1, explain: '月份必須大寫，且拼字是 September。' },
      { type: 'choice', q: 'How do you say "March 3"?', options: ['March three', 'March third', 'Third March', 'The March three'], answer: 1, explain: '日期唸序數：third。' },
      { type: 'choice', q: 'Which day comes right after Wednesday?', options: ['Tuesday', 'Thursday', 'Friday', 'Sunday'], answer: 1, explain: 'Monday → Tuesday → Wednesday → Thursday。' },
      { type: 'sort', prompt: '這些是月份還是星期？', buckets: ['月份 Month', '星期 Day'],
        items: [
          { t: 'August', b: '月份 Month' }, { t: 'Saturday', b: '星期 Day' },
          { t: 'February', b: '月份 Month' }, { t: 'Thursday', b: '星期 Day' },
          { t: 'October', b: '月份 Month' }, { t: 'Sunday', b: '星期 Day' }
        ] },
      { type: 'correct', wrong: 'My flight is on june 21.', answer: 'My flight is on June 21.', explain: '月份開頭大寫。' },
      { type: 'order', tokens: ['the', 'office', 'is', 'closed', 'on', 'Sunday', 'in', 'August'], answer: 'The office is closed on Sunday in August', zh: '辦公室八月的週日不開。' }
    ]
  },

  {
    id: 'e03',
    group: 'number',
    title: '數字：基數與序數',
    summary: '會唸數字才報得出價格、樓層、日期、電話。序數只有前面幾個不規則，其餘加 -th。',
    intro: [
      '**基數**（數量）：one, two, three… **序數**（順序）：first, second, third…',
      '不規則的只有三個：**one→first, two→second, three→third**。其餘規則：four→four**th**, five→fif**th**, eight→eigh**th**, nine→nin**th**, twelve→twelf**th**, twenty→twentie**th**。',
      '13-19 重音在後（thir**teen**），20-90 重音在前（**thir**ty）。這是聽力最常混的一組。',
      '大數字三位一組：1,234 = one thousand two hundred (and) thirty-four。100 以上的 hundred/thousand **不加 s**：`three hundred`，不是 `three hundreds`。'
    ],
    table: {
      caption: '基數 vs 序數',
      head: ['數字', '基數', '序數'],
      rows: [
        ['1', 'one', 'first (1st)'],
        ['2', 'two', 'second (2nd)'],
        ['3', 'three', 'third (3rd)'],
        ['4', 'four', 'fourth (4th)'],
        ['5', 'five', 'fifth (5th)'],
        ['8', 'eight', 'eighth (8th)'],
        ['9', 'nine', 'ninth (9th)'],
        ['12', 'twelve', 'twelfth (12th)'],
        ['20', 'twenty', 'twentieth (20th)'],
        ['21', 'twenty-one', 'twenty-first (21st)']
      ]
    },
    pitfalls: [
      '❌ `three hundreds people` → ✅ `three hundred people`',
      '❌ `the five floor` → ✅ `the fifth floor`（樓層用序數）',
      '13 vs 30：thir**teen** /θɜːrˈtiːn/ 重音在後；**thir**ty /ˈθɜːrti/ 重音在前。',
      '❌ `fiveth` → ✅ `fifth`；❌ `nineth` → ✅ `ninth`'
    ],
    drills: [
      { type: 'choice', q: 'Our office is on the _____ floor.', options: ['nine', 'ninth', 'nineth', 'the nine'], answer: 1, explain: '樓層用序數，nine 的序數是 ninth（去掉 e）。' },
      { type: 'choice', q: 'There were _____ people at the event.', options: ['two hundreds', 'two hundred', 'two-hundreds', 'second hundred'], answer: 1, explain: 'hundred 前面有明確數字時不加 s。' },
      { type: 'choice', q: 'Which is the ordinal for 12?', options: ['twelveth', 'twelfth', 'twelth', 'twelvth'], answer: 1, explain: 'twelve → twelfth，ve 變 f。' },
      { type: 'choice', q: 'You want "30", not "13". Which stress is right for 30?', options: ['thir-TY', 'THIR-ty', 'both same', 'THIR-teen'], answer: 1, explain: '20-90 重音在前：THIR-ty。13-19 重音在後：thir-TEEN。' },
      { type: 'correct', wrong: 'This is my three visit to Japan.', answer: 'This is my third visit to Japan.', explain: '「第三次」要用序數 third。' },
      { type: 'order', tokens: ['we', 'booked', 'a', 'room', 'on', 'the', 'twenty-first', 'floor'], answer: 'We booked a room on the twenty-first floor', zh: '我們訂了二十一樓的房間。' }
    ]
  },

  {
    id: 'e04',
    group: 'time',
    title: '幾點幾分怎麼說',
    summary: '旅遊時最常需要聽懂和說出的一組。有兩種說法，先掌握「直接唸數字」那種。',
    intro: [
      '**最簡單也最通用**：直接唸數字。7:15 = **seven fifteen**。9:05 = **nine oh five**（0 唸 oh）。',
      '**傳統說法**：分鐘 ≤ 30 用 **past**，> 30 用 **to**。7:15 = a quarter **past** seven；7:45 = a quarter **to** eight（注意變成八點了）。',
      '整點：7:00 = seven o’clock。半點：7:30 = half past seven。',
      '**a.m. / p.m.** 分上下午。12:00 中午是 noon，凌晨 12 點是 midnight。',
      '問時間：`What time is it?` / `Do you have the time?`（後者是問幾點，不是問「你有空嗎」）。'
    ],
    table: {
      caption: '兩種說法',
      head: ['時間', '直接唸', '傳統說法'],
      rows: [
        ['7:00', 'seven', "seven o'clock"],
        ['7:05', 'seven oh five', 'five past seven'],
        ['7:15', 'seven fifteen', 'a quarter past seven'],
        ['7:30', 'seven thirty', 'half past seven'],
        ['7:45', 'seven forty-five', 'a quarter to eight'],
        ['7:50', 'seven fifty', 'ten to eight'],
        ['12:00', 'twelve', 'noon / midnight']
      ]
    },
    pitfalls: [
      '❌ `a quarter to seven` 指 6:45，不是 7:15。to 是「差幾分到下一個整點」。',
      '❌ `seven clock` → ✅ `seven o’clock`',
      '❌ `What time do you have?` 語感怪 → ✅ `Do you have the time?`',
      '寫 12 小時制要標 a.m./p.m.，否則對方無從判斷。'
    ],
    drills: [
      { type: 'choice', q: 'What time is "a quarter to nine"?', options: ['9:15', '8:45', '9:45', '8:15'], answer: 1, explain: 'to = 差幾分到下一個整點，所以是 8:45。' },
      { type: 'choice', q: 'How do you read 6:05?', options: ['six five', 'six oh five', 'six zero five', 'six and five'], answer: 1, explain: '個位數分鐘前面的 0 唸 oh。' },
      { type: 'choice', q: 'The train leaves at 10:30. That is _____.', options: ['half to ten', 'half past ten', 'half past eleven', 'ten and half'], answer: 1, explain: '半點固定說 half past + 該小時。' },
      { type: 'sort', prompt: '這些時間是上午還是下午？', buckets: ['a.m.', 'p.m.'],
        items: [
          { t: 'breakfast at 7', b: 'a.m.' }, { t: 'dinner at 7', b: 'p.m.' },
          { t: 'midnight', b: 'a.m.' }, { t: 'afternoon tea at 3', b: 'p.m.' }
        ] },
      { type: 'correct', wrong: 'The meeting starts at eight clock.', answer: "The meeting starts at eight o'clock.", explain: "整點要說 o'clock，不能省略 o'。" },
      { type: 'order', tokens: ['the', 'last', 'bus', 'leaves', 'at', 'a', 'quarter', 'past', 'eleven'], answer: 'The last bus leaves at a quarter past eleven', zh: '末班車十一點十五分開。' }
    ]
  }
]
