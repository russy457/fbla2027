/**
 * GoogleSignInButton.test.tsx
 * "Continue with Google": success hands the parent whether the account is
 * new, closing the Google window shows nothing, and a real failure shows a
 * plain sentence with role="alert" and frees the button.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFormError } from "@/lib/authClient";
import { GoogleSignInButton } from "./GoogleSignInButton";

const signInWithGoogle = vi.fn();
vi.mock("@/lib/authClient", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/authClient")>();
  return { ...original, signInWithGoogle: () => signInWithGoogle() };
});

const button = () => screen.getByRole("button", { name: /Google/ });

describe("GoogleSignInButton", () => {
  beforeEach(() => {
    signInWithGoogle.mockReset();
  });

  it("passes isNewUser to the parent and keeps the parent's redirect held", async () => {
    signInWithGoogle.mockResolvedValue({ isNewUser: true });
    const onSignedIn = vi.fn();
    const onPendingChange = vi.fn();
    render(<GoogleSignInButton onSignedIn={onSignedIn} onPendingChange={onPendingChange} />);

    fireEvent.click(button());

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith({ isNewUser: true }));
    expect(onPendingChange).toHaveBeenCalledWith(true);
    expect(onPendingChange).not.toHaveBeenCalledWith(false);
  });

  it("says nothing when the person closes the Google window", async () => {
    signInWithGoogle.mockResolvedValue(null);
    const onSignedIn = vi.fn();
    const onPendingChange = vi.fn();
    render(<GoogleSignInButton onSignedIn={onSignedIn} onPendingChange={onPendingChange} />);

    fireEvent.click(button());

    await waitFor(() => expect(onPendingChange).toHaveBeenLastCalledWith(false));
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(button()).toBeEnabled();
  });

  it("shows the friendly message when sign-in fails", async () => {
    signInWithGoogle.mockRejectedValue(new AuthFormError("Your browser blocked the Google sign-in window."));
    render(<GoogleSignInButton onSignedIn={vi.fn()} />);

    fireEvent.click(button());

    expect(await screen.findByRole("alert")).toHaveTextContent("Your browser blocked the Google sign-in window.");
    expect(button()).toBeEnabled();
  });
});
