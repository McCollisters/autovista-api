import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import {
  SHARE_EMAIL_RATE_LIMIT_MAX,
  TRUST_PROXY_HOPS,
  publicLookupRateLimit,
  shareEmailRateLimit,
} from "@/core/middleware/publicRateLimit";

/**
 * Production X-Forwarded-For, closest proxy last:
 * spoofed value, viewer, CloudFront, load balancer.
 */
const forwardedFor = (viewer: string, spoof = "198.51.100.9") =>
  `${spoof}, ${viewer}, 198.51.100.10, 192.0.2.20`;

describe("publicLookupRateLimit", () => {
  let errorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  const buildApp = () => {
    const app = express();
    app.set("trust proxy", TRUST_PROXY_HOPS);
    app.get("/lookup", publicLookupRateLimit, (req, res) => {
      res.status(200).json({ ip: req.ip });
    });
    return app;
  };

  it("limits by viewer IP and ignores a spoofed leftmost address", async () => {
    const app = buildApp();
    const viewer = "203.0.113.8";

    for (let i = 0; i < 30; i += 1) {
      const response = await request(app)
        .get("/lookup")
        .set("X-Forwarded-For", forwardedFor(viewer, `198.51.100.${i + 1}`));

      expect(response.status).toBe(200);
      expect(response.body.ip).toBe(viewer);
    }

    const blocked = await request(app)
      .get("/lookup")
      .set("X-Forwarded-For", forwardedFor(viewer, "203.0.113.50"));

    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toBe(
      "Too many requests. Please try again later.",
    );

    const otherViewer = await request(app)
      .get("/lookup")
      .set("X-Forwarded-For", forwardedFor("203.0.113.9", "203.0.113.51"));

    expect(otherViewer.status).toBe(200);
    expect(otherViewer.body.ip).toBe("203.0.113.9");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("shareEmailRateLimit", () => {
  it("allows well above the old 10-per-hour cap", async () => {
    expect(SHARE_EMAIL_RATE_LIMIT_MAX).toBe(500);

    const app = express();
    app.set("trust proxy", TRUST_PROXY_HOPS);
    app.post("/share", shareEmailRateLimit, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const viewer = "203.0.113.20";
    for (let i = 0; i < 25; i += 1) {
      const response = await request(app)
        .post("/share")
        .set("X-Forwarded-For", forwardedFor(viewer));

      expect(response.status).toBe(200);
    }
  });
});
