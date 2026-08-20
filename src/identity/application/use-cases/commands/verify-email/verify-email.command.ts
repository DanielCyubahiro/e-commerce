/**
 * `token` is the raw plaintext presented by the client, not a `SecretToken`: a
 * command crosses from presentation, which may not import a domain value
 * object. The handler is what hashes it for lookup.
 */
export class VerifyEmailCommand {
  constructor(public readonly token: string) {}
}
