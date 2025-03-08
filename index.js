const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');

if (!process.env.TOKEN) throw new Error('TOKEN не установлен!');
if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY не установлен!');

const app = express();
app.use(express.json());
app.listen(process.env.PORT || 3000);

const bot = new Telegraf(process.env.TOKEN);

const webhookPath = `/telegraf/${bot.secretPathComponent()}`;
const webhookUrl = `https://vnuk-3.onrender.com${webhookPath}`;
bot.telegram.setWebhook(webhookUrl).catch(console.error);
app.use(bot.webhookCallback(webhookPath));

const TARGET_CHAT_ID = "-1002311068598";

bot.command('etonensecret', async (ctx) => {
  console.log('Команда /etonensecret от:', ctx.from.id);
  console.log('Содержимое сообщения:', JSON.stringify(ctx.message, null, 2)); // ЛОГ ВСЕГО СООБЩЕНИЯ

  const message = ctx.message;
  const caption = message.caption || message.text.replace('/etonensecret', '').trim();

  try {
    if (message.photo) {
      const fileId = message.photo[message.photo.length - 1].file_id;
      console.log("Отправляем фото:", fileId);
      await ctx.telegram.sendPhoto(TARGET_CHAT_ID, fileId, { caption: caption || "📷 Фото" });
      ctx.reply("✅ Фото отправлено!");
    } else if (message.video) {
      const fileId = message.video.file_id;
      console.log("Отправляем видео:", fileId);
      await ctx.telegram.sendVideo(TARGET_CHAT_ID, fileId, { caption: caption || "🎥 Видео" });
      ctx.reply("✅ Видео отправлено!");
    } else if (message.audio) {
      const fileId = message.audio.file_id;
      console.log("Отправляем аудио:", fileId);
      await ctx.telegram.sendAudio(TARGET_CHAT_ID, fileId, { caption: caption || "🎵 Аудио" });
      ctx.reply("✅ Аудио отправлено!");
    } else if (caption) {
      console.log("Отправляем текст:", caption);
      await ctx.telegram.sendMessage(TARGET_CHAT_ID, caption);
      ctx.reply("✅ Сообщение отправлено!");
    } else {
      console.log("Ошибка: нет медиа или текста!");
      ctx.reply("❌ Ошибка: не найдено медиа или текст!");
    }
  } catch (error) {
    console.error("Ошибка отправки:", error);
    ctx.reply("❌ Ошибка при отправке!");
  }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});
