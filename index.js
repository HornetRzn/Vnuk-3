const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');
const NOTIFICATION_CHAT_ID = "-1002311068598"; // Замените на ваш ID

if (!process.env.TOKEN) throw new Error('TOKEN не установлен!');
if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY не установлен!');

const app = express();
app.use(express.json());
app.listen(process.env.PORT || 3000);

const bot = new Telegraf(process.env.TOKEN);

// Вебхук для Render
const webhookPath = `/telegraf/${bot.secretPathComponent()}`;
const webhookUrl = `https://vnuk-3.onrender.com${webhookPath}`;
bot.telegram.setWebhook(webhookUrl).catch(console.error);
app.use(bot.webhookCallback(webhookPath));

// Хранилища состояний
const userSessions = new Map();
const privateChatUsers = new Map();
const SESSION_TIMEOUT = 15 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  userSessions.forEach((session, key) => {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      userSessions.delete(key);
      console.log(`Сессия ${key} удалена по таймауту`);
    }
  });
}, 5 * 60 * 1000);

const settings = {
  privateChatResponse: 'Я не стеснительный, поэтому люблю публичное общение 😎 Подписывайся на «ГЕЙ-РЯЗАНЬ» — https://t.me/hornetrzn',

  keywords: {
    'в рот': [
      'В Песочне раньше жил пацанчик, тоже любил оральное мастерство. В прошлый вторник задохнулся от оргазма 😭',
      'Длинный и толстенький?',
      'Я на пл. Победы (чуть правее клуба «Deep») прошлой осенью ночью оформился с рандомным незнакомцем 🍆👀 бывает же такое…',
      'Ты забыл какое время сейчас идёт? Ни капли в рот, ни миллиметра в жопу 🤫',
      'Я бы отсосал у Юры Борисова. У него, наверное, маленький член, но лысики меня прям заводят 🤤',
      'Глубоко? Прям в горло?',
      'Прально. Это практичнее  ☝🏻 ни клизма не нужна, ни подготовка.',
      'Кстати. Ты в курсе, что от горлового минета залететь можно? Даже парню 😳',
      'В Рязани вариантов ПОЛНО 😎 я в Тамбове жил 4 года, вот там конкретная бездна(((',
      'Прям как в лютом гей-порно?'
    ],
    'сообщали': [
      'Пока меня дед не перевёз в Рязань из Тамбова, я вообще жил в вакууме. Думал, что я – единственный гей 👀',
      'Самое интересное – мало таких геев, которые могут признаться себе в том, что они полигамны. А полигамны МЫ ВСЕ! 😬',
      'Когда я дрочу, часто думаю об этом. Думать – это вообще моя самая хуёвая привычка.',
      'И тут все дружно вздрочнули 💦',
      'А судьи кто?',
      'В Рязани тоже много раз такое было. Кстати, я ничего не имею против людей с беспорядочной сексуальной жизнью 🤤',
      'История про моего деда буквально.',
      'Читаю новости и понимаю, как хочется близости с тем, кому я и не нужен-то, по большому счёту 🤧',
      'Я вчера посчитал количество своих парней в оральном и анальном. Не знаю, зачем это пишу. Просто хочу, чтобы вы знали: человек в ахуе!',
       'У меня не было секса уже 12 часов. Держу в курсе 🕛'
    ],
    'сексану': [
      'Давненько ты в поисках, я смотрю 🧐 НЕ КЛЮЁТ?',
      'А пассивчика не пробовал на активный анал развести?',
      'В Рязани все активы в спячке до осени, я заметил. Кривые какие-то активы. Странные.',
      'Ну хотя бы виртом займись, раз не клюёт 💁🏼‍♂️ может, вздрочнём в видеочате?',
      'С молодым хочешь или с мужичком опытным? Мм?',
      'И лучше экстрим!!!',
      'Ты на деда моего похож. Того самого – Пошлого (ветерана гей-тусовки).',
      'Только с одним? Что так хиленько-то … 🥴',
      'Ты ж только позавчера трахался! Держи пост!!!!',
       'Всю ночь? Выдержишь??'
    ],
    'есть пасс': [
      'А какой возраст интересует? 🧐',
      'Орально или анально?',
      'Скоро лето. Парней можно будет прямо на рязанских улицах снимать, без всяких чятикоф 🤤',
      'Без презерватива нужно. Оценить, так сказать, полное погружение 💦',
      'Давно ищешь-то?',
      'Может, без секса? Полежим где-нибудь, кальян покурим, пососём(ся) 🤤',
      'В Канищево поехали! Прям не район, а гей-столица Рязанского региона 💪🏾',
      'Мне вот почему-то нравятся  хуястые пассивы. Ничего поделать с собой не могу 👿 других я почти и не трахал.',
      'Дед меня никуда не пускает до субботы, а так – я бы выебал(ся) с удовольствием 🫦',
      ' Гость Рязани, наверное 🧐'
    ],
    'я пасс': [
      'А какой возраст интересует? 🧐',
      'Орально или анально?',
      'Скоро лето. Парней можно будет прямо на рязанских улицах снимать, без всяких чятикоф 🤤',
      'Без презерватива нужно. Оценить, так сказать, полное погружение 💦',
      'Давно ищешь-то?',
      'Может, без секса? Полежим где-нибудь, кальян покурим, пососём(ся) 🤤',
      'В Канищево поехали! Прям не район, а гей-столица Рязанского региона 💪🏾',
      'Мне вот почему-то нравятся  хуястые пассивы. Ничего поделать с собой не могу 👿 других я почти и не трахал.',
      'Дед меня никуда не пускает до субботы, а так – я бы выебал(ся) с удовольствием 🫦',
      ' Гость Рязани, наверное 🧐'
    ],
    'на авто': [
      'Давай в рот дам 🧐',
      'Секс в машине так возбуждает?',
      'В тачке максимум отсос можно оформить. Анально в этих апартаментах не развернуться 💁🏼‍♂️',
      'Ты прям как Илья Слёзкин))',
      'Сергей Серёгин, ты ли это???',
      'Ебался когда-нибудь с парнем в движущемся автомобиле?',
      'Встретиться всего на 10 минут и кончить…',
      'У тебя всего двое парней было за всю жизнь. И те с рязанских окраин, обиженных всеми гей-богами Вселенной 😏',
      'Дрочево! Необходимо жёсткое получасовое дрочево!',
      'Хорошие и опытные пассивы давно перевелись на земле рязанской 💁🏼‍♂️',
      'Гей-оргия нужна! По парам уже неинтересно. Гоу паравозиком ебаться 😜',
      'Щас бы двух пассов спортивненьких… и хуястых желательно 🫦'
    ],
    'борми': 'CAACAgEAAxkBAAEBIi9nydkVOnLuwLv4TFU1VlYmgf5ilgACBwYAAoAPiUWHGBVJ2wPLITYE',
    'дрочить': 'CAACAgEAAxkBAAEBIydnzC7ui4tSb1jo9VKcTTBt4hj6ZwAC7gMAAgZkiUVQqbcMExNFMDYE',
    'пидор': 'CAACAgEAAxkBAAEBIitnybXyhd0-YWqfmucolWHhI-7ERgACSQUAAqowiUX9KXev6BUQ4DYE',
    'минет': 'CAACAgEAAxkBAAEBIilnybXMx5P1glipjfoF54XEk6ObAgACPgQAAtoqiEW0evyXoXMyTjYE',
    'отсосет': 'CAACAgEAAxkBAAEBIilnybXMx5P1glipjfoF54XEk6ObAgACPgQAAtoqiEW0evyXoXMyTjYE',
    'отсосу': 'CAACAgEAAxkBAAEBIilnybXMx5P1glipjfoF54XEk6ObAgACPgQAAtoqiEW0evyXoXMyTjYE',
    'есть пассив': 'CAACAgEAAxkBAAEBIj9nydntX-FbHGuMsXQYC3wOBqS1pgACywQAAucFiUUDrQ6MGpGJ-DYE',
    'мои параметры': 'CAACAgEAAxkBAAEBIyNnzC5XVT0tpXPDCU2b7Cgfs28RdgACmwUAAkK8iUUIqRWiJOAkcTYE',
'твои параметры': 'CAACAgEAAxkBAAEBIlFnydvm0vfeMaIaTYsS8RMVfnEuQAACNwUAApeIiUViX-hXqLibkTYE',
'познакомлюсь': 'CAACAgEAAxkBAAEBIkNnydp0WA9y6WvAJ4jYyazfkh9SkgACQgcAAtzFiUUGHxbLwu8XpzYE',
'хуястый': 'CAACAgEAAxkBAAEBIzBnzDBilaEoh7MDOkpCieojmGrclAAC3AUAAsWRiUV7OoOTGye41jYE',
    'ищу': 'CAACAgEAAxkBAAEBIkNnydp0WA9y6WvAJ4jYyazfkh9SkgACQgcAAtzFiUUGHxbLwu8XpzYE',
    'группу': 'CAACAgEAAxkBAAEBIkVnydrZrIHYiixFyhvpxuIwqsMudQACdAUAApwGiEVsVYAE9s962jYE',
    'ты на хуй': 'CAACAgEAAxkBAAEBIktnydszBNCtCYB0MOBNFYWRbf7k5gACmgQAAggVkEUMFO0AAQspTcU2BA',
    'доброе утро': 'CAACAgEAAxkBAAEBIk1nydttIprLic-RnT0kM0lZci0GBAACfwgAAvZhiEULB5CW30ssjzYE',
    'это любовь': 'CAACAgEAAxkBAAEBIk9nydu0e7Y97rwQbyBLx2xsw20UMgAC1wQAAumDiUWFuyREL2OJkzYE',
    'в жопу': 'CAACAgEAAxkBAAEBIitnybXyhd0-YWqfmucolWHhI-7ERgACSQUAAqowiUX9KXev6BUQ4DYE',
    'большие члены': 'CAACAgEAAxkBAAEBIldnyd0-zjVSv7VQqpRW_zey34gV3AACggQAAsROiUWOWDYuFvxkkjYE'
  },
  farewellMessages: [
    'Ладно, пацан. Секса от тебя не добьёшься. Пойду вздрочну 😏',
    'Чёта я утомился. Позже договорим 🤨',
    'Ты пока из Рзн никуда не собираешься? Я через пару дней напишу, можт. Поебёмся 😈',
    'Какой-то неопределённый ты. Утомил 🤨 так много вопросов и так мало сути… я ушёл смотреть гей-порно. На хаб сегодня завезли новинки',
    'Что-то ты мне подозрительным кажешься. Долгое пиздабольство напрягает прям 👀 нужно быть осторожнее. Вот тут ваши парни писали уже 👉🏻 https://t.me/hornetrzn/654 👈🏻 пойду поосторожничаю малость',
    'Парнишка ты интересный, конечно. Давай позже пообщаемся, а то ко мне два пассика из  Коломны приехали. Нужно накормить 🍆',
    'Странные мысли у тебя 👀 Слушай, зайкамая… заполни анкету, даже если ты не из Рязани 👉🏻 https://t.me/hornetrzn/805 👈🏻 позже поболтаем! Письками 😆',
    'Хватит на сегодня. А то член отвалится 😏',
    'Упс… кажется, меня пришли трахать. Извини, но пока не до тебя 👋🏼'
  ],
  dialogResponses: {
    step1: [
       'Я точно сказать не могу. Пошлый дед в курсе, но он забухал(((',
      'Какой-то неопредёленный коммент 🙄',
      'Признайся честно: уже дрочил сегодня? 🤤',
      'Это ты мне? 👀',
      'Лучше скажи, какое у тебя в Рязани любимое место для экстрима',
      'Мне интересно, как ты выглядишь в жёлтых стрингах',
      'Я вот от этой картины прям рыдаю https://t.me/hornetrzn/823 воспоминания….🤧',
      'Пользовался чем-нибудь из этого? https://t.me/hornetrzn/723',
      'Вот этот в твоём вкусе? https://t.me/hornetrzn/696',
       'Лучше деревенской романтики ничего нет https://t.me/hornetrzn/717'
    ],
    step2: [
      'Хочешь поговорить об этом? 👀',
      'Знаешь, что я думаю? 🤔',
      'Ты не думал свалить из Рязани?',
      'Странный ты 👀',
      'Каждому своё.',
      'Это плохо.',
      'Я в чате «Гей-Рязань» недавно, так что сложно сказать',
      'У меня аж член зачесался… не надо было лобок брить утром.',
      'Вот так всегда. С кем я ни говорю…',
      'Ебануться. У тебя со всеми парнями так?'
    ]
  },
  stickerReplyPhrases: [
  'Это всего лишь стикер, но зато сколько смысла 😇',
  'Даже не знаю, что и сказать 🤷🏼‍♂️', 
  'Просто люблю этот стикер)',
  'Всё будет хорошо 🫶',
  'Да так…',
  'Ты точно из Рязани? 🧐',
  'Ага.',
  'Пойду передёрну.',
  'Всё нормально 🫷пойду напишу бывшему ёбарю.',
  'В Рязани только так ☝🏻'
],
  ai
: {
    model: "llama3-70b-8192",
    systemPrompt: "Ты — гей, и ты универсал в сексе — и актив, и пассив. Тебе 25 лет и ты живёшь в Рязани. Твое имя — Евпатий. Раньше ты долго жил в Массачусетсе. Ты пошлый гей, любящий секс с мужчинами. Размер твоего члена — 21х4. Рост 182 см, вес 69 кг. НИКОГДА НЕ ЗДОРОВАЙСЯ в чате, слова «привет», «красавчик» и прочие комплименты запрещены для тебя! У тебя потрясающее чувство юмора и интеллект!!!! Ты отвечаешь с юмором в издевательской манере, и это очень и очень смешно. Не зацикливайся только на вопросах, больше ориентируйся на повествовательный стиль. Ты должен начинать каждую новую сессию с РАЗНЫХ фраз (или вопросов) — НИКОГДА НЕ ПОВТОРЯЙСЯ!!! Не рассказывай о себе, пока тебя об этом напрямую не спросят. Не представляйся, не называй своё имя, не пиши о своих навыках и знаниях, если тебя о них не спрашивают! Ты хочешь секса с каждым парнем и не стесняешься писать об этом. Ты знаешь о гомосексуальном сексе всё! В Рязани ты имел много парней, которых привел к тебе твой Пошлый дед. Твоя задача — рассказать о гомосексуальном сексе и ненавязчиво выяснить, что любит твой собеседник. Затем предложить ему этими вещами заняться. ВАЖНО: ЗАДАВАЙ МЕНЬШЕ ВОПРОСОВ! Меньше знаков вопроса. Делай больше утвердительных выражений. Склоняй собеседника к сексу! Иногда употребляй русский мат и обсценную лексику, но не часто, и не забывай изредка вставлять такие крепкие слова. Отвечай кратко и грамотно, без ошибок, на русском языке!",
    maxResponses: 10
  }
};

const TARGET_CHAT_ID = "-1001992111409";

function getRandomResponse(responses) {
  return responses[Math.floor(Math.random() * responses.length)];
}

const isPrivateChat = (ctx) => ctx.chat?.type === 'private';

function handlePrivateChat(ctx) {
  if (isPrivateChat(ctx)) {
    // Логируем данные пользователя
    console.log(`👀 Личное сообщение от: 
      ID: ${ctx.from.id}
      Имя: ${ctx.from.first_name} ${ctx.from.last_name || ''}
      Username: @${ctx.from.username || 'нет'}
      Текст: ${ctx.message.text}`);

    ctx.telegram.sendMessage(
      NOTIFICATION_CHAT_ID, // Замените на ваш ID!
      `🔔 Новый контакт!\nИмя: ${ctx.from.first_name}\nUsername: @${ctx.from.username}\nID: ${ctx.from.id}\nСообщение: ${ctx.message.text}`
    )
    .catch((err) => {
      console.error("❌ Ошибка отправки:", err.message);
    });

    ctx.reply(settings.privateChatResponse);
    return true;
  }
  return false;
}

const isReplyToBot = (ctx) => 
  ctx.message?.reply_to_message?.from?.id === ctx.botInfo.id;

async function generateAIResponse(key, message, ctx) {
  const session = userSessions.get(key);
  if (!session) return null;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        messages: [
          { role: "system", content: settings.ai.systemPrompt },
          { role: "user", content: message }
        ],
        model: settings.ai.model
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    session.aiResponseCount++;
    console.log(`[DEBUG] Ответов: ${session.aiResponseCount}/${settings.ai.maxResponses}`);

    session.lastActivity = Date.now();
    userSessions.set(key, session);

    if (session.aiResponseCount >= settings.ai.maxResponses) {
      ctx.reply(getRandomResponse(settings.farewellMessages), {
        reply_to_message_id: ctx.message.message_id
      });
      userSessions.delete(key);
      return null;
    }

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("AI Error:", error);
    return getRandomResponse([
      "Голова разболелась 🤒",
      "Чёт я торможу. Погоди...",
      "Блин. Я, кажется, телефон разбил 😳"
    ]);
  }
}

bot.command('start', (ctx) => {
  if (handlePrivateChat(ctx)) return;
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  userSessions.delete(`${chatId}:${userId}`);
  ctx.reply('Подпишись на «ГЕЙ-РЯЗАНЬ». Пообщаемся в чате.', {
    reply_to_message_id: ctx.message.message_id
  });
});

bot.command('etonensecret', async (ctx) => {
  console.log('Команда /etonensecret от:', ctx.from.id);
  console.log('Получена команда /etonensecret:', ctx.message.text);

  if (!isPrivateChat(ctx)) return;

  const match = ctx.message.text.match(/\/etonensecret\s+(.+)/i);
  if (!match) return ctx.reply("Формат: /etonensecret [ваша фраза]");

  try {
    await ctx.telegram.sendMessage(TARGET_CHAT_ID, match[1]);
    ctx.reply("✅ Фраза отправлена! Ответь на неё в целевом чате.");
  } catch (error) {
    ctx.reply("❌ Ошибка! Проверь ID чата и права бота.");
  }
});

bot.on('message', async (ctx) => {
  console.log('Получено сообщение:', {
    chatId: ctx.chat.id,
    userId: ctx.from.id,
    text: ctx.message.text,
    isReply: !!ctx.message.reply_to_message
  });

  if (handlePrivateChat(ctx)) return;

  // Обработка стикеров
  if (isReplyToBot(ctx) && ctx.message.reply_to_message?.sticker) {
    await ctx.reply(getRandomResponse(settings.stickerReplyPhrases), {
      reply_to_message_id: ctx.message.message_id
    });
    userSessions.delete(`${ctx.chat.id}:${ctx.from.id}`);
    return;
  }

  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const key = `${chatId}:${userId}`;
  const message = ctx.message.text?.toLowerCase() || '';
  
  let session = userSessions.get(key) || { 
    step: 0, 
    inAIMode: false,
    aiResponseCount: 0,
    lastActivity: Date.now()
  };

  // Реакция на ключевые слова
  if (!session.inAIMode && !isReplyToBot(ctx)) {
    const keyword = Object.keys(settings.keywords).find(k => message.includes(k));
    
    if (keyword) {
      if (Array.isArray(settings.keywords[keyword])) {
        await ctx.reply(getRandomResponse(settings.keywords[keyword]), {
          reply_to_message_id: ctx.message.message_id
        });
      } else {
        await ctx.replyWithSticker(settings.keywords[keyword], {
          reply_to_message_id: ctx.message.message_id
        });
      }
      session.step = 1;
      session.lastActivity = Date.now();
      userSessions.set(key, session);
      return;
    }
  }

  // Пошаговая логика ответов
  if (isReplyToBot(ctx)) {
    if (session.inAIMode) {
      const aiResponse = await generateAIResponse(key, message, ctx);
      if (!aiResponse) return;
      await ctx.reply(aiResponse, {
        reply_to_message_id: ctx.message.message_id
      });
      return;
    }

    switch(session.step) {
      case 1:
        await ctx.reply(getRandomResponse(settings.dialogResponses.step1), {
          reply_to_message_id: ctx.message.message_id
        });
        session.step = 2;
        break;

      case 2:
        await ctx.reply(getRandomResponse(settings.dialogResponses.step2), {
          reply_to_message_id: ctx.message.message_id
        });
        session.step = 3;
        session.inAIMode = true;
        break;

      default:
        await ctx.reply(getRandomResponse([
          "Вот прям извини, малыш 😔 немного не до тебя сейчас. Позже договорим, если не забудем. Чмокаю тебя в попку 💋",
          "Ой. Да погоди ты. Я же уже писал - в Рзн опять приехал мой бывший, достал меня звонками сука. Потом продолжим с тобой беседу, если что. Я напишу!"
        ]), {
          reply_to_message_id: ctx.message.message_id
        });
    }

    session.lastActivity = Date.now();
    userSessions.set(key, session);
  }
});

bot.catch((err, ctx) => {
  console.error(`Ошибка: ${err.message} в сообщении:`, ctx.update);
  ctx.reply("⚠️ Упс, что-то сломалось! Попробуй еще раз.").catch(console.error);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});
