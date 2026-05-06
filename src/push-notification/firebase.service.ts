import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);

  onModuleInit() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
      this.logger.log('Firebase Admin initialized');
    }
  }

  // Send to single device
  async sendToDevice(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string | null> {
    try {
      const message: admin.messaging.Message = {
        token,
        notification: { title, body },
        data: data || {},
        android: {
          priority: 'high',
          notification: {
            sound:       'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Push sent — messageId: ${response}`);
      return response;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
          ? error
          : JSON.stringify(error);
      this.logger.error(`Failed to send push to token ${token}:`, message);
      return null;
    }
  }

  // Send to multiple devices
  async sendToMultipleDevices(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!tokens.length) return null;

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: { title, body },
        data: data || {},
        android: {
          priority: 'high',
          notification: {
            sound:       'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: { sound: 'default', badge: 1 },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(
        `Multicast sent — success: ${response.successCount}, failed: ${response.failureCount}`,
      );
      return response;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
          ? error
          : JSON.stringify(error);
      this.logger.error('Multicast push failed:', message);
      return null;
    }
  }

  // Send to topic (broadcast to all subscribed users)
  async sendToTopic(
    topic: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    try {
      const message: admin.messaging.Message = {
        topic,
        notification: { title, body },
        data: data || {},
        android: { priority: 'high' },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Topic push sent — topic: ${topic}, messageId: ${response}`);
      return response;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
          ? error
          : JSON.stringify(error);
      this.logger.error(`Topic push failed for ${topic}:`, message);
      return null;
    }
  }
}