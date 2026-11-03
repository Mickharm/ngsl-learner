/**
 * 主題對話 scenarios.
 *
 * Each one is a situation a beginner will actually meet, with a partner, three
 * concrete goals (what "done" means, so the talk has an end that is not just a
 * turn counter), the partner's opening line, and sentence frames the learner
 * can ask for. Frames are deliberately partial ("I'd like …"): v4 showed a
 * finished example sentence and learners copied it.
 *
 * `script` + `samples` are the offline path (no Gemini key): the partner reads
 * the script in order, and after the talk the learner compares their replies
 * with the samples. With a key the AI plays the partner instead and the script
 * only steers it.
 *
 * area matches settings.articleTopics so the learner's chosen topics decide
 * which scenarios come up.
 */
export const TALK_TOPICS = Object.freeze([
  {
    id: 'cafe', area: 'travel', title: '咖啡店點餐',
    scene_zh: '你在機場的咖啡店，想買早餐帶上飛機。',
    partner: { name: 'Mia', role_en: 'barista at an airport café', role_zh: '咖啡店店員' },
    goals: [
      { zh: '點一杯飲料，說要什麼大小', en: 'order a drink and say the size' },
      { zh: '問有沒有吃的', en: 'ask what food they have' },
      { zh: '問多少錢、說要外帶', en: 'ask the price and say it is to go' }
    ],
    opener: { en: 'Hi there! What can I get for you?', zh: '嗨！要點什麼呢？' },
    frames: ["I'd like a …", 'Do you have …?', 'How much is …?', "It's to …"],
    script: [
      { en: 'Sure. What size would you like?', zh: '好的，要什麼大小？' },
      { en: 'Anything to eat? We have muffins and sandwiches.', zh: '要吃點什麼嗎？我們有馬芬和三明治。' },
      { en: 'Is that for here or to go?', zh: '內用還是外帶？' },
      { en: "That's seven dollars. Have a nice flight!", zh: '一共七美元，祝你旅途愉快！' }
    ],
    samples: ["I'd like a latte, please.", 'A medium, please.', "I'll have a muffin. How much is it?", 'To go, please.', 'Thank you! You too.']
  },
  {
    id: 'hotel', area: 'travel', title: '飯店入住',
    scene_zh: '你剛到飯店櫃檯，要辦入住。',
    partner: { name: 'Daniel', role_en: 'hotel front desk clerk', role_zh: '飯店櫃檯人員' },
    goals: [
      { zh: '說你有訂房，報上名字', en: 'say you have a booking and give your name' },
      { zh: '問早餐幾點、在哪裡', en: 'ask when and where breakfast is' },
      { zh: '問 Wi-Fi 密碼或要求延後退房', en: 'ask for the Wi-Fi password or a late check-out' }
    ],
    opener: { en: 'Good evening! Are you checking in?', zh: '晚安！您要辦入住嗎？' },
    frames: ['I have a …', 'My name is …', 'What time is …?', 'Can I …?'],
    script: [
      { en: 'Thank you. Can I see your passport, please?', zh: '謝謝，可以看一下您的護照嗎？' },
      { en: "You're in room 512. Do you have any questions?", zh: '您住 512 號房。有什麼問題嗎？' },
      { en: 'Breakfast is from seven to ten on the second floor.', zh: '早餐七點到十點，在二樓。' },
      { en: 'No problem. Enjoy your stay!', zh: '沒問題，祝您住得愉快！' }
    ],
    samples: ['Yes. I have a reservation. My name is Chen.', 'Sure. Here you are.', 'What time is breakfast?', "What's the Wi-Fi password?", 'Thank you very much.']
  },
  {
    id: 'directions', area: 'travel', title: '問路',
    scene_zh: '你在陌生的城市找不到火車站，一位路人來幫你。',
    partner: { name: 'Grace', role_en: 'friendly local on the street', role_zh: '路上的當地人' },
    goals: [
      { zh: '說你要去哪裡', en: 'say where you want to go' },
      { zh: '問怎麼走、要走多久', en: 'ask how to get there and how long it takes' },
      { zh: '確認路線並道謝', en: 'repeat the way back to check, and say thanks' }
    ],
    opener: { en: 'Hi, you look a little lost. Can I help you?', zh: '嗨，你看起來有點迷路，需要幫忙嗎？' },
    frames: ["I'm looking for …", 'How do I get to …?', 'How long does it …?', 'So I go …'],
    script: [
      { en: 'The train station? Go straight and turn left at the bank.', zh: '火車站嗎？直走，在銀行那裡左轉。' },
      { en: "It's about ten minutes on foot.", zh: '走路大約十分鐘。' },
      { en: "Yes, that's right. You can't miss it.", zh: '對，沒錯，你一定找得到。' },
      { en: "You're welcome. Have a good day!", zh: '不客氣，祝你有美好的一天！' }
    ],
    samples: ["Yes, please. I'm looking for the train station.", 'How do I get there?', 'How long does it take?', 'So I go straight and turn left at the bank?', 'Thank you so much!']
  },
  {
    id: 'restaurant', area: 'travel', title: '餐廳點餐',
    scene_zh: '你和一位朋友走進一家餐廳吃晚餐。',
    partner: { name: 'Leo', role_en: 'server at a restaurant', role_zh: '餐廳服務生' },
    goals: [
      { zh: '說有幾位', en: 'say how many people' },
      { zh: '問推薦什麼，然後點主餐', en: 'ask for a recommendation and order a main dish' },
      { zh: '要求結帳', en: 'ask for the bill' }
    ],
    opener: { en: 'Good evening! How many people?', zh: '晚安！請問幾位？' },
    frames: ['A table for …', 'What do you …?', "I'll have the …", 'Can I have the …?'],
    script: [
      { en: 'Right this way. Here is the menu. Are you ready to order?', zh: '這邊請，這是菜單。準備好點餐了嗎？' },
      { en: 'Our steak and the fish soup are very popular.', zh: '我們的牛排和魚湯很受歡迎。' },
      { en: 'Great choice. Anything to drink?', zh: '好選擇。要喝點什麼嗎？' },
      { en: "Sure, I'll bring the bill right away.", zh: '好的，我馬上拿帳單來。' }
    ],
    samples: ['A table for two, please.', 'What do you recommend?', "I'll have the fish soup, please.", 'Just water, please. Can I have the bill?', 'Thank you.']
  },
  {
    id: 'shopping', area: 'daily', title: '買衣服',
    scene_zh: '你在服飾店想買一件外套。',
    partner: { name: 'Lisa', role_en: 'shop assistant in a clothing store', role_zh: '服飾店店員' },
    goals: [
      { zh: '說你在找什麼', en: 'say what you are looking for' },
      { zh: '問有沒有別的尺寸或顏色', en: 'ask about another size or colour' },
      { zh: '問價錢、能不能刷卡', en: 'ask the price and whether you can pay by card' }
    ],
    opener: { en: 'Hello! Are you looking for anything special today?', zh: '你好！今天想找什麼嗎？' },
    frames: ["I'm looking for …", 'Do you have this in …?', 'Can I try …?', 'Can I pay by …?'],
    script: [
      { en: 'Our jackets are over here. What size are you?', zh: '外套在這邊。你穿什麼尺寸？' },
      { en: 'We have it in black and blue. Would you like to try it on?', zh: '這件有黑色和藍色。要試穿看看嗎？' },
      { en: "It's sixty dollars. It's on sale today.", zh: '六十美元，今天有特價。' },
      { en: 'Yes, of course. Thank you for shopping with us!', zh: '當然可以，謝謝光臨！' }
    ],
    samples: ["I'm looking for a jacket.", 'Medium. Do you have this in black?', 'Yes, please. How much is it?', 'Can I pay by card?', 'Great, thank you.']
  },
  {
    id: 'weekend', area: 'daily', title: '聊週末',
    scene_zh: '星期一早上，同事在茶水間問你週末過得怎樣。',
    partner: { name: 'Sam', role_en: 'friendly coworker', role_zh: '同事' },
    goals: [
      { zh: '說你週末做了什麼（用過去式）', en: 'say what you did at the weekend (past tense)' },
      { zh: '說感覺怎麼樣、為什麼', en: 'say how it was and why' },
      { zh: '反問對方的週末', en: 'ask about their weekend' }
    ],
    opener: { en: 'Morning! How was your weekend?', zh: '早！週末過得怎麼樣？' },
    frames: ['It was …', 'I went to …', 'Because …', 'How about …?'],
    script: [
      { en: 'Oh nice! What did you do?', zh: '不錯喔！你做了什麼？' },
      { en: 'Sounds fun. Did you like it?', zh: '聽起來很好玩，你喜歡嗎？' },
      { en: 'I stayed home and watched movies. It was relaxing.', zh: '我待在家看電影，很放鬆。' },
      { en: 'Well, back to work. See you at lunch!', zh: '好啦，回去工作，午餐見！' }
    ],
    samples: ['It was great, thanks.', 'I went to the beach with my family.', 'Yes, I liked it because the weather was nice.', 'How about you? What did you do?', 'See you!']
  },
  {
    id: 'newcolleague', area: 'work', title: '認識新同事',
    scene_zh: '公司來了一位外國新同事，你們第一次聊天。',
    partner: { name: 'Alex', role_en: 'new colleague from Canada', role_zh: '新同事（來自加拿大）' },
    goals: [
      { zh: '介紹你的名字和工作', en: 'introduce your name and job' },
      { zh: '說你負責什麼工作', en: 'say what you work on' },
      { zh: '問對方一個問題', en: 'ask them a question' }
    ],
    opener: { en: "Hi, I'm Alex. I just started here today.", zh: '嗨，我是 Alex，今天剛來上班。' },
    frames: ["Nice to meet you. I'm …", 'I work as …', 'I work on …', 'Where are you …?'],
    script: [
      { en: 'Nice to meet you too! What do you do here?', zh: '也很高興認識你！你在這裡做什麼？' },
      { en: 'Interesting. How long have you worked here?', zh: '很有趣。你在這裡工作多久了？' },
      { en: "I'm from Toronto. It's very cold there in winter!", zh: '我來自多倫多，那裡冬天很冷！' },
      { en: 'Thanks for the chat. See you around!', zh: '謝謝你陪我聊天，再見！' }
    ],
    samples: ["Nice to meet you. I'm Kai.", "I'm an engineer. I work on the factory systems.", "About three years. Where are you from?", 'Wow. Welcome to Taiwan!', 'See you!']
  },
  {
    id: 'problem', area: 'work', title: '回報問題',
    scene_zh: '系統出了問題，主管打電話來問你狀況。',
    partner: { name: 'Kevin', role_en: 'your manager', role_zh: '主管' },
    goals: [
      { zh: '說哪裡出了問題', en: 'say what is wrong' },
      { zh: '說你已經做了什麼', en: 'say what you have done' },
      { zh: '說什麼時候可以修好', en: 'say when it will be fixed' }
    ],
    opener: { en: "Hi, I heard there's a problem. What happened?", zh: '嗨，聽說出問題了，發生什麼事？' },
    frames: ["The … doesn't work.", 'I checked …', 'I think it will …', 'I will send …'],
    script: [
      { en: 'I see. What have you tried so far?', zh: '了解。你目前試過什麼？' },
      { en: 'OK. When do you think it will be fixed?', zh: '好，你覺得什麼時候能修好？' },
      { en: 'Good. Please send me an update by email.', zh: '很好，請用 email 跟我更新進度。' },
      { en: 'Thanks for your hard work.', zh: '辛苦了，謝謝。' }
    ],
    samples: ["The server doesn't work. Users can't log in.", 'I checked the logs and restarted the server.', 'I think it will be fixed in one hour.', 'OK. I will send you an email.', 'No problem.']
  },
  {
    id: 'plans', area: 'daily', title: '約朋友吃飯',
    scene_zh: '外國朋友傳訊息約你這週吃飯。',
    partner: { name: 'Jenny', role_en: 'a friend from your English class', role_zh: '英文課認識的朋友' },
    goals: [
      { zh: '約一個時間', en: 'agree on a day and time' },
      { zh: '決定吃什麼或去哪裡', en: 'choose what to eat or where' },
      { zh: '確認在哪裡碰面', en: 'agree where to meet' }
    ],
    opener: { en: 'Hey! Do you want to have dinner this week?', zh: '嘿！這週要不要一起吃晚餐？' },
    frames: ['Sure! How about …?', "I'm free on …", 'Do you like …?', "Let's meet at …"],
    script: [
      { en: 'Friday works for me. What time?', zh: '我星期五可以。幾點？' },
      { en: 'Great. What do you want to eat?', zh: '好啊，你想吃什麼？' },
      { en: 'Sounds good! Where should we meet?', zh: '聽起來不錯！要在哪裡碰面？' },
      { en: 'Perfect. See you on Friday!', zh: '太好了，星期五見！' }
    ],
    samples: ["Sure! I'm free on Friday.", 'How about seven?', 'Do you like hot pot?', "Let's meet at the MRT station.", 'See you!']
  },
  {
    id: 'pharmacy', area: 'travel', title: '藥局買藥',
    scene_zh: '旅行時你感冒了，走進一間藥局。',
    partner: { name: 'Mr. Brown', role_en: 'pharmacist', role_zh: '藥劑師' },
    goals: [
      { zh: '說你哪裡不舒服', en: 'say how you feel' },
      { zh: '問這個藥怎麼吃', en: 'ask how to take the medicine' },
      { zh: '問多少錢並道謝', en: 'ask the price and say thanks' }
    ],
    opener: { en: 'Hello. How can I help you?', zh: '你好，需要什麼幫忙嗎？' },
    frames: ['I have a …', 'I feel …', 'How often should I …?', 'How much …?'],
    script: [
      { en: 'I see. How long have you felt like this?', zh: '了解。這樣多久了？' },
      { en: 'This medicine should help.', zh: '這個藥應該有幫助。' },
      { en: 'Take one pill three times a day, after meals.', zh: '一天三次，每次一顆，飯後吃。' },
      { en: "That's eight dollars. Get some rest!", zh: '八美元，好好休息！' }
    ],
    samples: ['I have a cold. I have a sore throat.', 'Since yesterday.', 'How often should I take it?', 'OK. How much is it?', 'Thank you.']
  }
])

export const TALK_BY_ID = Object.freeze(Object.fromEntries(TALK_TOPICS.map(t => [t.id, t])))

/** Learner replies per conversation, and the per-reply character cap. */
export const TALK_TURNS = 5
export const TALK_MAX_CHARS = 140
/** After this many replies the learner may end early. */
export const TALK_MIN_TURNS = 3

/**
 * Today's topic: deterministic per learner and day (leaving and coming back
 * keeps it), restricted to the learner's chosen areas, and never one of the
 * last few they talked about.
 */
export function pickTopic ({ day = '', user = '', areas = [], recent = [], shift = 0 } = {}) {
  let pool = TALK_TOPICS.filter(t => !areas.length || areas.includes(t.area))
  if (!pool.length) pool = [...TALK_TOPICS]
  const fresh = pool.filter(t => !recent.slice(-4).includes(t.id))
  if (fresh.length) pool = fresh
  let h = 2166136261
  for (const ch of `${user}|${day}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) }
  return pool[((h >>> 0) + shift) % pool.length]
}
