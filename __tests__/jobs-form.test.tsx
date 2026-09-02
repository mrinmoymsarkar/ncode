import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiError } from "@/lib/client/api";
import JobsPage from "@/app/(app)/jobs/page";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@/lib/client/hooks", () => ({
  useCreateJob: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
  useJobs: () => ({ data: [], isLoading: false, isError: false, isFetching: false, refetch: mocks.refetch }),
}));

describe("job creation form", () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset();
  });

  it("maps server validation errors back to form fields", async () => {
    mocks.mutateAsync.mockRejectedValue(
      new ApiError(422, "Validation failed", {
        title: ["Keep the title under 80 characters"],
      }),
    );
    const user = userEvent.setup();
    render(<JobsPage />);

    await user.type(screen.getByLabelText("Source URL"), "https://cdn.example.com/video.mp4");
    await user.type(screen.getByLabelText("Title"), "Example");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    expect(await screen.findByText("Keep the title under 80 characters")).toBeInTheDocument();
  });
});
