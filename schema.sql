CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,display_name TEXT,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS identities(provider TEXT NOT NULL,subject TEXT NOT NULL,user_id TEXT NOT NULL,PRIMARY KEY(provider,subject));
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS otp_challenges(id TEXT PRIMARY KEY,email TEXT NOT NULL,code_hash TEXT NOT NULL,ip_hash TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,used_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_challenges(email,created_at);
CREATE INDEX IF NOT EXISTS idx_otp_ip ON otp_challenges(ip_hash,created_at);
CREATE TABLE IF NOT EXISTS oauth_flows(state_hash TEXT PRIMARY KEY,provider TEXT NOT NULL,verifier TEXT NOT NULL,nonce TEXT NOT NULL,expires_at INTEGER NOT NULL);