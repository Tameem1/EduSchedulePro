import axios from 'axios';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { users, appointments } from '@shared/schema';
import { Telegraf } from 'telegraf';

// Check if bot token is provided
const botToken = process.env.TELEGRAM_BOT_TOKEN;

// Initialize bot if token is available
export const bot = botToken ? new Telegraf(botToken) : null;

// Function to send a message to a specific Telegram user
export const sendTelegramMessage = async (telegramPhone: string, message: string): Promise<boolean> => {
  if (!bot) {
    console.log('Telegram bot token not provided, cannot send message');
    return false;
  }

  try {
    // Format telephone number (remove any non-digit characters and ensure it starts with +)
    let formattedPhone = telegramPhone;
    if (formattedPhone) {
      // Remove any non-digit characters except +
      formattedPhone = formattedPhone.replace(/[^\d+]/g, '');

      // Ensure it starts with +
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }
    } else {
      console.error('No phone number provided for Telegram notification');
      return false;
    }

    await bot.telegram.sendMessage(formattedPhone, message);
    console.log(`Message sent to Telegram user ${formattedPhone}`);
    return true;
  } catch (error) {
    console.error(`Failed to send message to Telegram user ${telegramPhone}:`, error);
    throw error;
  }
};

// Start the bot
export const startBot = () => {
  if (!bot) {
    console.log('Telegram bot token not provided, skipping bot initialization');
    return;
  }

  bot.start((ctx) => ctx.reply('مرحبًا بك في روبوت التعليم المساعد! استخدم /register للتسجيل كمعلم.'));

  bot.command('register', (ctx) => {
    const telegramPhone = ctx.from.id; // Assuming ID can be used as a placeholder for phone number collection.  Needs refinement for real-world implementation.
    ctx.reply(`رقم التيليجرام الخاص بك هو: ${telegramPhone}\nيرجى إضافة هذا الرقم في ملفك الشخصي على منصة التعليم.`);
  });

  // Launch the bot
  bot.launch().then(() => {
    console.log('Telegram bot started');
  }).catch(err => {
    console.error('Failed to start Telegram bot:', err);
  });
};

export async function sendTelegramNotification(telegramUsername: string, message: string, callbackUrl?: string): Promise<boolean> {
  try {
    // Check if TELEGRAM_BOT_TOKEN is set
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN is not set');
      return false;
    }

    if (!telegramUsername) {
      console.error('No Telegram username provided for notification');
      return false;
    }

    // Ensure username starts with @ if provided
    let formattedUsername = telegramUsername.trim();
    if (formattedUsername && !formattedUsername.startsWith('@')) {
      formattedUsername = '@' + formattedUsername;
    }

    console.log(`Sending notification to teacher with Telegram username: ${formattedUsername}`);

    // Prepare message text with optional action button
    const inlineKeyboard = callbackUrl ? 
      { inline_keyboard: [[{ text: "قبول الموعد", url: callbackUrl }]] } : 
      undefined;

    // Try to get user's ID from username (works if they've already started the bot)
    try {
      // First attempt: send directly to the username
      const response = await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          chat_id: formattedUsername, // This must be a Telegram username with @
          text: message,
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard ? JSON.stringify(inlineKeyboard) : undefined
        }
      );

      console.log('Telegram message sent successfully!');
      return response.data.ok;
    } catch (apiError: any) {
      const errorData = apiError.response?.data;
      
      if (errorData?.error_code === 404) {
        console.log('User not found. They might have a different username or need to interact with the bot first.');
        console.log('You should ask the teacher to ensure their username in the platform matches their Telegram username.');
        
        // You could implement a fallback notification method here if needed
      } else {
        console.error('Telegram API error:', errorData || apiError.message);
      }
      
      return false;
    }
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
    return false;
  }
}

export async function notifyTeacherAboutAppointment(appointmentId: number, teacherId: number): Promise<boolean> {
  try {
    // Get teacher telegram username
    const teacher = await db.select().from(users).where(eq(users.id, teacherId)).limit(1);
    if (!teacher.length || !teacher[0].telegramUsername) {
      console.error(`Teacher ${teacherId} not found or has no Telegram username`);
      return false;
    }

    // Get appointment details
    const appointment = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (!appointment.length) {
      console.error(`Appointment ${appointmentId} not found`);
      return false;
    }

    // Get student details
    const student = await db.select().from(users).where(eq(users.id, appointment[0].studentId)).limit(1);
    const studentName = student.length ? student[0].username : `طالب ${appointment[0].studentId}`;

    // Create acceptance URL (this would be your frontend URL where teacher can accept)
    const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/teacher/accept-appointment/${appointmentId}`;

    // Format the date for display
    const appointmentDate = new Date(appointment[0].startTime);
    const formattedDate = appointmentDate.toLocaleDateString('ar-SA');
    const formattedTime = appointmentDate.toLocaleTimeString('ar-SA', { 
      hour: '2-digit', 
      minute: '2-digit'
    });

    // Prepare message text
    const message = `تم تعيينك لموعد جديد مع ${studentName} بتاريخ ${formattedDate} الساعة ${formattedTime}. الرجاء قبول الموعد في أقرب وقت.`;
    
    // Try first using the bot directly if we have it initialized (more reliable)
    if (bot) {
      try {
        // Clean the username (remove @ if present)
        const username = teacher[0].telegramUsername.replace('@', '');
        
        console.log(`Sending notification to teacher ${teacherId} with Telegram username: @${username}`);
        
        // Find the user's chat by username and send message
        // This works if the user has started a conversation with the bot
        await bot.telegram.sendMessage(
          `@${username}`, 
          message,
          callbackUrl ? { 
            reply_markup: { 
              inline_keyboard: [[{ text: "قبول الموعد", url: callbackUrl }]] 
            } 
          } : undefined
        );
        
        console.log('Successfully sent notification via bot API');
        return true;
      } catch (botError) {
        console.log('Error sending via bot API, falling back to HTTP method:', botError.message);
        // Fall back to HTTP method
      }
    }
    
    // Fallback to the HTTP method
    return await sendTelegramNotification(
      teacher[0].telegramUsername, 
      message,
      callbackUrl
    );
  } catch (error) {
    console.error('Failed to notify teacher about appointment:', error);
    return false;
  }
}