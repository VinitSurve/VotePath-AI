import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Chat from "./Chat";
import { ExplainProvider } from "../context/ExplainContext";

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock("../services/aiService", () => ({
  askVotePathAI: vi.fn()
}));

import { askVotePathAI } from "../services/aiService";

describe("Chat Component", () => {
  beforeEach(() => {
    askVotePathAI.mockReset();
  });

  it("sends message and displays AI response", async () => {
    askVotePathAI.mockResolvedValue({
      title: "Voting",
      steps: [],
      simple: "Go vote",
      tips: [],
      source: "ECI"
    });

    render(
      <ExplainProvider>
        <Chat />
      </ExplainProvider>
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "How to vote?" } });

    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(screen.getByText("How to vote?")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Go vote/i)).toBeInTheDocument();
    });
  });

  it("shows retry button on timeout error", async () => {
    askVotePathAI.mockRejectedValue(new Error("TIMEOUT"));

    render(
      <ExplainProvider>
        <Chat />
      </ExplainProvider>
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Vote" } });

    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    // Wait for retry button to appear after error
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
      },
      { timeout: 6000 }
    );
  });
});
