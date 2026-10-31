-- DRAFT ONLY: applied to local development DB on request; not an approved migration.
-- Requires 001_auth_baseline.sql. Business migration is blocked by CORE-01.24
-- and VER-01.01. JSON money must be integer VND; DBML decimal notes are obsolete.
-- Missing: terms lifecycle, JSON validation, consent transaction, idempotency
-- scope, handoff lease, immutable evidence, workflow authorization and audit
-- privileges. Do not use for real data, credit decisions, or as a runtime schema.
-- Columns and constraints can change as these contracts are resolved.

BEGIN;

CREATE TYPE "application_status" AS ENUM (
  'DRAFT',
  'BLOCKED_INPUT',
  'ANALYZING',
  'NO_LOAN_NEEDED',
  'AWAITING_STATEMENT',
  'VERIFYING',
  'PENDING_REVIEW',
  'ESCALATED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN'
);

CREATE TYPE "run_status" AS ENUM (
  'RUNNING',
  'COMPLETED',
  'FAILED'
);

CREATE TYPE "document_validation_status" AS ENUM (
  'PENDING',
  'PASSED',
  'FAILED'
);

CREATE TYPE "decision_type" AS ENUM (
  'ACCEPT_PROPOSAL',
  'ACCEPT_COUNTER',
  'REJECT'
);

CREATE TYPE "handoff_status" AS ENUM (
  'PENDING',
  'SENDING',
  'SUCCEEDED',
  'FAILED'
);

CREATE TABLE "seller_consents" (
  "consent_id" uuid PRIMARY KEY,
  "seller_id" uuid NOT NULL,
  "purpose_code" varchar(80) NOT NULL DEFAULT 'WORKING_CAPITAL_UNDERWRITING',
  "terms_version" varchar(50) NOT NULL,
  "granted_at" timestamptz NOT NULL,
  "expires_at" timestamptz,
  "revoked_at" timestamptz,
  CONSTRAINT "ck_consent_expiry" CHECK (expires_at IS NULL OR expires_at > granted_at),
  CONSTRAINT "ck_consent_revocation" CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE TABLE "applications" (
  "application_id" uuid PRIMARY KEY,
  "application_number" varchar(80) UNIQUE NOT NULL,
  "seller_id" uuid NOT NULL,
  "consent_id" uuid NOT NULL,
  "status" application_status NOT NULL DEFAULT 'DRAFT',
  "lot_value" bigint NOT NULL,
  "cash_on_hand" bigint NOT NULL,
  "sell_weeks" integer NOT NULL,
  "requested_amount" bigint NOT NULL,
  "supplier_schedule" jsonb NOT NULL,
  "sanitized_note" text,
  "currency" char(3) NOT NULL DEFAULT 'VND',
  "version_no" bigint NOT NULL DEFAULT 1,
  "submitted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  CONSTRAINT "ck_application_amounts" CHECK (lot_value > 0 AND cash_on_hand >= 0 AND requested_amount >= 0),
  CONSTRAINT "ck_application_versions_tenor" CHECK (sell_weeks > 0 AND version_no >= 1),
  CONSTRAINT "ck_application_currency" CHECK (currency = 'VND'),
  CONSTRAINT "ck_supplier_schedule_array" CHECK (jsonb_typeof(supplier_schedule) = 'array' AND jsonb_array_length(supplier_schedule) > 0)
);

CREATE TABLE "assessment_runs" (
  "run_id" uuid PRIMARY KEY,
  "application_id" uuid NOT NULL,
  "run_no" integer NOT NULL,
  "status" run_status NOT NULL DEFAULT 'RUNNING',
  "idempotency_key" varchar(128) UNIQUE NOT NULL,
  "input_snapshot" jsonb NOT NULL,
  "input_hash" varchar(64) NOT NULL,
  "engine_version" varchar(100) NOT NULL,
  "policy_version" varchar(100) NOT NULL,
  "policy_hash" varchar(64) NOT NULL,
  "model_version" varchar(100),
  "config_snapshot" jsonb NOT NULL,
  "cashflow_result" jsonb,
  "risk_result" jsonb,
  "policy_result" jsonb,
  "statement_check" jsonb,
  "result_schema_version" varchar(30) NOT NULL DEFAULT '1.0',
  "error_code" varchar(80),
  "started_at" timestamptz NOT NULL DEFAULT (now()),
  "completed_at" timestamptz,
  CONSTRAINT "ck_run_number" CHECK (run_no > 0),
  CONSTRAINT "ck_run_time" CHECK (completed_at IS NULL OR completed_at >= started_at),
  CONSTRAINT "ck_completed_run" CHECK (status <> 'COMPLETED' OR (completed_at IS NOT NULL AND cashflow_result IS NOT NULL))
);

CREATE TABLE "evidence" (
  "evidence_id" uuid PRIMARY KEY,
  "application_id" uuid NOT NULL,
  "run_id" uuid NOT NULL,
  "evidence_code" varchar(30) NOT NULL,
  "kind" varchar(50) NOT NULL,
  "schema_version" varchar(30) NOT NULL DEFAULT '1.0',
  "payload" jsonb NOT NULL,
  "payload_hash" varchar(64) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "application_documents" (
  "document_id" uuid PRIMARY KEY,
  "application_id" uuid NOT NULL,
  "document_type" varchar(50) NOT NULL DEFAULT 'BANK_STATEMENT',
  "file_name" varchar(255) NOT NULL,
  "object_key" varchar(500) NOT NULL,
  "object_version" varchar(255),
  "content_hash" varchar(64) NOT NULL,
  "media_type" varchar(100) NOT NULL,
  "received_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "generated_documents" (
  "document_id" uuid PRIMARY KEY,
  "application_id" uuid NOT NULL,
  "run_id" uuid NOT NULL,
  "attempt_no" integer NOT NULL,
  "underwriter_memo" text NOT NULL,
  "seller_explainer" text NOT NULL,
  "citation_map" jsonb NOT NULL,
  "validation_status" document_validation_status NOT NULL DEFAULT 'PENDING',
  "validation_errors" jsonb NOT NULL DEFAULT ('[]'::jsonb),
  "llm_model" varchar(100) NOT NULL,
  "prompt_version" varchar(100) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  CONSTRAINT "ck_memo_attempts" CHECK (attempt_no BETWEEN 1 AND 3)
);

CREATE TABLE "decisions" (
  "decision_id" uuid PRIMARY KEY,
  "application_id" uuid UNIQUE NOT NULL,
  "run_id" uuid NOT NULL,
  "generated_document_id" uuid NOT NULL,
  "decision" decision_type NOT NULL,
  "final_amount" bigint,
  "final_tenor_weeks" integer,
  "final_cashflow_result" jsonb,
  "verification_note" text,
  "reason" text NOT NULL,
  "actor_identity_id" uuid NOT NULL,
  "authorization_role_assignment_id" uuid NOT NULL,
  "actor_role" application_role NOT NULL DEFAULT 'underwriter',
  "decided_at" timestamptz NOT NULL DEFAULT (now()),
  CONSTRAINT "ck_decision_underwriter_role" CHECK (actor_role = 'underwriter'),
  CONSTRAINT "ck_decision_terms" CHECK ((decision = 'REJECT' AND final_amount IS NULL AND final_tenor_weeks IS NULL AND final_cashflow_result IS NULL) OR (decision IN ('ACCEPT_PROPOSAL', 'ACCEPT_COUNTER') AND final_amount IS NOT NULL AND final_amount > 0 AND final_tenor_weeks IS NOT NULL AND final_tenor_weeks > 0 AND final_cashflow_result IS NOT NULL))
);

CREATE TABLE "handoffs" (
  "handoff_id" uuid PRIMARY KEY,
  "application_id" uuid UNIQUE NOT NULL,
  "decision_id" uuid UNIQUE NOT NULL,
  "idempotency_key" varchar(128) UNIQUE NOT NULL,
  "status" handoff_status NOT NULL DEFAULT 'PENDING',
  "payload" jsonb NOT NULL,
  "payload_hash" varchar(64) NOT NULL,
  "los_ref" varchar(128),
  "attempt_count" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "last_attempt_at" timestamptz,
  "delivered_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  CONSTRAINT "ck_handoff_attempts" CHECK (attempt_count >= 0)
);

CREATE TABLE "application_events" (
  "event_id" BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  "application_id" uuid NOT NULL,
  "event_type" varchar(80) NOT NULL,
  "previous_status" application_status,
  "next_status" application_status,
  "actor_type" varchar(20) NOT NULL,
  "actor_identity_id" uuid,
  "system_actor_ref" varchar(128),
  "reason_code" varchar(80),
  "evidence_ids" jsonb NOT NULL DEFAULT ('[]'::jsonb),
  "details" jsonb NOT NULL DEFAULT ('{}'::jsonb),
  "occurred_at" timestamptz NOT NULL DEFAULT (now()),
  CONSTRAINT "ck_event_actor" CHECK ((actor_type = 'HUMAN' AND actor_identity_id IS NOT NULL AND system_actor_ref IS NULL) OR (actor_type = 'SYSTEM' AND actor_identity_id IS NULL AND system_actor_ref IS NOT NULL AND length(system_actor_ref) > 0)),
  CONSTRAINT "ck_state_event" CHECK (event_type <> 'STATE_CHANGED' OR next_status IS NOT NULL)
);

CREATE UNIQUE INDEX ON "seller_consents" ("consent_id", "seller_id");

CREATE INDEX ON "seller_consents" ("seller_id", "granted_at");

CREATE INDEX ON "applications" ("seller_id", "created_at");

CREATE INDEX ON "applications" ("status", "created_at");

CREATE UNIQUE INDEX ON "assessment_runs" ("application_id", "run_no");

CREATE UNIQUE INDEX ON "assessment_runs" ("run_id", "application_id");

CREATE UNIQUE INDEX ON "evidence" ("run_id", "evidence_code");

CREATE INDEX ON "application_documents" ("application_id", "received_at");

CREATE UNIQUE INDEX ON "generated_documents" ("run_id", "attempt_no");

CREATE UNIQUE INDEX ON "generated_documents" ("document_id", "run_id", "application_id");

CREATE UNIQUE INDEX ON "decisions" ("decision_id", "application_id");

CREATE INDEX ON "application_events" ("application_id", "occurred_at", "event_id");

ALTER TABLE "seller_consents" ADD FOREIGN KEY ("seller_id") REFERENCES "sellers" ("seller_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "applications" ADD FOREIGN KEY ("seller_id") REFERENCES "sellers" ("seller_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "assessment_runs" ADD FOREIGN KEY ("application_id") REFERENCES "applications" ("application_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "application_documents" ADD FOREIGN KEY ("application_id") REFERENCES "applications" ("application_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "decisions" ADD FOREIGN KEY ("application_id") REFERENCES "applications" ("application_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "decisions" ADD FOREIGN KEY ("actor_identity_id") REFERENCES "auth_identities" ("identity_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "application_events" ADD FOREIGN KEY ("application_id") REFERENCES "applications" ("application_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "application_events" ADD FOREIGN KEY ("actor_identity_id") REFERENCES "auth_identities" ("identity_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "applications" ADD FOREIGN KEY ("consent_id", "seller_id") REFERENCES "seller_consents" ("consent_id", "seller_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "evidence" ADD FOREIGN KEY ("run_id", "application_id") REFERENCES "assessment_runs" ("run_id", "application_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "generated_documents" ADD FOREIGN KEY ("run_id", "application_id") REFERENCES "assessment_runs" ("run_id", "application_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "decisions" ADD FOREIGN KEY ("generated_document_id", "run_id", "application_id") REFERENCES "generated_documents" ("document_id", "run_id", "application_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "handoffs" ADD FOREIGN KEY ("decision_id", "application_id") REFERENCES "decisions" ("decision_id", "application_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "decisions" ADD FOREIGN KEY ("authorization_role_assignment_id", "actor_identity_id", "actor_role") REFERENCES "identity_roles" ("role_assignment_id", "identity_id", "role") DEFERRABLE INITIALLY IMMEDIATE;

-- Reuse the append-only trigger function from the auth baseline.
CREATE TRIGGER application_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE
  ON application_events FOR EACH STATEMENT EXECUTE FUNCTION prevent_history_mutation();

COMMIT;
