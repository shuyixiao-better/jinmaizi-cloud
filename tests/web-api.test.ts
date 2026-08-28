import { describe, expect, it } from "vitest";
import { json } from "../src/web/lib/api";

describe("json request options", () => {
  it("无请求体时仍声明 JSON Content-Type", () => {
    const options = json("POST");

    expect(options.method).toBe("POST");
    expect(new Headers(options.headers).get("Content-Type")).toBe("application/json");
    expect(options.body).toBeUndefined();
  });

  it("有请求体时将其序列化为 JSON", () => {
    const options = json("POST", { enabled: true });

    expect(options.body).toBe('{"enabled":true}');
  });
});
