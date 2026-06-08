export const verificationTemplate = (
  verificationUrl: string,
): { html: string; text: string } => ({
  html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verifica tu email</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #111111; border: 1px solid rgba(255,255,255,0.10); border-radius: 12px; overflow: hidden; }
    .header { padding: 32px 40px 24px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .logo { font-size: 22px; font-weight: 700; color: #6366f1; letter-spacing: -0.5px; }
    .body { padding: 32px 40px; }
    .title { font-size: 22px; font-weight: 600; color: rgba(255,255,255,0.95); margin: 0 0 12px; }
    .text { font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.60); margin: 0 0 24px; }
    .btn { display: inline-block; padding: 13px 28px; background: #6366f1; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; }
    .expiry { font-size: 13px; color: rgba(255,255,255,0.35); margin: 20px 0 0; }
    .footer { padding: 20px 40px; background: #0a0a0a; border-top: 1px solid rgba(255,255,255,0.06); }
    .footer-text { font-size: 13px; color: rgba(255,255,255,0.35); margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">Bract</div>
    </div>
    <div class="body">
      <p class="title">Verifica tu dirección de email</p>
      <p class="text">
        Para completar tu registro, confirma que esta dirección de email te pertenece haciendo clic en el botón de abajo.
      </p>
      <a href="${verificationUrl}" class="btn">Verificar email</a>
      <p class="expiry">Este enlace expira en 1 hora.</p>
    </div>
    <div class="footer">
      <p class="footer-text">© ${new Date().getFullYear()} Bract. Si no creaste esta cuenta, ignora este email.</p>
    </div>
  </div>
</body>
</html>`,
  text: `Verifica tu dirección de email\n\nPara completar tu registro en Bract, haz clic en el siguiente enlace:\n\n${verificationUrl}\n\nEste enlace expira en 1 hora.\n\n© ${new Date().getFullYear()} Bract. Si no creaste esta cuenta, ignora este email.`,
});
