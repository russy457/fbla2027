/**
 * MarkdownView.test.tsx
 * The article renderer must never create markup from text: HTML-looking
 * content stays literal, unsafe links lose their href, and notes and lists
 * render as real elements.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "@/lib/help";
import { MarkdownView } from "./MarkdownView";

const renderMarkdown = (markdown: string, headingOffset: 0 | 1 = 0) =>
  render(
    <MemoryRouter>
      <MarkdownView blocks={parseMarkdown(markdown)} headingOffset={headingOffset} />
    </MemoryRouter>
  );

describe("MarkdownView", () => {
  it("keeps HTML in content as literal text", () => {
    const { container } = renderMarkdown('<script>alert("x")</script> and <img src=x onerror=alert(1)>');
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/<script>alert/)).toBeInTheDocument();
  });

  it("links internal paths and drops external hrefs", () => {
    renderMarkdown("See [kiosk](/help/kiosk-check-in) or [elsewhere](https://example.com).");
    expect(screen.getByRole("link", { name: "kiosk" })).toHaveAttribute("href", "/help/kiosk-check-in");
    expect(screen.queryByRole("link", { name: "elsewhere" })).toBeNull();
    expect(screen.getByText("elsewhere")).toBeInTheDocument();
  });

  it("renders notes, lists, code, and offset headings", () => {
    renderMarkdown("## Steps\n\n1. One\n2. Two\n\n> Coming soon: QR\n\nType `123456`.", 1);
    expect(screen.getByRole("heading", { level: 3, name: "Steps" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("complementary")).toHaveTextContent("Coming soon: QR");
    expect(screen.getByText("123456").tagName).toBe("CODE");
  });
});
