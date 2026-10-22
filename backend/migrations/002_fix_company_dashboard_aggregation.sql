-- Fix the company_dashboard view.
--
-- The original definition joined customers, deals and tasks in a single query.
-- Because those three tables are independent of each other, every deal row was
-- repeated once per (customer x task) combination, which inflated the
-- SUM(value) column. The COUNT(DISTINCT ...) columns were unaffected, so the
-- bug showed up only in won_revenue_tnd.
--
-- The view now uses one scalar subquery per metric, so each aggregate sees
-- exactly the rows that belong to the company.

CREATE OR REPLACE VIEW company_dashboard AS
SELECT
    c.id AS company_id,
    (SELECT COUNT(*)
       FROM customers cu
      WHERE cu.company_id = c.id) AS total_customers,
    (SELECT COUNT(*)
       FROM deals d
      WHERE d.company_id = c.id
        AND d.status NOT IN ('won', 'lost')) AS open_deals,
    (SELECT COUNT(*)
       FROM deals d
      WHERE d.company_id = c.id
        AND d.status = 'won') AS won_deals,
    (SELECT COUNT(*)
       FROM deals d
      WHERE d.company_id = c.id
        AND d.status = 'lost') AS lost_deals,
    (SELECT COALESCE(SUM(d.value), 0)
       FROM deals d
      WHERE d.company_id = c.id
        AND d.status = 'won'
        AND d.currency = 'TND') AS won_revenue_tnd,
    (SELECT COUNT(*)
       FROM tasks t
      WHERE t.company_id = c.id
        AND t.status = 'pending') AS pending_tasks,
    (SELECT COUNT(*)
       FROM tasks t
      WHERE t.company_id = c.id
        AND t.status = 'pending'
        AND t.due_date < NOW()) AS overdue_tasks
FROM companies c;

-- +migrate Down
-- Restores the previous definition. Rolling this migration back reintroduces
-- the inflated revenue figure, so it is normally better to leave 002 applied.
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
