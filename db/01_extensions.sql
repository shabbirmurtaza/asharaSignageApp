-- ============================================================
-- 01_extensions.sql
-- Extensions, roles, and inline pgjwt implementation.
-- Run AFTER schema_v7.sql so the database exists, but BEFORE
-- 02_auth_functions.sql.
--
-- pgjwt is embedded inline (rather than CREATE EXTENSION pgjwt)
-- because the official postgres:16-alpine image does not ship
-- the pgjwt extension files. The functions below are equivalent
-- to pgjwt 0.2.0 (https://github.com/michelp/pgjwt) and live in
-- the public schema as plain SQL/PLPGSQL.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- Roles for PostgREST
-- ============================================================
-- web_anon: the anonymous role PostgREST uses when no JWT is sent.
-- authenticator: the role PostgREST connects as; switches into
--                web_anon or authenticated based on the JWT.
-- authenticated: the role any logged-in user is mapped to via JWT
--                claim {"role":"authenticated"}.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'web_anon') then
    create role web_anon nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    -- password is set from the AUTHENTICATOR_PASSWORD env var via psql -v
    -- (see README). Default to 'auth_dev' if -v not provided.
    execute format(
      'create role authenticator login password %L',
      coalesce(current_setting('signage.authenticator_password', true), 'auth_dev')
    );
  end if;
end$$;

grant web_anon       to authenticator;
grant authenticated  to authenticator;

grant usage on schema public to web_anon, authenticated;

-- ============================================================
-- pgjwt (embedded). Source: github.com/michelp/pgjwt v0.2.0,
-- adapted to live in `public` without the extension wrapper.
-- ============================================================

create or replace function url_encode(data bytea) returns text language sql as $$
    select translate(encode(data, 'base64'), E'+/=\n', '-_');
$$;

create or replace function url_decode(data text) returns bytea language sql as $$
with t as (select translate(data, '-_', '+/') as trans),
     rem as (select length(t.trans) % 4 as remainder from t)
select decode(
    t.trans ||
    case when rem.remainder > 0
         then repeat('=', (4 - rem.remainder))
         else '' end,
    'base64') from t, rem;
$$;

create or replace function algorithm_sign(signables text, secret text, algorithm text)
returns text language sql as $$
with
  alg as (
    select case
      when algorithm = 'HS256' then 'sha256'
      when algorithm = 'HS384' then 'sha384'
      when algorithm = 'HS512' then 'sha512'
      else '' end as id)
select url_encode(hmac(signables, secret, alg.id)) from alg;
$$;

create or replace function sign(payload json, secret text, algorithm text default 'HS256')
returns text language sql as $$
with
  header as (
    select url_encode(convert_to('{"alg":"' || algorithm || '","typ":"JWT"}', 'utf8')) as data),
  payload as (
    select url_encode(convert_to(payload::text, 'utf8')) as data),
  signables as (
    select header.data || '.' || payload.data as data from header, payload)
select
    signables.data || '.' ||
    algorithm_sign(signables.data, secret, algorithm) from signables;
$$;

create or replace function verify(token text, secret text, algorithm text default 'HS256')
returns table(header json, payload json, valid boolean) language sql as $$
  select
    convert_from(url_decode(r[1]), 'utf8')::json as header,
    convert_from(url_decode(r[2]), 'utf8')::json as payload,
    r[3] = algorithm_sign(r[1] || '.' || r[2], secret, algorithm) as valid
  from regexp_split_to_array(token, '\.') r;
$$;
