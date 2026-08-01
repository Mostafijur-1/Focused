import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarketingMobileNavigation } from "@/components/shell/marketing-mobile-navigation";
import { getSiteCopy } from "@/i18n/site-copy";

describe("MarketingMobileNavigation", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: vi.fn(function showModal(this: HTMLDialogElement) {
        this.open = true;
      }),
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: vi.fn(function close(this: HTMLDialogElement) {
        this.open = false;
      }),
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  });

  it("exposes sign-in and account creation in the Bangla mobile menu", async () => {
    const user = userEvent.setup();
    const copy = getSiteCopy("bn-BD");

    render(<MarketingMobileNavigation locale="bn-BD" copy={copy} />);

    await user.click(screen.getByRole("button", { name: copy.openMenu }));

    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    expect(screen.getByRole("link", { name: copy.signIn })).toHaveAttribute(
      "href",
      "/bn-BD/sign-in",
    );
    expect(
      screen.getByRole("link", { name: copy.createAccount }),
    ).toHaveAttribute("href", "/bn-BD/sign-up");

    await user.click(screen.getByRole("button", { name: copy.closeMenu }));
    expect(screen.getByRole("dialog", { hidden: true })).not.toHaveAttribute(
      "open",
    );
  });

  it("uses localized English authentication links", async () => {
    const user = userEvent.setup();
    const copy = getSiteCopy("en");

    render(<MarketingMobileNavigation locale="en" copy={copy} />);
    await user.click(screen.getByRole("button", { name: copy.openMenu }));

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/en/sign-in",
    );
    expect(
      screen.getByRole("link", { name: "Create account" }),
    ).toHaveAttribute("href", "/en/sign-up");
  });
});
