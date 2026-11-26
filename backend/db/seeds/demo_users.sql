INSERT INTO users (email, name, role) VALUES
  ('staff@lsbu.ac.uk', 'Demo Staff', 'staff'),
  ('staff2@lsbu.ac.uk', 'Second Demo Staff', 'staff'),
  ('manager@lsbu.ac.uk', 'Demo Manager', 'manager'),
  ('engineer@lsbu.ac.uk', 'Demo Engineer', 'team')
ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role;
