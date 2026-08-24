import type { DemandHistoryRecord } from "../../domain/types";
import type { HistoricalDemandSource } from "./contracts";

export class MockHistoricalDemandSource implements HistoricalDemandSource {
  constructor(private readonly records: DemandHistoryRecord[]) {}

  async loadHistory() {
    return structuredClone(this.records);
  }
}
