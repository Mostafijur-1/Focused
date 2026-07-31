import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SignInForm, SignUpForm } from "@/features/auth/ui/auth-forms";
import { AuthProvider } from "@/features/auth/ui/auth-provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

describe("authentication forms", () => {
  it("renders native Bangla sign-in copy and accessible fields", () => {
    render(
      <AuthProvider>
        <SignInForm locale="bn-BD" />
      </AuthProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "আবার স্বাগতম" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });

  it("prevents invalid registration without sending a request", async () => {
    const request = vi.spyOn(globalThis, "fetch");
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <SignUpForm locale="en" />
      </AuthProvider>,
    );
    await user.type(screen.getByLabelText("Your name"), "P");
    await user.type(screen.getByLabelText("Email"), "bad-email");
    await user.type(screen.getByLabelText("Password"), "weak");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(request).not.toHaveBeenCalled();
    request.mockRestore();
  });
});
