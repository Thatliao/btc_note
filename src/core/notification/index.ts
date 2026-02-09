import axios from 'axios';
import { config } from '../../config';

class NotificationService {
  private sendTimes: number[] = [];
  private maxPerMinute = config.notification.maxPerMinute;

  async send(title: string, content: string): Promise<boolean> {
    if (!this.canSend()) {
      console.log('[Notification] Rate limited, skipping');
      return false;
    }

    if (!config.serverChan.uid || !config.serverChan.sendKey) {
      console.log('[Notification] No UID or SendKey configured, skipping');
      return false;
    }

    try {
      // Server酱³ API: https://<uid>.push.ft07.com/send/<sendkey>.send
      const url = `https://${config.serverChan.uid}.push.ft07.com/send/${config.serverChan.sendKey}.send`;
      const params = new URLSearchParams();
      params.append('title', title.slice(0, 32));
      params.append('desp', content);

      const response = await axios.post(url, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (response.data.code === 0) {
        console.log('[Notification] Sent successfully');
        this.recordSend();
        return true;
      } else {
        console.error('[Notification] Failed:', response.data.message);
        return false;
      }
    } catch (error: any) {
      console.error('[Notification] Error:', error.message);
      return false;
    }
  }

  private canSend(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    // Clean old records
    this.sendTimes = this.sendTimes.filter(t => t > oneMinuteAgo);

    return this.sendTimes.length < this.maxPerMinute;
  }

  private recordSend() {
    this.sendTimes.push(Date.now());
  }
}

export const notificationService = new NotificationService();
