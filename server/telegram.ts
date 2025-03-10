import axios from 'axios';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { users, appointments } from '@shared/schema';

export async function sendTelegramNotification(telegramId: string, message: string, callbackUrl?: string): Promise<boolean> {
  try {
    // Check if TELEGRAM_BOT_TOKEN is set
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN is not set');
      return false;
    }

    // Prepare message text with optional action button
    const inlineKeyboard = callbackUrl ? 
      { inline_keyboard: [[{ text: "قبول الموعد", url: callbackUrl }]] } : 
      undefined;

    // Send message via Telegram Bot API
    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        chat_id: telegramId,
        text: message,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard ? JSON.stringify(inlineKeyboard) : undefined
      }
    );

    return response.data.ok;
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
    return false;
  }
}

export async function notifyTeacherAboutAppointment(appointmentId: number, teacherId: number): Promise<boolean> {
  try {
    // Get teacher telegram ID
    const teacher = await db.select().from(users).where(eq(users.id, teacherId)).limit(1);
    if (!teacher.length || !teacher[0].telegramId) {
      console.error(`Teacher ${teacherId} not found or has no Telegram ID`);
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
    
    // Send notification with more detailed information
    return await sendTelegramNotification(
      teacher[0].telegramId,
      `تم تعيينك لموعد جديد مع ${studentName} بتاريخ ${formattedDate} الساعة ${formattedTime}. الرجاء قبول الموعد في أقرب وقت.`,
      callbackUrl
    );
  } catch (error) {
    console.error('Failed to notify teacher about appointment:', error);
    return false;
  }
}