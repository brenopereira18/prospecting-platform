export class AssetError extends Error {
  constructor(
    public readonly code:
      | "INVALID_IMAGE"
      | "TOO_LARGE"
      | "NOT_FOUND"
      | "IN_USE"
      | "STORAGE_ERROR"
      | "INVALID_REQUEST"
      | "TIMEOUT",
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
