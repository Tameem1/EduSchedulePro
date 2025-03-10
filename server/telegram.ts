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
export const startBot = async () => {
  if (!bot) {
    console.log('Telegram bot token not provided, skipping bot initialization');
    return null;
  }

  console.log('Initializing Telegram bot...');
  
  // Check token validity
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN environment variable is not set');
    return null;
  }
  
  try {
    // Test the token with a simple getMe request
    const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
    console.log('Telegram bot token is valid. Bot details:', JSON.stringify(response.data, null, 2));
    
    // Important: Show the actual bot username that teachers should interact with
    if (response.data.ok && response.data.result) {
      console.log(`IMPORTANT: Teachers must send /start to @${response.data.result.username}`);
    }
  } catch (error) {
    console.error('Telegram bot token test failed:', error.message);
    console.error('Full error:', JSON.stringify(error.response?.data || error.message, null, 2));
  }
  
  bot.start(async (ctx) => {
    try {
      console.log('=== BOT START COMMAND RECEIVED ===');
      console.log('User details:', JSON.stringify(ctx.from, null, 2));
      console.log('Chat details:', JSON.stringify(ctx.chat, null, 2));
      console.log('===================================');
      await ctx.reply('مرحبًا بك في روبوت التعليم المساعد! استخدم /register للتسجيل كمعلم.');
      console.log('Reply sent successfully to user');
    } catch (error) {
      console.error('Error in start command handler:', error);
    }
  });

  bot.command('register', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const username = ctx.from.username || '';
      console.log(`User registering with Telegram ID: ${userId}, username: @${username}`);
      await ctx.reply(`معرف التيليجرام الخاص بك هو: ${userId}\nاسم المستخدم الخاص بك هو: @${username}\nيرجى إضافة هذه المعلومات في ملفك الشخصي على منصة التعليم.`);
    } catch (error) {
      console.error('Error in register command handler:', error);
    }
  });

  // Launch the bot with more detailed logging and retry mechanism
  try {
    console.log('=== ATTEMPTING TO LAUNCH TELEGRAM BOT ===');
    console.log(`Using bot token (first 5 chars): ${botToken ? botToken.substring(0, 5) : 'none'}`);
    
    let launchPromise = bot.launch();
    
    // Set up a timeout to ensure we don't wait forever
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Bot launch timeout after 10 seconds')), 10000)
    );
    
    await Promise.race([launchPromise, timeout]);
    
    console.log('=== TELEGRAM BOT INITIALIZED SUCCESSFULLY ===');
    console.log(`Bot username: @${bot.botInfo?.username || 'unknown'}`);
    console.log(`Bot ID: ${bot.botInfo?.id || 'unknown'}`);
    console.log('Full bot details:', JSON.stringify(bot.botInfo || {}, null, 2));
    console.log('Teachers should start a conversation with the bot by sending /start to @' + (bot.botInfo?.username || 'your_bot_username'));
    console.log('=============================================');
    
    // Return the initialized bot
    return bot;
  } catch (err) {
    console.error('=== TELEGRAM BOT INITIALIZATION FAILED ===');
    console.error('Failed to start Telegram bot:', err);
    console.error('Error details:', JSON.stringify(err, null, 2));
    console.error('Make sure your TELEGRAM_BOT_TOKEN is correct and the bot is properly configured');
    console.error('===========================================');
    
    // Return the bot even though initialization failed - we can still try to use it later
    return bot;
  }
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
    
    // Log bot initialization status
    console.log(`Bot initialized: ${bot?.botInfo ? 'Yes' : 'No'}`);
    if (bot && !bot.botInfo) {
      console.log('Bot is defined but not fully initialized. Waiting...');
      // Wait briefly for bot to initialize if needed
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Clean up and format username
    let formattedUsername = telegramUsername.trim();
    
    // Check if username appears to be a numeric ID
    const isNumericId = /^\d+$/.test(formattedUsername);
    console.log(`Username appears to be a ${isNumericId ? 'numeric ID' : 'username string'}`);
    
    // For display purposes only, keep a formatted version with @
    let displayUsername = formattedUsername;
    if (!isNumericId && displayUsername && !displayUsername.startsWith('@')) {
      displayUsername = '@' + displayUsername;
    }

    console.log(`Sending notification to teacher with Telegram username: ${displayUsername}`);

    // Prepare message text with optional action button
    const inlineKeyboard = callbackUrl ? 
      { inline_keyboard: [[{ text: "قبول الموعد", url: callbackUrl }]] } : 
      undefined;

    // Try to get user's ID from username (works if they've already started the bot)
    try {
      // Check if the username might actually be a numeric chat ID
      const isNumeric = /^\d+$/.test(telegramUsername.trim());
      
      // If it's a numeric ID, use it directly, otherwise clean the username
      // Important: For usernames (not IDs), we need to REMOVE the @ symbol when using chat_id
      const chatId = isNumeric 
        ? telegramUsername.trim() 
        : (formattedUsername.startsWith('@') 
          ? formattedUsername.substring(1)  // Remove the @ for API calls with usernames
          : formattedUsername);
        
      console.log('=== TELEGRAM DEBUGGING INFO ===');
      console.log(`Bot Token exists: ${!!botToken} (first 5 chars: ${botToken ? botToken.substring(0, 5) : 'none'})`);
      console.log(`Original username/ID provided: "${telegramUsername}"`);
      console.log(`Formatted username: "${formattedUsername}"`);
      console.log(`Using as chat_id: "${chatId}" (${isNumeric ? 'numeric ID' : 'username'})`);
      console.log(`Bot info from Telegraf: ${bot ? JSON.stringify(bot.botInfo || 'Not initialized') : 'Bot not initialized'}`);
      console.log('==============================');
      
      console.log(`Attempting to send message to Telegram ${isNumeric ? 'chat ID' : 'username'}: ${chatId}`);
        
      // First attempt: send directly to the chat_id
      const response = await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard ? JSON.stringify(inlineKeyboard) : undefined
        }
      );

      console.log('Telegram message sent successfully!');
      return response.data.ok;
    } catch (apiError: any) {
      const errorData = apiError.response?.data;
      
      // Log full error response for debugging
      console.log('Full Telegram API error response:', JSON.stringify({
        status: apiError.response?.status,
        statusText: apiError.response?.statusText,
        data: errorData,
        config: {
          url: apiError.config?.url,
          method: apiError.config?.method,
          data: JSON.parse(apiError.config?.data || '{}')
        }
      }, null, 2));
      
      if (errorData?.error_code === 404) {
        console.log('IMPORTANT: User not found or has not started a conversation with the bot.');
        console.log('For Telegram to work correctly:');
        console.log('1. The username must be entered WITHOUT the @ symbol in the user profile');
        console.log('2. The teacher MUST start a conversation with the bot first by sending /start');
        console.log(`3. The bot username is: ${bot ? `@${bot.botInfo?.username || 'unknown'}` : '(Bot not initialized yet)'}`);
        console.log('4. Verify that the username in the platform matches their exact Telegram username (case sensitive)');
        
        // Return a more specific error flag that could be used by the frontend
        return { success: false, error: 'user_not_started_bot' };
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
    // Get teacher telegram username or ID
    const teacher = await db.select().from(users).where(eq(users.id, teacherId)).limit(1);
    if (!teacher.length) {
      console.error(`Teacher ${teacherId} not found`);
      return false;
    }
    
    // Check for telegramId first (preferred), then fall back to username
    const hasTelegramId = !!teacher[0].telegramId;
    const hasTelegramUsername = !!teacher[0].telegramUsername;
    
    if (!hasTelegramId && !hasTelegramUsername) {
      console.error(`Teacher ${teacherId} has no Telegram ID or username`);
      return false;
    }
    
    // Prefer using telegramId if available
    const telegramContact = hasTelegramId ? teacher[0].telegramId : teacher[0].telegramUsername;
    console.log(`Using teacher's ${hasTelegramId ? 'Telegram ID' : 'username'}: ${telegramContact}`);

    // Get appointment details
    const appointment = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (!appointment.length) {
      console.error(`Appointment ${appointmentId} not found`);
      return false;
    }

    // Get student details
    const student = await db.select().from(users).where(eq(users.id, appointment[0].studentId)).limit(1);
    const studentName = student.length ? student[0].username : `طالب ${appointment[0].studentId}`;

    // Create acceptance URL (must be a public URL, not localhost)
    const replit_domain = process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.replit.dev` : null;
    const callbackUrl = `${process.env.FRONTEND_URL || replit_domain || 'https://example.com'}/teacher/accept-appointment/${appointmentId}`;
    
    console.log(`Using callback URL: ${callbackUrl}`);

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
        // Determine whether to use telegram ID or username
        // Important: For usernames, we need to REMOVE the @ for Telegraf API
        const chatId = teacher[0].telegramId || 
                      (teacher[0].telegramUsername?.startsWith('@') 
                        ? teacher[0].telegramUsername.substring(1)
                        : teacher[0].telegramUsername);
        
        console.log(`Sending notification to teacher ${teacherId} with Telegram ${teacher[0].telegramId ? 'ID' : 'username'}: ${chatId}`);
        
        // Find the user's chat by ID or username and send message
        // This works if the user has started a conversation with the bot
        await bot.telegram.sendMessage(
          chatId,
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
        console.log('Full bot API error:', JSON.stringify(botError, null, 2));
        // Fall back to HTTP method
      }
    }
    
    // Fallback to the HTTP method
    console.log(`Telegram API fallback: Using ${hasTelegramId ? 'ID' : 'username'} "${telegramContact}" to send message`);
    
    // Additional debug check: Try to look up username via Telegram API
    if (!hasTelegramId && telegramContact && botToken) {
      try {
        console.log('Attempting to look up user info via getChat API...');
        // Ensure username has NO @ prefix when passed to getChat API
        const username = telegramContact.startsWith('@') 
                        ? telegramContact.substring(1)
                        : telegramContact;
        const lookupResponse = await axios.get(
          `https://api.telegram.org/bot${botToken}/getChat?chat_id=${username}`
        );
        console.log('User lookup successful!', JSON.stringify(lookupResponse.data, null, 2));
      } catch (lookupError) {
        console.log('User lookup failed:', JSON.stringify(lookupError.response?.data || lookupError.message, null, 2));
        console.log('This confirms the username is not found or not accessible to the bot');
      }
    }
    
    return await sendTelegramNotification(
      telegramContact, // Use the determined telegramId or username
      message,
      callbackUrl
    );
  } catch (error) {
    console.error('Failed to notify teacher about appointment:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return false;
  }
}