import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button, buttonVariants } from "@/components/ui/button";

describe("Button", () => {
  it("is a non-submitting button by default and handles activation", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>সংরক্ষণ করুন</Button>);

    const button = screen.getByRole("button", { name: "সংরক্ষণ করুন" });
    expect(button).toHaveAttribute("type", "button");

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("supports disabled state", () => {
    render(<Button disabled>অপেক্ষা করুন</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("produces reusable link styling", () => {
    expect(buttonVariants({ variant: "outline" })).toContain("border-border");
  });
});
