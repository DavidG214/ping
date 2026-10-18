CREATE TABLE revoked_sessions (sid text PRIMARY KEY, expires_at timestamptz NOT NULL);
ALTER TABLE responses ADD CONSTRAINT responses_workspace_id_unique UNIQUE(workspace_id,id);
ALTER TABLE assistance_tasks ALTER COLUMN delivery_id DROP NOT NULL;
ALTER TABLE assistance_tasks ADD COLUMN response_id uuid;
ALTER TABLE assistance_tasks ADD CONSTRAINT assistance_response_fk FOREIGN KEY(workspace_id,response_id) REFERENCES responses(workspace_id,id);
ALTER TABLE assistance_tasks ADD CONSTRAINT assistance_response_unique UNIQUE(workspace_id,response_id);
ALTER TABLE assistance_tasks ADD CONSTRAINT assistance_one_source CHECK ((delivery_id IS NOT NULL)::int + (response_id IS NOT NULL)::int = 1);
CREATE VIEW assistance_items AS
 SELECT t.*,p.id AS resident_id,p.name,p.language,p.shelter_id,p.assistance,
 p.safeguarding AS resident_sensitive,q.safeguarding AS request_sensitive,d.state='pending' AS actionable,
 q.message,q.seeker_name,'request'::text AS kind,NULL::text AS location_name,NULL::text AS location_address
 FROM assistance_tasks t JOIN deliveries d ON d.id=t.delivery_id JOIN residents p ON p.id=d.resident_id JOIN search_requests q ON q.id=d.request_id
 UNION ALL
 SELECT t.*,p.id AS resident_id,p.name,p.language,p.shelter_id,p.assistance,
 p.safeguarding AS resident_sensitive,q.safeguarding AS request_sensitive,true AS actionable,
 r.text AS message,'Approved reply' AS seeker_name,'response'::text AS kind,r.location_name,r.location_address
 FROM assistance_tasks t JOIN responses r ON r.id=t.response_id JOIN search_requests q ON q.id=r.request_id JOIN residents p ON p.id=q.requester_id;
