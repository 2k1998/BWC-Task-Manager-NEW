export function extractErrorMessage(error: any): string {
  if (!error) return 'An error occurred';
  if (typeof error === 'string') return error;
  if (error.detail) {
    if (typeof error.detail === 'string') return error.detail;
    if (Array.isArray(error.detail)) {
      return error.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
    }
  }
  if (error.message) return error.message;
  return 'An error occurred';
}
