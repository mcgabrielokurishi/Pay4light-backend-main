import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly fromAddress: string;

  constructor() {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not defined in environment variables");
    }

    if (!process.env.MAIL_FROM) {
      throw new Error("MAIL_FROM is not defined in environment variables");
    }

    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromAddress = process.env.MAIL_FROM;
  }

  async sendOtp(
    email: string,
    code: string,
    purpose: string = "verification"
  ): Promise<void> {
    try {
      const logoPath = path.join(
        process.cwd(),
        "src",
        "assets",
        "pay4light.jpg"
      );

      const logoBuffer = fs.readFileSync(logoPath);

      const { data, error } = await this.resend.emails.send({
        from: this.fromAddress,
        to: email,
        subject: `Your ${purpose} OTP Code`,
        html: `
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">

<div style="padding:20px;">
<div style="max-width:500px;margin:auto;background:#ffffff;padding:30px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.05);">

<div style="text-align:center;margin-bottom:25px;">
<img
src="cid:pay4light-logo"
alt="Pay4Light"
width="180"
style="display:block;margin:auto;"
/>
</div>

<h2 style="margin:0 0 20px;color:#333;text-align:center;">
Verify your Pay4Light account
</h2>

<p style="color:#555;font-size:14px;">
Hello,
</p>

<p style="color:#555;font-size:14px;">
Welcome to <strong>Pay4Light</strong>.
</p>

<p style="color:#555;font-size:14px;">
Your One-Time Password (OTP) is:
</p>

<div style="text-align:center;margin:25px 0;">
<span style="
display:inline-block;
font-size:30px;
font-weight:bold;
letter-spacing:8px;
color:#ff6b00;">
${code}
</span>
</div>

<p style="text-align:center;color:#555;font-size:14px;">
This code is valid for <strong>10 minutes</strong>.
</p>

<p style="margin-top:20px;color:#d9534f;font-size:13px;">
Do not share this code with anyone. Pay4Light will never ask for your OTP.
</p>

<p style="color:#555;font-size:14px;">
Pay4Light helps you manage prepaid electricity meters, purchase electricity tokens, and monitor your energy usage easily.
</p>

<p style="color:#555;font-size:14px;">
Once verified, you can register your meter and begin purchasing electricity instantly.
</p>

<p style="color:#555;font-size:14px;">
If you didn't request this code, simply ignore this email.
</p>

<p style="color:#555;font-size:14px;">
Need help?
<a href="mailto:support@pay4light.ng"
style="color:#ff6b00;text-decoration:none;">
support@pay4light.ng
</a>
</p>

<hr style="border:none;border-top:1px solid #eee;margin:25px 0;" />

<p style="text-align:center;font-size:13px;color:#999;">
<strong>Pay4Light Team</strong><br/>
Smart Energy for Smart Living
</p>

</div>
</div>

</body>
`,
        attachments: [
          {
            filename: "pay4light.jpg",
            content: logoBuffer,
            contentType: "image/jpeg",
            contentId: "pay4light-logo",
          },
        ],
      });

      if (error) {
        this.logger.error(`Resend error sending OTP to ${email}:`, error);
        console.log(`[DEV FALLBACK] OTP for ${email}: ${code}`);
        throw new InternalServerErrorException(error.message);
      }

      this.logger.log(`OTP email sent to ${email}: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}:`, error);
      console.log(`[DEV FALLBACK] OTP for ${email}: ${code}`);
      throw error;
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    from?: string
  ): Promise<void> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: from || this.fromAddress,
        to,
        subject,
        html,
      });

      if (error) {
        this.logger.error(`Resend error sending email to ${to}:`, error);
        throw new InternalServerErrorException(error.message);
      }

      this.logger.log(`Email sent to ${to}: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  async sendEmailWithAttachment(
    to: string,
    subject: string,
    text: string,
    attachment: Buffer,
    filename: string
  ): Promise<void> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject,
        text,
        attachments: [
          {
            filename,
            content: attachment,
          },
        ],
      });

      if (error) {
        this.logger.error(
          `Resend error sending attachment to ${to}:`,
          error
        );
        throw new InternalServerErrorException(error.message);
      }

      this.logger.log(`Attachment email sent to ${to}: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Failed to send attachment email to ${to}:`, error);
      throw error;
    }
  }
}