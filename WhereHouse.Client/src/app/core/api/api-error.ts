import { HttpErrorResponse } from '@angular/common/http';

interface ProblemDetails {
  readonly detail?: string;
  readonly errors?: Readonly<Record<string, readonly string[]>>;
  readonly title?: string;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse) || !isProblemDetails(error.error)) {
    return fallback;
  }

  const validationMessage = Object.values(error.error.errors ?? {})
    .flat()
    .find((message) => message.length > 0);

  return validationMessage ?? error.error.detail ?? error.error.title ?? fallback;
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  return typeof value === 'object' && value !== null;
}
