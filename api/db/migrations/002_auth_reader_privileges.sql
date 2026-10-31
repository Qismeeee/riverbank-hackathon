-- CORE-01.19: isolated privilege group for the auth grant resolver only.
-- Run after 001 with an authorized migration role. This does not create a login,
-- grant membership, change PUBLIC privileges, or configure a connection.
-- If the role already exists, fail rather than trusting its existing privileges.
BEGIN;

CREATE ROLE riverbank_auth_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO riverbank_auth_reader;
GRANT USAGE ON TYPE public.application_role TO riverbank_auth_reader;

GRANT SELECT (identity_id, issuer, subject, is_enabled)
    ON public.auth_identities TO riverbank_auth_reader;
GRANT SELECT (role_assignment_id, identity_id, role, granted_at, expires_at, revoked_at)
    ON public.identity_roles TO riverbank_auth_reader;
GRANT SELECT (role_assignment_id, role, seller_id, granted_at, expires_at, revoked_at)
    ON public.seller_access_grants TO riverbank_auth_reader;
GRANT SELECT (seller_id, external_shop_ref)
    ON public.sellers TO riverbank_auth_reader;

COMMIT;
