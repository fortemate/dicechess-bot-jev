/** Stable failure categories; none authorizes an alternative playing strategy. */
export type PlannerErrorCode =
  | "invalid_configuration"
  | "missing_legal_moves"
  | "invalid_tree"
  | "invalid_position"
  | "invalid_choice"
  | "question_too_large"
  | "provider_failed"
  | "cancelled"
  | "deadline_exceeded";

export class PlannerError extends Error {
  constructor(readonly code: PlannerErrorCode) {
    super(code);
    this.name = "PlannerError";
  }
}
