export const welcomeTemplate = (name: string): { html: string; text: string } => ({
  html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido a Bract</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #111111; border: 1px solid rgba(255,255,255,0.10); border-radius: 12px; overflow: hidden; }
    .header { padding: 32px 40px 24px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .logo { font-size: 22px; font-weight: 700; color: #6366f1; letter-spacing: -0.5px; }
    .body { padding: 32px 40px; }
    .title { font-size: 22px; font-weight: 600; color: rgba(255,255,255,0.95); margin: 0 0 12px; }
    .text { font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.60); margin: 0 0 24px; }
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
      <p class="title">Bienvenido, ${name} 👋</p>
      <p class="text">
        Tu cuenta ha sido creada correctamente. Ya puedes acceder al dashboard y comenzar a usar todas las funcionalidades de Bract.
      </p>
      <p class="text">
        Si tienes alguna pregunta, no dudes en contactarnos.
      </p>
    </div>
    <div class="footer">
      <p class="footer-text">© ${new Date().getFullYear()} Bract. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>`,
  text: `Bienvenido a Bract, ${name}!\n\nTu cuenta ha sido creada correctamente. Ya puedes acceder al dashboard y comenzar a usar todas las funcionalidades de Bract.\n\nSi tienes alguna pregunta, no dudes en contactarnos.\n\n© ${new Date().getFullYear()} Bract.`,
});
