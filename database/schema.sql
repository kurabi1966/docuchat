-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
    id uuid NOT NULL DEFAULT auth.uid (),
    created_at timestamp
    with
        time zone NOT NULL DEFAULT now(),
        name text,
        phone text,
        CONSTRAINT profiles_pkey PRIMARY KEY (id),
        CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id)
);