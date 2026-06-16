export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableYoutubeError(status: number, data: any) {
  const reason = data?.error?.errors?.[0]?.reason;
  const apiStatus = data?.error?.status;

  return (
    status === 409 ||
    status === 429 ||
    status >= 500 ||
    reason === "SERVICE_UNAVAILABLE" ||
    apiStatus === "ABORTED"
  );
}
