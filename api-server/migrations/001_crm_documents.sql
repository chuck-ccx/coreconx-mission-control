create table if not exists crm_documents (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  doc_name text not null,
  status text not null default 'Not Sent',
  sent_date timestamptz,
  signed_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_crm_documents_company on crm_documents (company_name);
