import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { registerSchema, loginSchema } from "@/lib/validators/auth";

describe("Auth - Password Hashing", () => {
  it("should hash a password and verify correctly with the original password", async () => {
    const password = "mySecretPassword123!";
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(typeof hash).toBe("string");

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it("should fail verification with an incorrect password", async () => {
    const password = "mySecretPassword123!";
    const wrongPassword = "wrongPassword123!";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(wrongPassword, hash);
    expect(isValid).toBe(false);
  });
});

describe("Auth - registerSchema", () => {
  it("should validate and normalize a valid registration payload with trimming and lowercase email", () => {
    const input = {
      email: "  TestUser@Example.COM  ",
      displayName: "  John Doe  ",
      password: "securePassword123",
      role: "player",
    };

    const result = registerSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("testuser@example.com");
      expect(result.data.displayName).toBe("John Doe");
      expect(result.data.password).toBe("securePassword123");
      expect(result.data.role).toBe("player");
    }
  });

  it("should reject invalid email formats", () => {
    const invalidEmails = [
      "",
      "   ",
      "not-an-email",
      "user@",
      "@domain.com",
      "user@domain",
    ];

    for (const email of invalidEmails) {
      const result = registerSchema.safeParse({
        email,
        displayName: "Valid Name",
        password: "securePassword123",
      });
      expect(result.success).toBe(false);
    }
  });

  it("should reject passwords shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      email: "valid@example.com",
      displayName: "Valid Name",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("should reject display names shorter than 2 characters after trim", () => {
    const result = registerSchema.safeParse({
      email: "valid@example.com",
      displayName: " a ",
      password: "securePassword123",
    });
    expect(result.success).toBe(false);
  });
});

describe("Auth - loginSchema", () => {
  it("should validate a valid login payload and trim the email", () => {
    const input = {
      email: "  User@Example.com  ",
      password: "secretPassword",
    };

    const result = loginSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("User@Example.com");
      expect(result.data.password).toBe("secretPassword");
    }
  });

  it("should reject invalid email formats in login", () => {
    const invalidEmails = ["", "   ", "not-an-email", "user@"];

    for (const email of invalidEmails) {
      const result = loginSchema.safeParse({
        email,
        password: "secretPassword",
      });
      expect(result.success).toBe(false);
    }
  });

  it("should reject empty password in login", () => {
    const result = loginSchema.safeParse({
      email: "valid@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});
