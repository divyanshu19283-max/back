-- ============================================================================
-- Intelligent Freight Forecasting Model — Supabase/PostgreSQL schema
-- SIH 2026 Problem Statement 26006
--
-- Run this once in the Supabase SQL editor (or `psql "$DATABASE_URL" -f schema.sql`)
-- against a fresh project. It creates all 5 tables, indexes, and enables
-- Row Level Security (RLS) with a read-only policy for the anon/public role
-- and full access for the service role used by the FastAPI backend.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. freight_rates — historical + synthetic training data
-- ----------------------------------------------------------------------------
create table if not exists freight_rates (
    id                      bigserial primary key,
    date                    date not null,
    origin                  text not null,
    destination             text not null,
    commodity               text not null,
    vessel_type             text not null,
    vessel_size             text not null,
    freight_rate            numeric(12, 2) not null check (freight_rate >= 0),
    fuel_price              numeric(12, 2) not null check (fuel_price >= 0),
    demand_index            numeric(8, 3) not null,
    supply_index            numeric(8, 3) not null,
    port_congestion_index   numeric(8, 3) not null,
    is_synthetic            boolean not null default true,
    created_at              timestamptz not null default now()
);

create index if not exists ix_freight_rates_date on freight_rates (date);
create index if not exists ix_freight_rates_route on freight_rates (origin, destination, vessel_type, date);
create unique index if not exists uq_freight_rates_dedup
    on freight_rates (date, origin, destination, commodity, vessel_type, vessel_size);

-- ----------------------------------------------------------------------------
-- 2. forecasts — model output per route / horizon
-- ----------------------------------------------------------------------------
create table if not exists forecasts (
    id                  bigserial primary key,
    forecast_date       date not null,
    origin              text not null,
    destination         text not null,
    vessel_type         text not null,
    horizon_days        integer not null default 7,
    predicted_rate      numeric(12, 2) not null,
    lower_bound         numeric(12, 2) not null,
    upper_bound         numeric(12, 2) not null,
    confidence_score    numeric(5, 4) not null check (confidence_score between 0 and 1),
    model_name          text not null,
    created_at          timestamptz not null default now()
);

create index if not exists ix_forecasts_route on forecasts (origin, destination, vessel_type, forecast_date);

-- ----------------------------------------------------------------------------
-- 3. charter_recommendations — decision engine output
-- ----------------------------------------------------------------------------
create table if not exists charter_recommendations (
    id                      bigserial primary key,
    origin                  text not null,
    destination             text not null,
    cargo_quantity          numeric(14, 2) not null,
    vessel_size             text not null,
    current_rate            numeric(12, 2) not null,
    predicted_rate          numeric(12, 2) not null,
    estimated_cost_now      numeric(16, 2) not null,
    estimated_cost_later    numeric(16, 2) not null,
    expected_saving         numeric(16, 2) not null,
    recommendation          text not null check (recommendation in ('CHARTER_NOW', 'WAIT_MONITOR', 'WAIT')),
    reason                  text,
    risk_level              text check (risk_level in ('LOW', 'MEDIUM', 'HIGH')),
    confidence              numeric(5, 4) not null,
    created_at              timestamptz not null default now()
);

create index if not exists ix_charter_reco_route on charter_recommendations (origin, destination, created_at desc);

-- ----------------------------------------------------------------------------
-- 4. model_runs — training/eval history for every model trained
-- ----------------------------------------------------------------------------
create table if not exists model_runs (
    id                  bigserial primary key,
    model_name          text not null,
    training_start      date not null,
    training_end        date not null,
    mae                 numeric(12, 4) not null,
    rmse                numeric(12, 4) not null,
    mape                numeric(8, 4) not null,
    r2                  numeric(8, 4),
    training_rows       integer not null,
    horizon_days        integer not null default 7,
    is_best_model       boolean not null default false,
    created_at          timestamptz not null default now()
);

create index if not exists ix_model_runs_created on model_runs (created_at desc);

-- ----------------------------------------------------------------------------
-- 5. scenarios — saved what-if simulator runs
-- ----------------------------------------------------------------------------
create table if not exists scenarios (
    id                  bigserial primary key,
    origin              text not null,
    destination         text not null,
    cargo_quantity      numeric(14, 2) not null,
    vessel_size         text not null,
    current_rate        numeric(12, 2) not null,
    fuel_price          numeric(12, 2) not null,
    predicted_rate      numeric(12, 2) not null,
    recommendation      text not null,
    estimated_savings   numeric(16, 2) not null,
    result_json         jsonb,
    created_at          timestamptz not null default now()
);

create index if not exists ix_scenarios_created on scenarios (created_at desc);

-- ============================================================================
-- Row Level Security
-- Data is not user-private (it's shared market/forecast data), but we still
-- enable RLS on every table per Supabase best practice: nothing is readable
-- or writable unless a policy explicitly allows it. The FastAPI backend
-- connects with the service_role key (bypasses RLS by design in Supabase);
-- anon/public clients (e.g. a future public dashboard) only get read access.
-- ============================================================================

alter table freight_rates            enable row level security;
alter table forecasts                enable row level security;
alter table charter_recommendations  enable row level security;
alter table model_runs               enable row level security;
alter table scenarios                enable row level security;

create policy "public read freight_rates" on freight_rates
    for select using (true);
create policy "public read forecasts" on forecasts
    for select using (true);
create policy "public read charter_recommendations" on charter_recommendations
    for select using (true);
create policy "public read model_runs" on model_runs
    for select using (true);
create policy "public read scenarios" on scenarios
    for select using (true);

-- No insert/update/delete policies are defined for anon/authenticated roles,
-- so all writes must go through the backend's service_role connection.
