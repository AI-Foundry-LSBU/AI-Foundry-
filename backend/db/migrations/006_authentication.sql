-- Existing requests and user IDs are preserved. Accounts without a password cannot sign in.
ALTER TABLE users ADD COLUMN password_hash text;
ALTER TABLE users ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN auth_version integer NOT NULL DEFAULT 1;

-- Column names match connect-pg-simple's PostgreSQL session store.
CREATE TABLE auth_sessions (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX auth_sessions_expire_idx ON auth_sessions (expire);

-- Rename the four existing demo usernames without replacing users or their requests.
UPDATE users SET email = CASE email
  WHEN 'staff@example.com' THEN 'staff@lsbu.ac.uk'
  WHEN 'staff2@example.com' THEN 'staff2@lsbu.ac.uk'
  WHEN 'manager@example.com' THEN 'manager@lsbu.ac.uk'
  WHEN 'team@example.com' THEN 'engineer@lsbu.ac.uk'
END
WHERE email IN ('staff@example.com', 'staff2@example.com', 'manager@example.com', 'team@example.com');
