# 📧 Email Templates

> **HTML email templates with Handlebars**

[Ana Sayfa](../README.md)

---

## Template Engine (Handlebars)

```bash
npm install handlebars nodemailer
```

### Base Layout

```html
<!-- templates/email/layout.hbs -->
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
    .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{siteName}}</h1>
    </div>
    <div class="content">
      {{{body}}}
    </div>
    <div class="footer">
      <p>&copy; 2025 {{siteName}}. All rights reserved.</p>
      <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
```

### Welcome Email

```html
<!-- templates/email/welcome.hbs -->
<h2>Welcome, {{name}}!</h2>
<p>Thank you for registering on our platform.</p>
<p>To verify your email, please click the button below:</p>
<a href="{{verificationUrl}}" class="button">Verify Email</a>
<p>This link will expire in 24 hours.</p>
```

### Password Reset

```html
<!-- templates/email/password-reset.hbs -->
<h2>Password Reset Request</h2>
<p>Hi {{name}},</p>
<p>You requested to reset your password. Click the button below to reset:</p>
<a href="{{resetUrl}}" class="button">Reset Password</a>
<p>If you didn't request this, please ignore this email.</p>
<p>Link expires in 1 hour.</p>
```

## Send Email Service

```javascript
// src/services/email.service.js
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const sendEmail = async (to, subject, template, data) => {
  const templatePath = path.join(__dirname, '../../templates/email', `${template}.hbs`);
  const templateSource = await fs.readFile(templatePath, 'utf8');
  const compiledTemplate = handlebars.compile(templateSource);
  const html = compiledTemplate(data);

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html
  });
};

module.exports = { sendEmail };
```

### Usage

```javascript
// Send welcome email
await sendEmail(
  'user@example.com',
  'Welcome to HZM Platform',
  'welcome',
  {
    name: 'John Doe',
    siteName: 'HZM Platform',
    verificationUrl: 'https://yourdomain.com/verify?token=xxx'
  }
);

// Send password reset
await sendEmail(
  'user@example.com',
  'Password Reset Request',
  'password-reset',
  {
    name: 'John Doe',
    siteName: 'HZM Platform',
    resetUrl: 'https://yourdomain.com/reset-password?token=xxx'
  }
);
```

**[Ana Sayfa](../README.md)**


