import { describe, expect, it } from "vitest";
import { validateNewPassword } from "./auth";

describe("validateNewPassword", () => {
  it("rejects passwords shorter than 8 characters", () => {
    expect(validateNewPassword("1234567", "1234567")).toBe(
      "Password lazima iwe na herufi 8 au zaidi",
    );
  });

  it("accepts a matching password of exactly 8 characters", () => {
    expect(validateNewPassword("12345678", "12345678")).toBeNull();
  });

  it("rejects passwords longer than 128 characters", () => {
    const password = "a".repeat(129);
    expect(validateNewPassword(password, password)).toBe("Password isizidi herufi 128");
  });

  it("rejects a confirmation that does not match", () => {
    expect(validateNewPassword("salama123", "salama124")).toBe("Password hazilingani");
  });
});
