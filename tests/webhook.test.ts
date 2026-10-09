import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import { signWebhookDelivery } from "../src/utils/hmac.ts";

const secret = "test-webhook-secret";

describe("webhook", () => {
    it("signs the canonical delivery message", () => {
        const body = JSON.stringify({event: "message.created", id: "1"});
        const expected = createHmac("sha256", secret)
            .update(`123\nPOST\n${body}`)
            .digest("hex");
        expect(signWebhookDelivery(123, body, secret)).toBe(expected);
    });

    it("produces a stable hex signature for identical inputs", () => {
        const body = JSON.stringify({event: "thread.deleted", id: "9"});
        expect(signWebhookDelivery(42, body, secret))
            .toBe(signWebhookDelivery(42, body, secret));
    });

    it("produces different signatures for different bodies", () => {
        expect(signWebhookDelivery(42, "a", secret))
            .not.toBe(signWebhookDelivery(42, "b", secret));
    });
});
