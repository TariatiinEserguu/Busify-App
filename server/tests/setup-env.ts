// Runs before every test file, before any server module is imported.
process.env.NODE_ENV = 'test';
process.env.BUSIFY_ENV_FILE = 'none'; // ignore the developer's .env
process.env.DATABASE_URL = 'file:../data/test.db';
process.env.DEMO_MODE = 'false';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.BCRYPT_ROUNDS = '4';
process.env.LAN_ONLY = 'true';
