CREATE TABLE IF NOT EXISTS app_settings (key text PRIMARY KEY, value text NOT NULL);
INSERT INTO app_settings VALUES ('environment','demo') ON CONFLICT DO NOTHING;
CREATE TABLE shelters (id text PRIMARY KEY, name text NOT NULL, address text NOT NULL, lat double precision NOT NULL, lng double precision NOT NULL);
INSERT INTO shelters VALUES
('A','Cypress Hall','Demo help desk A · Orange County, FL',28.555,-81.395),
('B','Lantern Center','Demo help desk B · Orange County, FL',28.515,-81.345),
('C','Meadow Commons','Demo help desk C · Orange County, FL',28.575,-81.295);
CREATE TABLE workspaces (id uuid PRIMARY KEY, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE residents (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 name text NOT NULL, age_band text NOT NULL CHECK(age_band IN ('under_18','18_29','30_44','45_64','65_plus','unknown')),
 clue text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '', language text NOT NULL DEFAULT 'English',
 assistance boolean NOT NULL DEFAULT false, shelter_id text NOT NULL REFERENCES shelters,
 safeguarding boolean NOT NULL DEFAULT false, UNIQUE(workspace_id,id)
);
CREATE TABLE resident_credentials (resident_id uuid PRIMARY KEY REFERENCES residents ON DELETE CASCADE, code text UNIQUE NOT NULL, pin_hash text NOT NULL);
CREATE TABLE staff_accounts (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 username text UNIQUE NOT NULL, password_hash text NOT NULL, shelter_id text NOT NULL REFERENCES shelters,
 role text NOT NULL CHECK(role IN ('volunteer','safeguarding')), UNIQUE(workspace_id,id)
);
CREATE TABLE case_access (
 workspace_id uuid NOT NULL, staff_id uuid NOT NULL, resident_id uuid NOT NULL,
 PRIMARY KEY(workspace_id,staff_id,resident_id),
 FOREIGN KEY(workspace_id,staff_id) REFERENCES staff_accounts(workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(workspace_id,resident_id) REFERENCES residents(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE search_requests (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 requester_id uuid NOT NULL, created_by uuid NOT NULL, target_name text NOT NULL, age_band text NOT NULL,
 clue text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '', message text NOT NULL,
 seeker_name text NOT NULL, safeguarding boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,requester_id) REFERENCES residents(workspace_id,id),
 FOREIGN KEY(workspace_id,created_by) REFERENCES staff_accounts(workspace_id,id)
);
CREATE TABLE deliveries (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 request_id uuid NOT NULL, resident_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','declined','wrong_person','replied','cancelled')),
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,request_id,resident_id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES search_requests(workspace_id,id),
 FOREIGN KEY(workspace_id,resident_id) REFERENCES residents(workspace_id,id)
);
CREATE UNIQUE INDEX one_active_candidate ON deliveries(workspace_id,request_id) WHERE state IN ('pending','replied');
CREATE TABLE responses (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 request_id uuid NOT NULL, delivery_id uuid NOT NULL, text text NOT NULL,
 shelter_id text REFERENCES shelters, location_name text, location_address text,
 UNIQUE(workspace_id,request_id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES search_requests(workspace_id,id),
 FOREIGN KEY(workspace_id,delivery_id) REFERENCES deliveries(workspace_id,id)
);
CREATE TABLE assistance_tasks (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 delivery_id uuid NOT NULL, state text NOT NULL CHECK(state IN ('pending','claimed','presented','cancelled')),
 claimant_id uuid, lease_until timestamptz,
 UNIQUE(workspace_id,delivery_id),
 FOREIGN KEY(workspace_id,delivery_id) REFERENCES deliveries(workspace_id,id),
 FOREIGN KEY(workspace_id,claimant_id) REFERENCES staff_accounts(workspace_id,id)
);
CREATE TABLE safeguarding_cases (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 resident_id uuid, request_id uuid, assigned_to uuid NOT NULL, reason text NOT NULL, acknowledged boolean NOT NULL DEFAULT false,
 FOREIGN KEY(workspace_id,resident_id) REFERENCES residents(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES search_requests(workspace_id,id),
 FOREIGN KEY(workspace_id,assigned_to) REFERENCES staff_accounts(workspace_id,id)
);
CREATE TABLE sessions (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL);
CREATE INDEX sessions_expire ON sessions(expire);
CREATE TABLE login_attempts (key text PRIMARY KEY, attempts integer NOT NULL, resets_at timestamptz NOT NULL);
CREATE TABLE mutation_receipts (
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE, actor_id uuid NOT NULL, key text NOT NULL,
 fingerprint text NOT NULL, result jsonb NOT NULL, PRIMARY KEY(workspace_id,actor_id,key)
);
CREATE TABLE audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 actor_id uuid NOT NULL, action text NOT NULL, target_id text, created_at timestamptz NOT NULL DEFAULT now()
);
