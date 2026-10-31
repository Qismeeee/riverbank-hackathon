-- Development baseline only. Business schema remains gated by CORE-01.24.
BEGIN;
CREATE TYPE application_role AS ENUM ('seller', 'underwriter');
CREATE TABLE sellers (
    seller_id uuid PRIMARY KEY,
    external_shop_ref varchar(128) NOT NULL UNIQUE,
    display_name varchar(255) NOT NULL,
    bank_customer_ref varchar(128),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_identities (
    identity_id uuid PRIMARY KEY,
    issuer text COLLATE "C" NOT NULL,
    subject varchar(255) COLLATE "C" NOT NULL,
    is_enabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (issuer, subject),
    CHECK (length(issuer) > 0 AND length(subject) > 0),
    CHECK (updated_at >= created_at)
);
CREATE TABLE identity_roles (
    role_assignment_id uuid PRIMARY KEY,
    identity_id uuid NOT NULL REFERENCES auth_identities(identity_id),
    role application_role NOT NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    revoked_at timestamptz,
    UNIQUE (role_assignment_id, role),
    UNIQUE (role_assignment_id, identity_id, role),
    CHECK (expires_at IS NULL OR expires_at > granted_at),
    CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE UNIQUE INDEX identity_roles_unrevoked ON identity_roles (identity_id, role)
    WHERE revoked_at IS NULL;
CREATE TABLE seller_access_grants (
    access_grant_id uuid PRIMARY KEY,
    role_assignment_id uuid NOT NULL,
    role application_role NOT NULL DEFAULT 'seller' CHECK (role = 'seller'),
    seller_id uuid NOT NULL REFERENCES sellers(seller_id),
    granted_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    revoked_at timestamptz,
    FOREIGN KEY (role_assignment_id, role) REFERENCES identity_roles(role_assignment_id, role),
    CHECK (expires_at IS NULL OR expires_at > granted_at),
    CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE UNIQUE INDEX seller_grants_unrevoked ON seller_access_grants (role_assignment_id, seller_id)
    WHERE revoked_at IS NULL;
CREATE INDEX seller_grants_by_seller ON seller_access_grants (seller_id, role_assignment_id);
CREATE TABLE authorization_events (
    authorization_event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    target_identity_id uuid NOT NULL REFERENCES auth_identities(identity_id),
    role_assignment_id uuid REFERENCES identity_roles(role_assignment_id),
    access_grant_id uuid REFERENCES seller_access_grants(access_grant_id),
    event_type varchar(40) NOT NULL,
    actor_type varchar(20) NOT NULL,
    actor_identity_id uuid REFERENCES auth_identities(identity_id),
    system_actor_ref varchar(128),
    reason_code varchar(80) NOT NULL,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((actor_type = 'HUMAN' AND actor_identity_id IS NOT NULL AND system_actor_ref IS NULL)
        OR (actor_type = 'SYSTEM' AND actor_identity_id IS NULL AND system_actor_ref IS NOT NULL AND length(system_actor_ref) > 0))
);
CREATE INDEX authorization_events_target ON authorization_events
    (target_identity_id, occurred_at, authorization_event_id);
CREATE FUNCTION prevent_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'history is append-only';
END $$;
CREATE TRIGGER authorization_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE
    ON authorization_events FOR EACH STATEMENT EXECUTE FUNCTION prevent_history_mutation();
CREATE FUNCTION protect_identity_keys() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'identity history cannot be deleted'; END IF;
    IF (NEW.identity_id, NEW.issuer, NEW.subject, NEW.created_at) IS DISTINCT FROM
       (OLD.identity_id, OLD.issuer, OLD.subject, OLD.created_at) THEN
        RAISE EXCEPTION 'identity keys are immutable';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER identities_immutable BEFORE UPDATE OR DELETE ON auth_identities
    FOR EACH ROW EXECUTE FUNCTION protect_identity_keys();
CREATE FUNCTION protect_seller_keys() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'seller history cannot be deleted'; END IF;
    IF (NEW.seller_id, NEW.external_shop_ref, NEW.created_at) IS DISTINCT FROM
       (OLD.seller_id, OLD.external_shop_ref, OLD.created_at) THEN
        RAISE EXCEPTION 'seller keys are immutable';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER sellers_immutable BEFORE UPDATE OR DELETE ON sellers
    FOR EACH ROW EXECUTE FUNCTION protect_seller_keys();
CREATE FUNCTION protect_grant_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'grant history cannot be deleted'; END IF;
    IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR
       (to_jsonb(NEW) - 'revoked_at') IS DISTINCT FROM (to_jsonb(OLD) - 'revoked_at') THEN
        RAISE EXCEPTION 'only one-way revocation is permitted';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER roles_immutable BEFORE UPDATE OR DELETE ON identity_roles
    FOR EACH ROW EXECUTE FUNCTION protect_grant_history();
CREATE TRIGGER grants_immutable BEFORE UPDATE OR DELETE ON seller_access_grants
    FOR EACH ROW EXECUTE FUNCTION protect_grant_history();
COMMIT;
