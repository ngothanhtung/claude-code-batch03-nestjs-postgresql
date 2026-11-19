export type TokenType = 'access' | 'refresh';

/**
 * Claims carried by our JWTs. Kept minimal and non-sensitive: role/isActive
 * are NOT trusted from the token — they are re-read from the DB on each request.
 */
export interface JwtPayload {
  /** User id. */
  sub: number;
  typ: TokenType;
  /**
   * Password fingerprint: changes whenever the password hash changes, so
   * every token issued before a password change stops working.
   */
  pwv: string;
  iat?: number;
  exp?: number;
  iss?: string;
}
