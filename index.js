const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');

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
  // ... (все настройки остаются без изменений)
};

// Новая функция для отправки медиа
const mediaUrls = {
  photo1: 'https://example.com/photo.jpg', // Замените на ваш URL
  document1: 'https://example.com/file.pdf' // Замените на ваш URL
};

bot.command('sendmedia', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply("Укажите тип медиа: /sendmedia photo или /sendmedia document");
  }

  const type = args[1].toLowerCase();
  let url;

  switch (type) {
    case 'photo':
      url = mediaUrls.photo1;
      break;
    case 'document':
      url = mediaUrls.document1;
      break;
    default:
      return ctx.reply("Неподдерживаемый тип. Используйте 'photo' или 'document'");
  }

  if (!url) {
    return ctx.reply("Ошибка: URL не найден");
  }

  try {
    if (type === 'photo') {
      await ctx.replyWithPhoto({ source: url }, { caption: 'Вот ваше фото' });
    } else {
      await ctx.replyWithDocument({ source: url }, { caption: 'Вот документ' });
    }
  } catch (err) {
    ctx.reply(`Ошибка отправки: ${err.message}`);
  }
});

// Остальной код остается без изменений

bot.command('start', (ctx) => {
  // ... (код остается)
});

bot.command('etonensecret', async (ctx) => {
  // ... (код остается)
});

bot.on('message', async (ctx) => {
  // ... (код остается)
});

bot.catch((err, ctx) => {
  // ... (код остается)
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});
