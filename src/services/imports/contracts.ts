export type ImportIssueSeverity = "warning" | "error";

export interface ImportIssue {
  row: number;
  field: string;
  code: string;
  severity: ImportIssueSeverity;
  message: string;
}

export interface ImportAdapter<TContext, TResult> {
  readonly formatId: string;
  readonly acceptedExtensions: string[];
  parse(file: Blob, context: TContext): Promise<TResult>;
}
