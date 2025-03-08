const { Telegraf } = require('telegraf');
const express = require('express');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const crypto = require('crypto');
const app = express();

// Конфигурация
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = `/telegraf/${new Telegraf(process.env.TOKEN).secretPathComponent()}`;
const WEBHOOK_URL = `https://vnuk-3.onrender.com${WEBHOOK_PATH}`;
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 минут
const API_RATE_LIMIT = 100; // Запросов за 15 минут

// Инициализация
const bot = new Telegraf(process.env.TOKEN);
const userSessions = new Map();

// Защита от перегрузок
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: API_RATE_LIMIT,
  message: 'Слишком много запросов, попробуйте позже'
});
app.use(limiter);

// Безопасность вебхука
app.use((req, res, next) => {
  const isValid = verifyTelegramRequest(req, process.env.TOKEN);
  if (isValid) next();
  else res.status(403).end('Forbidden');
});

// Настройка бота
bot.telegram.setWebhook(WEBHOOK_URL).catch(console.error);
app.use(express.json());
app.use(bot.webhookCallback(WEBHOOK_PATH));

// Конфигурация ответов
const settings = {
  privateChatResponse: 'Я не стеснительный, поэтому люблю публичное общение 😎 Подписывайся на «ГЕЙ-РЯЗАНЬ» — https://t.me/hornetrzn',
  keywords: {
    'в рот': [
      'В Песочне раньше жил пацанчик, тоже любил оральное дело. В прошлый вторник задохнулся от оргазма 😭',
      // ... (остальные ваши фразы из исходного кода)
    ],
    // ... (остальные ключевые слова)
  },
  // ... (остальные настройки из вашего исходного кода)
};

// Вспомогательные функции
const isPrivateChat = (ctx) => ctx.chat?.type === 'private';
const isReplyToBot = (ctx) => ctx.message?.reply_to_message?.from?.id === ctx.botInfo.id;

function verifyTelegramRequest(req, token) {
  const secret = crypto.createHmac('sha256', token)
    .update(JSON.stringify(req.body))
    .digest('hex');
  return req.headers['x-telegram-bot-api-secret-token'] === secret;
}

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
    session.lastActivity = Date.now();
    userSessions.set(key, session);

    if (session.aiResponseCount >= settings.ai.maxResponses) {
      ctx.reply(getRandomResponse(settings.farewellMessages));
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

// Основная логика
bot.command('start', (ctx) => {
  if (isPrivateChat(ctx)) {
    ctx.reply(settings.privateChatResponse);
    return;
  }
  
  const key = `${ctx.chat.id}:${ctx.from.id}`;
  userSessions.delete(key);
  ctx.reply('Подпишись на «ГЕЙ-РЯЗАНЬ». Пообщаемся в чате.');
});

bot.command('etonensecret', async (ctx) => {
  if (!isPrivateChat(ctx)) return;
  
  const match = ctx.message.text.match(/\/etonensecret\s+(.+)/i);
  if (!match) return ctx.reply("Формат: /etonensecret [ваша фраза]");
  
  try {
    await ctx.telegram.sendMessage(process.env.TARGET_CHAT_ID, match[1]);
    ctx.reply("✅ Фраза отправлена!");
  } catch (error) {
    ctx.reply("❌ Ошибка отправки");
  }
});

bot.on('message', async (ctx) => {
  if (isPrivateChat(ctx)) {
    ctx.reply(settings.privateChatResponse);
    return;
  }

  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const key = `${chatId}:${userId}`;
  const message = ctx.message.text?.toLowerCase() || '';
  const replyOpt = { reply_to_message_id: ctx.message.message_id };

  let session = userSessions.get(key) || {
    step: 0,
    inAIMode: false,
    aiResponseCount: 0,
    lastActivity: Date.now()
  };

  // Обработка ответов в целевом чате
  if (ctx.chat.id.toString() === process.env.TARGET_CHAT_ID && isReplyToBot(ctx)) {
    const aiResponse = await generateAIResponse(key, message, ctx);
    if (aiResponse) await ctx.reply(aiResponse, replyOpt);
    return;
  }

  // Обработка стикеров
  if (ctx.message?.sticker && isReplyToBot(ctx)) {
    await ctx.reply(getRandomResponse(settings.stickerReplyPhrases), replyOpt);
    userSessions.delete(key);
    return;
  }

  // Обработка ключевых слов
  const keyword = Object.keys(settings.keywords).find(k => message.includes(k));
  if (keyword && !session.inAIMode) {
    const response = Array.isArray(settings.keywords[keyword])
      ? getRandomResponse(settings.keywords[keyword])
      : settings.keywords[keyword];
    
    if (typeof response === 'string') {
      await ctx.reply(response, replyOpt);
    } else {
      await ctx.replyWithSticker(response, replyOpt);
    }
    
    session = { ...session, step: 1, lastActivity: Date.now() };
    userSessions.set(key, session);
    return;
  }

  // Диалоговый режим
  if (isReplyToBot(ctx)) {
    if (session.inAIMode) {
      const aiResponse = await generateAIResponse(key, message, ctx);
      if (aiResponse) await ctx.reply(aiResponse, replyOpt);
      return;
    }

    switch (session.step) {
      case 0:
        await ctx.reply(getRandomResponse(settings.dialogResponses.step1), replyOpt);
        session = { ...session, step: 1 };
        break;
      case 1:
        await ctx.reply(getRandomResponse(settings.dialogResponses.step2), replyOpt);
        session = { ...session, step: 2, inAIMode: true };
        break;
      default:
        await ctx.reply(getRandomResponse([
          "Вот прям извини, малыш 😔 немного не до тебя сейчас...",
          "Ой. Да погоди ты. Я же уже писал..."
        ]), replyOpt);
    }

    session.lastActivity = Date.now();
    userSessions.set(key, session);
  }
});

// Очистка сессий
setInterval(() => {
  const now = Date.now();
  userSessions.forEach((session, key) => {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      userSessions.delete(key);
      console.log(`Сессия ${key} удалена`);
    }
  });
}, 5 * 60 * 1000);

// Важный обработчик, который вы просили
app.get('/', (req, res) => res.send('Bot is alive!'));

// Запуск сервера
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));

// Обработка завершения
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
