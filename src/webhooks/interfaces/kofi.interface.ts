export enum KofiPaymentType {
  DONATION = 'Donation',
  SUBSCRIPTION = 'Subscription',
  COMMISSION = 'Commission',
  SHOP_ORDER = 'Shop Order',
}

export interface KofiWebhookPayload {
  verification_token: string;
  message_id: string;
  timestamp: string;
  type: string;
  is_public: boolean;
  from_name: string | null
  message: string | null;
  amount: string;
  url: string;
  email: string;
  currency: string;
  is_subscription_payment: boolean;
  is_first_subscription_payment: boolean;
  kofi_transaction_id: string;
  shop_items: any | null;
  tier_name: string | null;
  shipping: any | null;
}