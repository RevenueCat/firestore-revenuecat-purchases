type EventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "PRODUCT_CHANGE"
  | "CANCELLATION"
  | "BILLING_ISSUE"
  | "NON_RENEWING_PURCHASE"
  | "UNCANCELLATION"
  | "TRANSFER"
  | "SUBSCRIPTION_PAUSED"
  | "SUBSCRIPTION_EXTENDED"
  | "EXPIRATION";

interface Entitlement {
  expires_date: string | null;
  purchase_date: string;
  product_identifier: string;
  grace_period_expires_date: string | null;
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

type BaseEvent = {
  id: string;
  event_timestamp_ms?: number;
  aliases: string[];
  // Guarded with a truthiness check at the call site: a transfer can revoke the
  // previous owner without granting to a new destination, so the destination
  // user id may be absent.
  app_user_id?: string;
};

export type BodyPayload =
  | {
      api_version: string;
      event: BaseEvent & {
        type: Exclude<EventType, "TRANSFER">;
        subscriber_info: {};
      };
      customer_info: CustomerInfo;
    }
  | {
      api_version: string;
      event: BaseEvent & {
        type: "TRANSFER";
        store: string;
        transferred_from: string[];
        transferred_to: string[];
        origin_app_user_id?: string;
      };
      customer_info: CustomerInfo;
      origin_customer_info: CustomerInfo;
    };
