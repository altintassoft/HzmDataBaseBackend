-- Seed Data for HZM Platform
-- Real user: ozgurhzm@gmail.com / 135427

-- Insert tenant
INSERT INTO core.tenants (id, name, slug, default_currency, plan, is_active)
VALUES (1, 'HZM Organization', 'hzm-org', 'USD', 'pro', true)
ON CONFLICT DO NOTHING;

-- Insert user (password: 135427 - bcrypt hashed)
-- Hash generated with: bcrypt.hash('135427', 10)
INSERT INTO core.users (tenant_id, email, password_hash, role, is_active)
VALUES (
  1,
  'ozgurhzm@gmail.com',
  '$2b$10$YhpSpV/y4c1F8v9304YtyOyCizkZoEFekUwT5oeTJkoFkdpX3VBtS',
  'admin',
  true
)
ON CONFLICT (tenant_id, email) DO NOTHING;

-- Reset sequence
SELECT setval('core.tenants_id_seq', (SELECT MAX(id) FROM core.tenants));
SELECT setval('core.users_id_seq', (SELECT MAX(id) FROM core.users));

