import { describe, it, expect, afterEach } from "@jest/globals";
import { getPortalBaseUrl } from "@/config/portalBaseUrl";

describe("getPortalBaseUrl", () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
    PORTAL_BASE_URL: process.env.PORTAL_BASE_URL,
  };

  afterEach(() => {
    restore("NODE_ENV", original.NODE_ENV);
    restore("PUBLIC_APP_URL", original.PUBLIC_APP_URL);
    restore("PORTAL_BASE_URL", original.PORTAL_BASE_URL);
  });

  it("uses the production portal when NODE_ENV is unset", () => {
    delete process.env.NODE_ENV;
    delete process.env.PUBLIC_APP_URL;
    delete process.env.PORTAL_BASE_URL;

    expect(getPortalBaseUrl()).toBe("https://autovista.mccollisters.com");
  });

  it("uses localhost only for development and test", () => {
    delete process.env.PUBLIC_APP_URL;
    delete process.env.PORTAL_BASE_URL;

    process.env.NODE_ENV = "development";
    expect(getPortalBaseUrl()).toBe("http://localhost:3000");

    process.env.NODE_ENV = "production";
    expect(getPortalBaseUrl()).toBe("https://autovista.mccollisters.com");
  });

  it("prefers an explicit portal URL", () => {
    process.env.NODE_ENV = "production";
    process.env.PUBLIC_APP_URL = "https://dogqvekvr5n1p.cloudfront.net/";

    expect(getPortalBaseUrl()).toBe("https://dogqvekvr5n1p.cloudfront.net");
  });
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
