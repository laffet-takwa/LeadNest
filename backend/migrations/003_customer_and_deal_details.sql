-- Add the customer and deal detail fields the API contract needs.
--
-- The customer form needs the customer's organisation and a free-text note,
-- and the deal form needs a description. All three columns are nullable
-- TEXT, so existing rows are unaffected and the change is reversible.

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS company TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE deals
    ADD COLUMN IF NOT EXISTS description TEXT;

-- +migrate Down
ALTER TABLE deals DROP COLUMN IF EXISTS description;
ALTER TABLE customers DROP COLUMN IF EXISTS notes;
ALTER TABLE customers DROP COLUMN IF EXISTS company;
