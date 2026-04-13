import { Injectable, Logger, InternalServerErrorException } from "@nestjs/common";
import { Resend } from "resend";

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
      const { data, error } = await this.resend.emails.send({
        from: this.fromAddress,
        to: email,
        subject: `Your ${purpose} OTP Code`,
        html: `
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: Arial, Helvetica, sans-serif;">

  <div style="padding: 20px;">
    <div class="container" style="max-width: 500px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

      <!-- Logo -->
      <div style="text-align: center; margin-bottom: 20px;">
        <img 
          src="pay4light.jpg" 
          alt="Pay4Light Logo" 
          style="max-width: 150px;"
        />
      </div>

      <!-- Title -->
      <h2 class="text" style="margin-top: 0; color: #333333; text-align: center;">
        Verify your Pay4Light account
      </h2>

      <!-- Body -->
      <p class="text" style="color: #555555; font-size: 14px;">
        Hello,
      </p>

      <p class="text" style="color: #555555; font-size: 14px;">
        Welcome to <strong>Pay4Light</strong>.
      </p>

      <p class="text" style="color: #555555; font-size: 14px;">
        Your One-Time Password (OTP) is:
      </p>

      <!-- OTP -->
      <div style="text-align: center; margin: 20px 0;">
        <span class="otp" style="display: inline-block; font-size: 28px; letter-spacing: 6px; font-weight: bold; color: #007bff;">
          ${code}
        </span>
      </div>

      <p class="text" style="color: #555555; font-size: 14px; text-align: center;">
        This code is valid for <strong>10 minutes</strong>.
      </p>

      <!-- Warning -->
      <p class="warning" style="color: #d9534f; font-size: 13px; margin-top: 20px;">
        Do not share this code with anyone. Pay4Light will never ask for your OTP.
      </p>

      <!-- Info -->
      <p class="text" style="color: #555555; font-size: 14px;">
        Pay4Light helps you manage prepaid electricity meters, buy tokens, and monitor your energy usage easily.
      </p>

      <p class="text" style="color: #555555; font-size: 14px;">
        After verification, you can add your meter and start buying electricity tokens.
      </p>

      <!-- Footer -->
      <p class="text" style="color: #555555; font-size: 14px;">
        If you did not request this, please ignore this email.
      </p>

      <p class="text" style="color: #555555; font-size: 14px;">
        Need help? 
        <a href="mailto:support@pay4light.ng" style="color: #007bff; text-decoration: none;">
          support@pay4light.ng
        </a>
      </p>

      <hr class="divider" style="border: none; border-top: 1px solid #eeeeee; margin: 20px 0;" />

      <p class="muted" style="text-align: center; font-size: 13px; color: #999999;">
        <strong>Pay4Light Team</strong><br/>
        Smart Energy for Smart Living
      </p>

    </div>
  </div>

        `,
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
        this.logger.error(`Resend error sending attachment to ${to}:`, error);
        throw new InternalServerErrorException(error.message);
      }

      this.logger.log(`Attachment email sent to ${to}: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Failed to send attachment email to ${to}:`, error);
      throw error;
    }
  }
}