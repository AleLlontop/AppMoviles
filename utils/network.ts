export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof TypeError) return true;
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as any).message).toLowerCase();
    return (
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('fetch error')
    );
  }
  return false;
};
