import { describe, expect, test } from "bun:test";

describe("Frontend Server", () => {
  test("can import React", () => {
    const React = require("react");
    expect(React).toBeTruthy();
  });

  test("Bun runtime is available", () => {
    // Verify Bun environment is available
    expect(typeof Bun).toBe("object");
    expect(typeof Bun.serve).toBe("function");
  });

  test("environment variables can be accessed", () => {
    // Test that env loading works
    const env = process.env;
    expect(typeof env).toBe("object");
  });
});
