-- Add pipeline stage and deal value columns to companies table
alter table companies add column if not exists pipeline_stage text default 'Lead';
alter table companies add column if not exists deal_value numeric default null;

-- Create index for pipeline stage queries
create index if not exists idx_companies_pipeline_stage on companies (pipeline_stage);
