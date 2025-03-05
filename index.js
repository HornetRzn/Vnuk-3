const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');

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
const userSessions = new Map(); // { userId: { step: number, inAIMode: boolean } }

const settings = {
  keywords: {
    'привет': 'Да заебал ты приветами 🥵 ты здесь половину парней знаешь уже...',
    'салют': 'Ты блять на празднике что ли?',
    'пока': 'Бля… даже не трахнулись хотя бы виртуально 😭 Ты хоть в Рязани живёшь или тоже из всяких Касимовых и Солотч понаехал?!',
    'жопа': 'Мясистая и упругая жопка — это наше 😋 Это мы принимаем, туда мы трахаем. Парни, кто на экстрим прямо в центре Рзн, м???'
  },
  ai: {
    model: "llama3-70b-8192",
    systemPrompt: "Тебя зовут Евпатий. Ты пошлый и нескромный гей, желающий флиртовать с мужчинами. Обзываешь их пошлыми словами и хочешь с каждым секса. Отвечай кратко на русском."
  }
};

// Проверка реплая на бота
const isReplyToBot = (ctx) => 
  ctx.message?.reply_to_message?.from?.id === ctx.botInfo.id;

async function generateAIResponse(userId, message) {
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
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("AI Error:", error);
    return "Чет я сегодня не в форме...";
  }
}

// Обработчик сообщений
bot.on('message', async (ctx) => {
  const userId = ctx.from.id;
  const message = ctx.message.text?.toLowerCase() || '';
  const session = userSessions.get(userId) || { step: 0, inAIMode: false };
  const replyOpt = { reply_to_message_id: ctx.message.message_id };

  // Режим AI
  if (session.inAIMode && isReplyToBot(ctx)) {
    const aiResponse = await generateAIResponse(userId, message);
    await ctx.reply(aiResponse, replyOpt);
    return;
  }

  // Проверка ключевых слов
  const keywordResponse = Object.entries(settings.keywords)
    .find(([key]) => message.includes(key))?.[1];

  if (keywordResponse) {
    await ctx.reply(keywordResponse, replyOpt);
    userSessions.set(userId, { step: 1, inAIMode: false });
    return;
  }

  // Диалоговая цепочка
  if (isReplyToBot(ctx)) {
    switch(session.step) {
      case 1:
        await ctx.reply('Во мне однажды такой пассивчик был... там хуй сантиметра 23 😳 Ну да, он пассив, но что-то решил присунуть в запале ночных страстей. В Рзн я таких не встречал ещё', replyOpt);
        userSessions.set(userId, { step: 2, inAIMode: false });
        break;

      case 2:
        await ctx.reply('Интересно! В Рязани такая ебля возможна?', replyOpt);
        userSessions.set(userId, { step: 3, inAIMode: true }); // Активируем AI
        break;

      default:
        if (session.step > 2) {
          const aiResponse = await generateAIResponse(userId, message);
          await ctx.reply(aiResponse, replyOpt);
        }
    }
  }
});

// Команда /start
bot.command('start', (ctx) => {
  userSessions.delete(ctx.from.id); // Сброс сессии
  ctx.reply('Подпишись на Гей-Рязань. Пообщаемся в чате', {
    reply_to_message_id: ctx.message.message_id
  });
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
