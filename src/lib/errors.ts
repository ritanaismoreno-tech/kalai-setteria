export class SignatureVerificationError extends Error {
  constructor(message = "Invalid webhook signature") {
    super(message);
    this.name = "SignatureVerificationError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
