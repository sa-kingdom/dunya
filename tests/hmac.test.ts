import { describe, expect, it } from "bun:test";
import {
    buildHmacMessage,
    getInternalHmacSecret,
    signInternalRequest,
    verifyInternalRequest,
} from "../src/utils/hmac.ts";

const secret = getInternalHmacSecret();

describe("hmac", () => {
    it("builds the canonical signed message", () => {
        expect(buildHmacMessage("get", "/discussions/feed?limit=20", 123)).toBe(
            "123\nGET\n/discussions/feed?limit=20",
        );
    });

    it("verifies a correctly signed request", () => {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = signInternalRequest(
            "GET",
            "/discussions/feed?limit=20",
            timestamp,
            secret,
        );
        const request = new Request("http://localhost/discussions/feed?limit=20", {
            method: "GET",
            headers: {
                "X-Timestamp": String(timestamp),
                "X-Signature": signature,
            },
        });
        expect(verifyInternalRequest(request)).toBeNull();
    });

    it("rejects a request with a bad signature", () => {
        const timestamp = Math.floor(Date.now() / 1000);
        const request = new Request("http://localhost/discussions/feed?limit=20", {
            method: "GET",
            headers: {
                "X-Timestamp": String(timestamp),
                "X-Signature": "deadbeef",
            },
        });
        const rejection = verifyInternalRequest(request);
        expect(rejection).not.toBeNull();
        expect(rejection?.status).toBe(401);
    });

    it("rejects a request with a stale timestamp", () => {
        const timestamp = Math.floor(Date.now() / 1000) - 3600;
        const signature = signInternalRequest("GET", "/discussions/feed", timestamp, secret);
        const request = new Request("http://localhost/discussions/feed", {
            method: "GET",
            headers: {
                "X-Timestamp": String(timestamp),
                "X-Signature": signature,
            },
        });
        const rejection = verifyInternalRequest(request);
        expect(rejection).not.toBeNull();
        expect(rejection?.status).toBe(401);
    });

    it("rejects a request without signature headers", () => {
        const request = new Request("http://localhost/discussions/feed", {
            method: "GET",
        });
        const rejection = verifyInternalRequest(request);
        expect(rejection).not.toBeNull();
        expect(rejection?.status).toBe(401);
    });
});
