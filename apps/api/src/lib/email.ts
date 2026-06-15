import { Resend } from 'resend';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { welcomeTemplate } from './templates/welcome.template.js';
import { passwordResetTemplate } from './templates/passwordReset.template.js';

const resend = new Resend(env.RESEND_API_KEY);

export const emailService = {
  async sendWelcome(to: string, name: string): Promise<void> {
    const { html, text } = welcomeTemplate(name);
    try {
      await resend.emails.send({
        from: env.EMAIL_FROM,
        to,
        subject: `Bienvenido a Bract, ${name}`,
        html,
        text,
      });
    } catch (err) {
      logger.error('email.sendWelcome failed', { to, error: (err as Error).message });
    }
  },

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
    const { html, text } = passwordResetTemplate(resetUrl);
    try {
      await resend.emails.send({
        from: env.EMAIL_FROM,
        to,
        subject: 'Restablece tu contraseña — Bract',
        html,
        text,
      });
    } catch (err) {
      logger.error('email.sendPasswordReset failed', { to, error: (err as Error).message });
    }
  },
};
