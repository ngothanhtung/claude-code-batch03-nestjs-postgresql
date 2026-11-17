import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

function scrypt(password: string, salt: Buffer, keylen: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Password hashing using Node's built-in scrypt (no native deps).
 * Stored format: scrypt$<salt hex>$<hash hex> (~168 chars, fits VARCHAR(255)).
 */
@Injectable()
export class PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derived = await scrypt(password, salt, KEY_LENGTH);
    return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [algo, saltHex, hashHex] = stored.split('$');
    if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const derived = await scrypt(
      password,
      Buffer.from(saltHex, 'hex'),
      expected.length,
    );
    return timingSafeEqual(derived, expected);
  }
}
