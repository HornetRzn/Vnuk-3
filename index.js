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
const userSessions = new Map();

const settings = {
  privateChatResponse: 'Я не стеснительный, поэтому люблю публичное общение 😎 Подписывайся на «ГЕЙ-РЯЗАНЬ» — https://t.me/hornetrzn',
  keywords: {
    'привет': 'Да заебал ты приветами...',
    'салют': 'Ты блять на празднике что ли?',
    'пока': 'Щаслива в жопе слива!',
    'жопа': 'Ну.... мне больше пи'
  },
  ai: {
    model: "llama3-70b-8192",
    systemPrompt: "Ты сексуальный гей, желающий флиртовать. Отвечай кратко на русском."
  }
};

// Проверка типа чата
const isPrivateChat = (ctx) => ctx.chat?.type === 'private';

// Обработка личных сообщений
function handlePrivateChat(ctx) {
  if (isPrivateChat(ctx)) {
    ctx.reply(settings.privateChatResponse);
    return true; // Прекращаем дальнейшую обработку
  }
  return false;
}

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

// Главный обработчик сообщений
bot.on('message', async (ctx) => {
  if (handlePrivateChat(ctx)) return;

  const userId = ctx.from.id;
  const message = ctx.message.text?.toLowerCase() || '';
  const session = userSessions.get(userId) || { step: 0, inAIMode: false };
  const replyOpt = { reply_to_message_id: ctx.message.message_id };

  if (session.inAIMode && isReplyToBot(ctx)) {
    const aiResponse = await generateAIResponse(userId, message);
    await ctx.reply(aiResponse, replyOpt);
    return;
  }

  const keywordResponse = Object.entries(settings.keywords)
    .find(([key]) => message.includes(key))?.[1];

  if (keywordResponse) {
    await ctx.reply(keywordResponse, replyOpt);
    userSessions.set(userId, { step: 1, inAIMode: false });
    return;
  }

  if (isReplyToBot(ctx)) {
    switch(session.step) {
      case 1:
        await ctx.reply('Во мне однажды такой пассивчик был...', replyOpt);
        userSessions.set(userId, { step: 2, inAIMode: false });
        break;

      case 2:
        await ctx.reply('Интересно! В Рязани такая ебля возможна?', replyOpt);
        userSessions.set(userId, { step: 3, inAIMode: true });
        break;

      default:
        if (session.step > 2) {
          const aiResponse = await generateAIResponse(userId, message);
          await ctx.reply(aiResponse, replyOpt);
        }
    }
  }
});

// Обработчик команды /start с проверкой чата
bot.command('start', (ctx) => {
  if (handlePrivateChat(ctx)) return;
  
  userSessions.delete(ctx.from.id);
  ctx.reply('Подпишись на Гей-Рязань. Пообщаемся в чате', {
    reply_to_message_id: ctx.message.message_id
  });
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Тестовый роут для проверки
app.get('/', (req, res) => {
  res.send('Bot is alive!');
});
