export interface PaymentProvider {
  createCheckout(input: {
    registrationId: string;
    amountMinor: number;
    currency: string;
  }): Promise<{ url: string }>;
  verifyWebhook(
    body: string,
    signature: string,
  ): Promise<{ paid: boolean; registrationId: string }>;
}
export class UnconfiguredPaymentProvider implements PaymentProvider {
  async createCheckout(): Promise<never> {
    throw new Error('Payments are not configured. Only free registrations are supported.');
  }
  async verifyWebhook(): Promise<never> {
    throw new Error('Payment webhook not configured.');
  }
}
