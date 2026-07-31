import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

describe("Card", () => {
  it("composes semantic content without hiding native attributes", () => {
    render(
      <Card aria-label="আজকের পরিকল্পনা">
        <CardHeader>
          <CardTitle>প্রধান কাজ</CardTitle>
          <CardDescription>একটি গুরুত্বপূর্ণ কাজ বেছে নিন।</CardDescription>
        </CardHeader>
        <CardContent>প্রস্তাবনার খসড়া শেষ করুন</CardContent>
      </Card>,
    );

    expect(
      screen.getByRole("region", { name: "আজকের পরিকল্পনা" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "প্রধান কাজ" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("একটি গুরুত্বপূর্ণ কাজ বেছে নিন।"),
    ).toBeInTheDocument();
    expect(screen.getByText("প্রস্তাবনার খসড়া শেষ করুন")).toBeInTheDocument();
  });
});
