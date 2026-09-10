import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Suites share one worker for the large generated seed, so explicitly isolate rendered DOM between files.
afterEach(cleanup);
