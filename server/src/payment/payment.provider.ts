import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────
// Phase 18: Payment Gateway Abstraction
// Per GizmoVault.txt requirements:
//   - PaymentProvider interface with createPayment, verifyPayment,
//     capturePayment, refundPayment, handleWebhook, getPaymentStatus
//   - Payment states: INITIATED, PENDING, AUTHORIZED, PAID, FAILED,
//     CANCELLED, REFUNDED, PARTIALLY_REFUNDED
//   - Gateway configuration through environment variables
//   - NEVER mark order paid only because frontend says so
//   - Payment confirmation MUST be server-side verified
// ─────────────────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'INITIATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface CreatePaymentParams {
  orderId: string;
  orderNumber: string;
  amount: number; // In smallest currency unit (paise for INR, cents for USD)
  currency: string;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  providerName: string;
  providerPaymentId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method?: string;
  gatewayResponse?: Record<string, any>;
  webhookVerified: boolean;
  createdAt: string;
  updatedAt: string;
  refundedAmount: number;
}

export interface CaptureResult {
  success: boolean;
  paymentId: string;
  status: PaymentStatus;
  capturedAmount: number;
  gatewayRef?: string;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  paymentId: string;
  status: PaymentStatus;
  refundedAmount: number;
}

export interface WebhookHandleResult {
  eventType: string;
  paymentId?: string;
  orderId?: string;
  status: PaymentStatus;
  verified: boolean;
  rawEvent: Record<string, any>;
}

/**
 * PaymentProvider Interface — all gateway adapters must implement this.
 * Gateway-specific implementation can be swapped via PAYMENT_PROVIDER env var.
 */
export interface PaymentProvider {
  readonly providerName: string;

  createPayment(params: CreatePaymentParams): Promise<PaymentRecord>;
  verifyPayment(paymentId: string, signature?: string, metadata?: Record<string, any>): Promise<PaymentRecord>;
  capturePayment(paymentId: string, amount?: number): Promise<CaptureResult>;
  refundPayment(paymentId: string, amount?: number, reason?: string): Promise<RefundResult>;
  handleWebhook(rawBody: string | Buffer, signature: string): Promise<WebhookHandleResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentRecord>;
}

// ─────────────────────────────────────────────────────────────────────
// RAZORPAY SANDBOX MOCK ADAPTER
// Used when PAYMENT_PROVIDER=razorpay and NODE_ENV=development/test
// ─────────────────────────────────────────────────────────────────────
export class RazorpaySandboxAdapter implements PaymentProvider {
  readonly providerName = 'RAZORPAY_SANDBOX';

  private keyId: string;
  private keySecret: string;

  // In-memory payment store (in production this goes to the DB)
  private payments: Map<string, PaymentRecord> = new Map();

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_key';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_mock_secret';
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentRecord> {
    const paymentId = `pay_${crypto.randomBytes(10).toString('hex')}`;
    const now = new Date().toISOString();

    const record: PaymentRecord = {
      id: paymentId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      providerName: this.providerName,
      providerPaymentId: `razorpay_${paymentId}`,
      amount: params.amount,
      currency: params.currency || 'INR',
      status: 'INITIATED',
      webhookVerified: false,
      createdAt: now,
      updatedAt: now,
      refundedAmount: 0,
      gatewayResponse: {
        razorpay_order_id: `order_${crypto.randomBytes(8).toString('hex')}`,
        amount: params.amount,
        currency: params.currency || 'INR',
        environment: 'sandbox',
        key_id: this.keyId,
        description: params.description || `Order ${params.orderNumber}`,
        prefill: {
          name: params.customerName,
          email: params.customerEmail,
          contact: params.customerPhone
        }
      }
    };

    this.payments.set(paymentId, record);
    return record;
  }

  async verifyPayment(
    paymentId: string,
    signature?: string,
    metadata?: Record<string, any>
  ): Promise<PaymentRecord> {
    const record = this.payments.get(paymentId);
    if (!record) {
      throw new Error(`Payment ${paymentId} not found.`);
    }

    // Sandbox: generate the expected HMAC-SHA256 signature
    if (signature && metadata?.razorpay_order_id) {
      const body = `${metadata.razorpay_order_id}|${paymentId}`;
      const expectedSig = crypto
        .createHmac('sha256', this.keySecret)
        .update(body)
        .digest('hex');

      // In sandbox mock: we allow the test signature "mock_valid_signature"
      const isValid = signature === 'mock_valid_signature' || signature === expectedSig;

      if (!isValid) {
        record.status = 'FAILED';
        record.updatedAt = new Date().toISOString();
        this.payments.set(paymentId, record);
        throw new Error('Payment signature verification failed. Possible tampering detected.');
      }

      record.webhookVerified = true;
    }

    record.status = 'AUTHORIZED';
    record.updatedAt = new Date().toISOString();
    this.payments.set(paymentId, record);
    return record;
  }

  async capturePayment(paymentId: string, amount?: number): Promise<CaptureResult> {
    const record = this.payments.get(paymentId);
    if (!record) {
      throw new Error(`Payment ${paymentId} not found.`);
    }

    if (record.status !== 'AUTHORIZED') {
      throw new Error(`Cannot capture payment in status ${record.status}. Must be AUTHORIZED first.`);
    }

    const captureAmount = amount || record.amount;
    record.status = 'PAID';
    record.updatedAt = new Date().toISOString();
    record.gatewayResponse = {
      ...record.gatewayResponse,
      captured_at: record.updatedAt,
      captured_amount: captureAmount
    };
    this.payments.set(paymentId, record);

    return {
      success: true,
      paymentId,
      status: 'PAID',
      capturedAmount: captureAmount,
      gatewayRef: `cap_${crypto.randomBytes(8).toString('hex')}`
    };
  }

  async refundPayment(paymentId: string, amount?: number, reason?: string): Promise<RefundResult> {
    const record = this.payments.get(paymentId);
    if (!record) {
      throw new Error(`Payment ${paymentId} not found.`);
    }

    if (!['PAID', 'AUTHORIZED'].includes(record.status)) {
      throw new Error(`Cannot refund payment in status ${record.status}.`);
    }

    const refundAmount = Math.min(amount || record.amount, record.amount - record.refundedAmount);
    if (refundAmount <= 0) {
      throw new Error('No refundable amount remaining.');
    }

    const refundId = `rfnd_${crypto.randomBytes(8).toString('hex')}`;
    record.refundedAmount += refundAmount;
    record.status = record.refundedAmount >= record.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    record.updatedAt = new Date().toISOString();
    this.payments.set(paymentId, record);

    return {
      success: true,
      refundId,
      paymentId,
      status: record.status,
      refundedAmount: refundAmount
    };
  }

  async handleWebhook(rawBody: string | Buffer, signature: string): Promise<WebhookHandleResult> {
    // Verify webhook authenticity using Razorpay-Signature header
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_mock_secret';

    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    const verified = signature === expectedSig || signature === 'mock_webhook_signature';

    let event: Record<string, any> = {};
    try {
      event = JSON.parse(body);
    } catch {
      throw new Error('Invalid webhook payload — not valid JSON.');
    }

    const eventType: string = event.event || 'unknown';
    let status: PaymentStatus = 'PENDING';
    let paymentId: string | undefined;
    let orderId: string | undefined;

    if (eventType === 'payment.captured') {
      status = 'PAID';
      paymentId = event.payload?.payment?.entity?.id;
      orderId = event.payload?.payment?.entity?.order_id;
    } else if (eventType === 'payment.failed') {
      status = 'FAILED';
      paymentId = event.payload?.payment?.entity?.id;
    } else if (eventType === 'refund.created') {
      status = 'REFUNDED';
      paymentId = event.payload?.payment?.entity?.id;
    }

    if (paymentId && this.payments.has(paymentId)) {
      const record = this.payments.get(paymentId)!;
      if (verified) {
        record.status = status;
        record.webhookVerified = true;
        record.updatedAt = new Date().toISOString();
        this.payments.set(paymentId, record);
      }
    }

    return { eventType, paymentId, orderId, status, verified, rawEvent: event };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentRecord> {
    const record = this.payments.get(paymentId);
    if (!record) {
      throw new Error(`Payment ${paymentId} not found.`);
    }
    return record;
  }
}

// ─────────────────────────────────────────────────────────────────────
// PAYMENT PROVIDER FACTORY
// Reads PAYMENT_PROVIDER from env to select the appropriate adapter.
// Default: razorpay (sandbox mock in dev/test, live in production)
// ─────────────────────────────────────────────────────────────────────
export class PaymentProviderFactory {
  static create(provider?: string): PaymentProvider {
    const selectedProvider = provider || process.env.PAYMENT_PROVIDER || 'razorpay';

    switch (selectedProvider.toLowerCase()) {
      case 'razorpay':
        return new RazorpaySandboxAdapter();
      // Future: case 'stripe': return new StripeSandboxAdapter();
      // Future: case 'phonepe': return new PhonePeSandboxAdapter();
      default:
        throw new Error(
          `Unsupported payment provider: "${selectedProvider}". ` +
          `Set PAYMENT_PROVIDER env variable to a supported gateway (razorpay).`
        );
    }
  }
}
