-- Revoke only the grants from 002; retain the role and all data. Before use,
-- inventory and revoke any login memberships separately. Does not remove
-- privileges inherited from PUBLIC, other roles, or independently granted ACLs.
BEGIN;

REVOKE SELECT (identity_id, issuer, subject, is_enabled)
    ON public.auth_identities FROM riverbank_auth_reader;
REVOKE SELECT (role_assignment_id, identity_id, role, granted_at, expires_at, revoked_at)
    ON public.identity_roles FROM riverbank_auth_reader;
REVOKE SELECT (role_assignment_id, role, seller_id, granted_at, expires_at, revoked_at)
    ON public.seller_access_grants FROM riverbank_auth_reader;
REVOKE SELECT (seller_id, external_shop_ref)
    ON public.sellers FROM riverbank_auth_reader;
REVOKE USAGE ON TYPE public.application_role FROM riverbank_auth_reader;
REVOKE USAGE ON SCHEMA public FROM riverbank_auth_reader;

COMMIT;
