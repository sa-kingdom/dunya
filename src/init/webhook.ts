import got from "got";
import {signWebhookDelivery} from "../utils/hmac.ts";
import WebhookSubscription from "../models/webhookSubscription.ts";

export type WebhookEvent =
    | "message.created"
    | "message.updated"
    | "message.deleted"
    | "thread.created"
    | "thread.updated"
    | "thread.deleted";

export const WEBHOOK_EVENTS: WebhookEvent[] = [
    "message.created",
    "message.updated",
    "message.deleted",
    "thread.created",
    "thread.updated",
    "thread.deleted",
];

export interface WebhookEventData {
    id: string;
    discussionId: string | null;
    data?: Record<string, unknown>;
}

const HEADER_TIMESTAMP = "X-Timestamp";
const HEADER_SIGNATURE = "X-Signature";
const HEADER_EVENT = "X-Webhook-Event";
const DELIVERY_TIMEOUT_MS = 10_000;
const DELIVERY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1_000;

/**
 * Deliver a signed webhook payload to a subscription endpoint with retries.
 * @param subscription - Target subscription record.
 * @param event - Event name.
 * @param body - Raw JSON body string.
 */
async function deliver(
    subscription: WebhookSubscription,
    event: WebhookEvent,
    body: string,
): Promise<void> {
    for (let attempt = 1; attempt <= DELIVERY_ATTEMPTS; attempt++) {
        const timestamp = Math.floor(Date.now() / 1000);
        try {
            await got.post(subscription.url, {
                body,
                headers: {
                    "Content-Type": "application/json",
                    [HEADER_EVENT]: event,
                    [HEADER_TIMESTAMP]: String(timestamp),
                    [HEADER_SIGNATURE]: signWebhookDelivery(
                        timestamp,
                        body,
                        subscription.secret,
                    ),
                },
                timeout: {request: DELIVERY_TIMEOUT_MS},
                throwHttpErrors: true,
            });
            return;
        } catch (error: unknown) {
            const isLastAttempt = attempt === DELIVERY_ATTEMPTS;
            console.error(
                `[webhook] Failed to deliver "${event}" to ` +
                `${subscription.id} (attempt ${attempt}/${DELIVERY_ATTEMPTS}):`,
                error instanceof Error ? error.message : String(error),
            );
            if (isLastAttempt) {
                return;
            }
            await new Promise((resolve) => {
                setTimeout(resolve, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
            });
        }
    }
}

/**
 * Emit a sync event to all active webhook subscriptions subscribed to it.
 * Delivery is fire-and-forget: failures are logged, never thrown.
 * @param event - Event name.
 * @param payload - Event payload with the affected entity ID.
 */
export async function emitWebhookEvent(
    event: WebhookEvent,
    payload: WebhookEventData,
): Promise<void> {
    try {
        const subscriptions = await WebhookSubscription.findAll({
            where: {active: true},
        });
        const targets = subscriptions.filter(
            (s) => !Array.isArray(s.events) || s.events.includes(event),
        );
        if (targets.length === 0) {
            return;
        }

        const body = JSON.stringify({
            event,
            timestamp: new Date().toISOString(),
            ...payload,
            data: payload.data ?? {},
        });
        await Promise.allSettled(
            targets.map((subscription) => deliver(subscription, event, body)),
        );
    } catch (error: unknown) {
        console.error(`[webhook] Failed to emit "${event}":`, error);
    }
}
