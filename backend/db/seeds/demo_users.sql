INSERT INTO users (email, name, role) VALUES
  ('staff@example.com', 'Demo Staff', 'staff'),
  ('staff2@example.com', 'Second Demo Staff', 'staff'),
  ('manager@example.com', 'Demo Manager', 'manager'),
  ('team@example.com', 'Demo Engineer', 'team')
ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role;
