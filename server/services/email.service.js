import nodemailer from "nodemailer";

let cachedTransporter = null;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
  const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

  if (emailUser && emailPass) {
    const isGmail = (process.env.EMAIL_SERVICE || "").toLowerCase() === "gmail" || emailUser.includes("@gmail.com");
    if (isGmail && !process.env.SMTP_HOST) {
      cachedTransporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });
      console.log("📨 Configured Gmail SMTP for:", emailUser);
    } else {
      cachedTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });
      console.log("📨 Configured custom SMTP for:", emailUser);
    }
  } else if (process.env.SMTP_HOST) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });
  } else {
    // Generate automatic Ethereal test account for development
    try {
      const testAccount = await nodemailer.createTestAccount();
      cachedTransporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log("📨 Ethereal test mailer initialized:", testAccount.user);
    } catch {
      // Fallback transporter that logs
      cachedTransporter = {
        sendMail: async (mailOpts) => {
          console.log("📧 Simulated Mail:", mailOpts.to, mailOpts.subject);
          return { messageId: "simulated-" + Date.now() };
        }
      };
    }
  }

  return cachedTransporter;
}

export async function sendPasswordResetEmail({ to, resetUrl, userName = "there" }) {
  const transporter = await getTransporter();

  const html = `
    <div style="font-family:'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #E7E5E4; border-radius: 14px; overflow: hidden; color: #1C1917;">
      <div style="background: #4F46E5; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700;">Splitr</h1>
        <p style="color: #E0E7FF; font-size: 14px; margin: 6px 0 0;">Password Reset Request</p>
      </div>
      <div style="padding: 28px 24px;">
        <p style="font-size: 16px; margin: 0 0 16px;">Hello ${userName},</p>
        <p style="font-size: 14px; line-height: 1.6; color: #57534E; margin: 0 0 24px;">
          We received a request to reset your Splitr account password. Click the button below to choose a new password. This link is valid for <strong>30 minutes</strong>.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #4F46E5; color: #ffffff; padding: 13px 28px; border-radius: 10px; font-weight: 600; text-decoration: none; font-size: 15px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
            Reset Password
          </a>
        </div>
        <p style="font-size: 13px; color: #A8A29E; line-height: 1.5; margin: 24px 0 0;">
          If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #F5F5F4; font-size: 12px; color: #78716C; word-break: break-all;">
          Or copy and paste this link into your browser:<br>
          <a href="${resetUrl}" style="color: #4F46E5;">${resetUrl}</a>
        </div>
      </div>
    </div>
  `;

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"Splitr" <support@splitr.app>',
    to,
    subject: "Reset your Splitr account password",
    text: `You requested a password reset. Please visit this link to set a new password: ${resetUrl}`,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
  console.log(`\n======================================================`);
  console.log(`📧 [Splitr Email] Password Reset Email Sent!`);
  console.log(`To: ${to}`);
  console.log(`Reset URL: ${resetUrl}`);
  if (previewUrl) {
    console.log(`Preview Email Online: ${previewUrl}`);
  }
  console.log(`======================================================\n`);

  return {
    messageId: info.messageId,
    previewUrl: previewUrl || null,
    resetUrl
  };
}
