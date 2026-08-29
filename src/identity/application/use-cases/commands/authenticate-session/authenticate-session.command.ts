/**
 * `presentedToken` is the cookie's plaintext exactly as the client sent it.
 * The handler is what puts it through `SecretToken.hashOf`: presentation may
 * not import a domain value object, which is why the guard dispatches this
 * command rather than hashing and calling the port itself.
 */
export class AuthenticateSessionCommand {
  constructor(public readonly presentedToken: string) {}
}
