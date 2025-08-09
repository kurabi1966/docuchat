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

-- Documents table for storing uploaded document metadata
CREATE TABLE public.documents (
    id uuid NOT NULL DEFAULT gen_random_uuid (),
    user_id uuid NOT NULL,
    name text NOT NULL,
    size bigint NOT NULL,
    type text NOT NULL,
    url text NOT NULL,
    path text NOT NULL,
    status text NOT NULL DEFAULT 'processing',
    vectorized boolean DEFAULT false,
    created_at timestamp
    with
        time zone NOT NULL DEFAULT now(),
        updated_at timestamp
    with
        time zone NOT NULL DEFAULT now(),
        CONSTRAINT documents_pkey PRIMARY KEY (id),
        CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX documents_user_id_idx ON public.documents (user_id);

CREATE INDEX documents_status_idx ON public.documents (status);

CREATE INDEX documents_created_at_idx ON public.documents (created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own documents" ON public.documents FOR
SELECT USING (auth.uid () = user_id);

CREATE POLICY "Users can insert their own documents" ON public.documents FOR
INSERT
WITH
    CHECK (auth.uid () = user_id);

CREATE POLICY "Users can update their own documents" ON public.documents FOR
UPDATE USING (auth.uid () = user_id);

CREATE POLICY "Users can delete their own documents" ON public.documents FOR DELETE USING (auth.uid () = user_id);

-- Schema 08/08/2025
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  size bigint NOT NULL,
  type text NOT NULL,
  url text NOT NULL,
  path text NOT NULL,
  status text NOT NULL DEFAULT 'processing'::text,
  vectorized boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.profiles (
    id uuid NOT NULL DEFAULT auth.uid (),
    created_at timestamp
    with
        time zone NOT NULL DEFAULT now(),
        name text,
        phone text,
        CONSTRAINT profiles_pkey PRIMARY KEY (id),
        CONSTRAINT profiles_id_fkey1 FOREIGN KEY (id) REFERENCES auth.users (id),
        CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id)
);

CREATE TABLE public.rag_documents (
  id bigint NOT NULL DEFAULT nextval('rag_documents_id_seq'::regclass),
  content text,
  metadata jsonb,
  embedding USER-DEFINED,
  CONSTRAINT rag_documents_pkey PRIMARY KEY (id)
);