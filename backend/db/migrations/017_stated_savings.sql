ALTER TABLE opportunities
  ADD COLUMN stated_hours_per_month numeric(12, 2),
  ADD COLUMN stated_cases_per_month numeric(12, 2),
  ADD COLUMN stated_savings_per_year numeric(12, 2);

ALTER TABLE opportunities
  ADD CONSTRAINT opportunities_stated_hours_check
    CHECK (stated_hours_per_month IS NULL OR stated_hours_per_month >= 0),
  ADD CONSTRAINT opportunities_stated_cases_check
    CHECK (stated_cases_per_month IS NULL OR stated_cases_per_month >= 0),
  ADD CONSTRAINT opportunities_stated_savings_check
    CHECK (stated_savings_per_year IS NULL OR stated_savings_per_year >= 0);
