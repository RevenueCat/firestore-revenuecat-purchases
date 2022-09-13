type EventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "PRODUCT_CHANGE"
  | "CANCELLATION"
  | "BILLING_ISSUE"
  | "SUBSCRIBER_ALIAS"
  | "NON_RENEWING_PURCHASE"
  | "UNCANCELLATION"
  | "TRANSFER"
  | "SUBSCRIPTION_PAUSED"
  | "EXPIRATION";

interface Entitlement {
  expires_date: string;
  purchase_date: string;
  product_identifier: string;
  grace_period_expires_date: string;
}

export interface CustomerInfo {
  original_app_user_id: string;
  entitlements: { [entitlementIdentifier: string]: Entitlement };
}

type GetTypeForName<TName, TX = BodyPayload> = TX extends {
  event: { type: TName };
}
  ? TX
  : never;

export const is = <TName extends BodyPayload["event"]["type"]>(
  x: BodyPayload,
  name: TName
): x is GetTypeForName<TName> => x.event.type === name;

export type BodyPayload =
  | {
      api_version: string;
      event: {
        type: Exclude<EventType, "TRANSFER">;
        id: string;
        app_user_id: string;
        subscriber_info: {};
        aliases: string[];
      };
      customer_info: {
        original_app_user_id: string;
        entitlements: { [entitlementIdentifier: string]: Entitlement };
      };
    }
  | {
      api_version: string;
      event: {
        type: "TRANSFER";
        id: string;
        store: string;
        transferred_from: string[];
        transferred_to: string[];
        aliases: string[];
        app_user_id: string;
        origin_app_user_id: string;
      };
      customer_info: CustomerInfo;
      origin_customer_info: CustomerInfo;
    };
