CREATE TABLE solution_catalogue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 2000),
  keywords text[] NOT NULL DEFAULT '{}',
  href text CHECK (href IS NULL OR href ~ '^https://'),
  access_instructions text CHECK (access_instructions IS NULL OR length(btrim(access_instructions)) BETWEEN 1 AND 1000),
  visibility text NOT NULL DEFAULT 'all_users' CHECK (visibility IN ('all_users', 'manager_only')),
  active boolean NOT NULL DEFAULT true,
  verified boolean NOT NULL DEFAULT false,
  verification_notes text CHECK (verification_notes IS NULL OR length(btrim(verification_notes)) BETWEEN 1 AND 2000),
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (href IS NOT NULL OR access_instructions IS NOT NULL),
  CHECK ((verified AND verified_by IS NOT NULL AND verified_at IS NOT NULL AND verification_notes IS NOT NULL)
      OR (NOT verified AND verified_by IS NULL AND verified_at IS NULL)),
  CHECK (cardinality(keywords) <= 20)
);

CREATE INDEX solution_catalogue_published ON solution_catalogue (visibility, name, id)
  WHERE active AND verified;

-- Preserve the prototype examples as drafts, not as claims verified by a migration.
-- A manager must check the content/access route and explicitly verify each record.
INSERT INTO solution_catalogue (name, description, keywords, href, access_instructions) VALUES
  ('Moodle', 'LSBU virtual learning environment for module materials and assignments.',
   ARRAY['moodle','vle','module','lecture','coursework','assignment'], 'https://vle.lsbu.ac.uk', NULL),
  ('myLSBU', 'LSBU student portal and app. Confirm the relevant current features before recommending it.',
   ARRAY['mylsbu','student','portal','timetable','attendance'], 'https://my.lsbu.ac.uk', NULL),
  ('MyAccount', 'LSBU enquiry service. Confirm the relevant current support route before recommending it.',
   ARRAY['myaccount','enquiry','support','finance','wellbeing'], 'https://myaccount.lsbu.ac.uk', NULL),
  ('LSBU Careers Hub', 'LSBU careers and employability service.',
   ARRAY['careers','jobs','placements','internships','employability'], 'https://careershub.lsbu.ac.uk', NULL),
  ('IT Services', 'LSBU IT support. Confirm the current staff access route before recommending it.',
   ARRAY['it','password','wifi','printing','software'], 'https://www.lsbu.ac.uk/about-us/professional-services/it',
   'On the Connect staff intranet, look for the current IT support portal.'),
  ('LSBU Library', 'LSBU library resources and study support.',
   ARRAY['library','books','journals','articles','referencing'], 'https://library.lsbu.ac.uk', NULL);
