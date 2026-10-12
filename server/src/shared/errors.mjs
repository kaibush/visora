/** Application errors are transport independent; HTTP status mapping lives in plugins/http. */
export class AppError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}
