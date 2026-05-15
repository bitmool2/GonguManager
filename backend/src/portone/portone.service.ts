import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

const IAMPORT_API = 'https://api.iamport.kr';

@Injectable()
export class PortoneService {
  private readonly logger = new Logger(PortoneService.name);
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  /* ── 액세스 토큰 발급 (캐싱) ── */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    const res = await axios.post(`${IAMPORT_API}/users/getToken`, {
      imp_key: process.env.PORTONE_API_KEY,
      imp_secret: process.env.PORTONE_API_SECRET,
    });
    const { access_token, expired_at } = res.data.response;
    this.accessToken = access_token as string;
    this.tokenExpiry = expired_at * 1000 - 30_000; // 만료 30초 전 갱신
    return this.accessToken as string;
  }

  /* ── 결제 단건 조회 ── */
  async getPayment(impUid: string) {
    const token = await this.getAccessToken();
    const res = await axios.get(`${IAMPORT_API}/payments/${impUid}`, {
      headers: { Authorization: token },
    });
    return res.data.response;
  }

  /* ── 결제 금액 검증 ── */
  async verifyPayment(impUid: string, expectedAmount: number) {
    const payment = await this.getPayment(impUid);
    if (payment.amount !== expectedAmount) {
      throw new Error(
        `결제 금액 불일치: 예상 ${expectedAmount}, 실제 ${payment.amount}`,
      );
    }
    return payment;
  }
}
