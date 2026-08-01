import { render, screen } from "@testing-library/react";

import { GoogleAuthPanel } from "@/features/auth/ui/auth-forms";
import { getAuthCopy } from "@/features/auth/ui/auth-copy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

describe("Google-only Authentication", () => {
  it("renders native Bangla Google Authentication without password fields", () => {
    const copy = getAuthCopy("bn-BD");

    render(<GoogleAuthPanel locale="bn-BD" intent="sign-in" />);

    expect(
      screen.getByRole("heading", { name: copy.signInTitle }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: copy.google }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("uses the same secure Google flow for account creation", () => {
    const copy = getAuthCopy("en");

    render(<GoogleAuthPanel locale="en" intent="sign-up" />);

    expect(
      screen.getByRole("heading", { name: copy.signUpTitle }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/never sees or stores your Google password/i),
    ).toBeInTheDocument();
  });
});
