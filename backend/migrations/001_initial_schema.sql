-- LeadNest initial schema
-- Multi-tenant CRM: companies, users, customers, deals, tasks, activities, ai_interactions.
-- Applied by cmd/migrate. The runner wraps each file in a transaction, so this
-- file must not contain its own BEGIN/COMMIT.

-- ---------------------------------------------------------------------------
-- Helper: auto-update updated_at column
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT        NOT NULL,
    email        TEXT,
    phone        TEXT,
    website      TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies (name);

DROP TRIGGER IF EXISTS trg_companies_updated_at ON companies;
CREATE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    full_name          TEXT NOT NULL,
    email              TEXT NOT NULL,
    password_hash      TEXT NOT NULL,
    role               TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    refresh_token_hash TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_company ON users (company_id);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES users (id) ON DELETE SET NULL,
    full_name   TEXT NOT NULL,
    email       TEXT,
    phone       TEXT,
    source      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_company ON customers (company_id);
CREATE INDEX IF NOT EXISTS idx_customers_assigned ON customers (assigned_to);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (full_name);

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- deals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deals (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    customer_id    UUID NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    assigned_to    UUID REFERENCES users (id) ON DELETE SET NULL,
    title          TEXT NOT NULL,
    value          NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency       CHAR(3) NOT NULL DEFAULT 'TND',
    status         TEXT NOT NULL CHECK (status IN (
                      'new', 'contacted', 'qualified', 'proposal',
                      'negotiation', 'won', 'lost')),
    expected_close DATE,
    closed_at      TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_company ON deals (company_id);
CREATE INDEX IF NOT EXISTS idx_deals_customer ON deals (customer_id);
CREATE INDEX IF NOT EXISTS idx_deals_assigned ON deals (assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals (status);

DROP TRIGGER IF EXISTS trg_deals_updated_at ON deals;
CREATE TRIGGER trg_deals_updated_at
    BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    assigned_to  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    customer_id  UUID REFERENCES customers (id) ON DELETE CASCADE,
    deal_id      UUID REFERENCES deals (id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT,
    status       TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'cancelled')),
    priority     TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    due_date     TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks (company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks (due_date);

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activities (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers (id) ON DELETE CASCADE,
    deal_id     UUID REFERENCES deals (id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN (
                  'call', 'email', 'meeting', 'note', 'message', 'other')),
    subject     TEXT,
    description TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_company ON activities (company_id);
CREATE INDEX IF NOT EXISTS idx_activities_customer ON activities (customer_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal ON activities (deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities (user_id);
CREATE INDEX IF NOT EXISTS idx_activities_occurred ON activities (occurred_at DESC);

DROP TRIGGER IF EXISTS trg_activities_updated_at ON activities;
CREATE TRIGGER trg_activities_updated_at
    BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- ai_interactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_interactions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL,
    prompt           TEXT,
    response         TEXT,
    model            TEXT,
    provider         TEXT,
    duration_ms      INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_company ON ai_interactions (company_id);

-- ---------------------------------------------------------------------------
-- company_dashboard view
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW company_dashboard AS
SELECT
    c.id AS company_id,
    COUNT(DISTINCT cu.id) AS total_customers,
    COUNT(DISTINCT d.id) FILTER (WHERE d.status NOT IN ('won', 'lost')) AS open_deals,
    COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'won') AS won_deals,
    COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'lost') AS lost_deals,
    COALESCE(SUM(d.value) FILTER (WHERE d.status = 'won' AND d.currency = 'TND'), 0) AS won_revenue_tnd,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'pending') AS pending_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'pending' AND t.due_date < NOW()) AS overdue_tasks
FROM companies c
LEFT JOIN customers cu ON cu.company_id = c.id
LEFT JOIN deals d ON d.company_id = c.id
LEFT JOIN tasks t ON t.company_id = c.id
GROUP BY c.id;

-- +migrate Down
DROP VIEW IF EXISTS company_dashboard;
DROP TABLE IF EXISTS ai_interactions;
DROP TABLE IF EXISTS activities;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS deals;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS companies;
DROP FUNCTION IF EXISTS set_updated_at();
