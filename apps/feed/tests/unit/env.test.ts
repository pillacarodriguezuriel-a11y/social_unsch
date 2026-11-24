/**
 * Tests de validación de configuración del servicio Feed.
 */
import { loadFeedConfig, FeedConfigError, DEFAULT_FEED_PORT } from '../../src/config/env';

const VALID_PEM = '-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALRiMLAHudeSA/xKl1EW/ECBP3vFTxPN\nCHi8H6M/mf3gAWN0tSjPVIrBtZHAQrFXMrQEBVpIWRB3OmC0J0D2YoECAwEAAQ==\n-----END PUBLIC KEY-----';
const VALID_DB_URL = 'postgresql://user:pass@localhost:5432/db';

describe('loadFeedConfig', () => {
  it('should load valid config', () => {
    const config = loadFeedConfig({
      DATABASE_URL: VALID_DB_URL,
      JWT_PUBLIC_KEY: VALID_PEM,
      PORT: '4002',
    });
    expect(config.port).toBe(4002);
    expect(config.databaseUrl).toBe(VALID_DB_URL);
  });

  it('should use DEFAULT_FEED_PORT when PORT is not set', () => {
    const config = loadFeedConfig({
      DATABASE_URL: VALID_DB_URL,
      JWT_PUBLIC_KEY: VALID_PEM,
    });
    expect(config.port).toBe(DEFAULT_FEED_PORT);
  });

  it('should throw FeedConfigError when DATABASE_URL is missing', () => {
    expect(() => loadFeedConfig({ JWT_PUBLIC_KEY: VALID_PEM })).toThrow(FeedConfigError);
  });

  it('should throw FeedConfigError when JWT_PUBLIC_KEY is missing', () => {
    expect(() => loadFeedConfig({ DATABASE_URL: VALID_DB_URL })).toThrow(FeedConfigError);
  });

  it('should throw FeedConfigError for invalid DATABASE_URL scheme', () => {
    expect(() =>
      loadFeedConfig({ DATABASE_URL: 'mysql://localhost/db', JWT_PUBLIC_KEY: VALID_PEM })
    ).toThrow(FeedConfigError);
  });

  it('should throw FeedConfigError for invalid JWT_PUBLIC_KEY (no PEM header)', () => {
    expect(() =>
      loadFeedConfig({ DATABASE_URL: VALID_DB_URL, JWT_PUBLIC_KEY: 'notapem' })
    ).toThrow(FeedConfigError);
  });

  it('should NOT include DATABASE_URL in error message', () => {
    try {
      loadFeedConfig({});
    } catch (err: any) {
      expect(err.message).not.toMatch(/postgresql/);
      expect(err.message).not.toMatch(/password/);
    }
  });

  it('should throw FeedConfigError for invalid PORT value', () => {
    expect(() =>
      loadFeedConfig({ DATABASE_URL: VALID_DB_URL, JWT_PUBLIC_KEY: VALID_PEM, PORT: 'abc' })
    ).toThrow(FeedConfigError);
  });

  it('should parse ALLOWED_ORIGINS when explicitly provided', () => {
    const config = loadFeedConfig({
      DATABASE_URL: VALID_DB_URL,
      JWT_PUBLIC_KEY: VALID_PEM,
      ALLOWED_ORIGINS: 'https://app.example.com, http://localhost:3001',
    });
    expect(config.allowedOrigins).toEqual(['https://app.example.com', 'http://localhost:3001']);
  });

  it('should warn in production when ALLOWED_ORIGINS is not set', () => {
    const config = loadFeedConfig({
      DATABASE_URL: VALID_DB_URL,
      JWT_PUBLIC_KEY: VALID_PEM,
      NODE_ENV: 'production',
    });
    expect(config.warnings.length).toBeGreaterThan(0);
    expect(config.warnings[0]).toMatch(/ALLOWED_ORIGINS/);
  });

  it('should throw FeedConfigError for DATABASE_URL that is not a valid URL', () => {
    expect(() =>
      loadFeedConfig({ DATABASE_URL: 'not-a-url', JWT_PUBLIC_KEY: VALID_PEM })
    ).toThrow(FeedConfigError);
  });

  it('should use APP_PORT when PORT is not set', () => {
    const config = loadFeedConfig({
      DATABASE_URL: VALID_DB_URL,
      JWT_PUBLIC_KEY: VALID_PEM,
      APP_PORT: '4100',
    });
    expect(config.port).toBe(4100);
  });
});
