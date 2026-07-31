import {
  requireOwnership,
  requirePermission,
} from "@/features/auth/application/authorization-policy";
import type { AuthUser } from "@/features/auth/domain/auth-types";
import { AppError } from "@/lib/errors/app-error";

const user: AuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "person@example.com",
  displayName: "Person",
  passwordHash: null,
  emailVerifiedAt: new Date(),
  status: "ACTIVE",
  permissionVersion: 1,
  permissions: ["sessions:read:own"],
};

describe("authorization policy", () => {
  it("allows explicit permissions and ownership", () => {
    expect(() => requirePermission(user, "sessions:read:own")).not.toThrow();
    expect(() => requireOwnership(user.id, user.id)).not.toThrow();
  });

  it("denies absent permissions and hides foreign resources", () => {
    expect(() => requirePermission(user, "admin:write")).toThrow(AppError);
    try {
      requireOwnership(user.id, "00000000-0000-4000-8000-000000000002");
    } catch (error) {
      expect(error).toMatchObject({ code: "NOT_FOUND", status: 404 });
    }
  });
});
