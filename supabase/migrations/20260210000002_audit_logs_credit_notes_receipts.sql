
-- Audit functions for Credit Notes and Receipts

-- Credit Notes
create or replace function public.audit_credit_notes() returns trigger as $$
begin
  insert into public.audit_logs(company_id, user_id, action, entity, entity_id, description)
  values (
    case when tg_op = 'DELETE' then old.company_id else new.company_id end,
    public._audit_actor(),
    tg_op,
    'credit_notes',
    case when tg_op = 'DELETE' then old.id else new.id end,
    coalesce(
      case
        when tg_op = 'UPDATE' and (old.status is distinct from new.status) then
          (coalesce(old.credit_note_number, '') || ' status ' || coalesce(old.status, '') || ' → ' || coalesce(new.status, ''))
        else coalesce(case when tg_op = 'DELETE' then old.credit_note_number else new.credit_note_number end, '')
      end,
      ''
    )
  );
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$ language plpgsql security definer;

-- Receipts
create or replace function public.audit_receipts() returns trigger as $$
begin
  insert into public.audit_logs(company_id, user_id, action, entity, entity_id, description)
  values (
    case when tg_op = 'DELETE' then old.company_id else new.company_id end,
    public._audit_actor(),
    tg_op,
    'receipts',
    case when tg_op = 'DELETE' then old.id else new.id end,
    coalesce(
      case
        when tg_op = 'UPDATE' and (old.status is distinct from new.status) then
          (coalesce(old.receipt_number, '') || ' status ' || coalesce(old.status, '') || ' → ' || coalesce(new.status, ''))
        else coalesce(case when tg_op = 'DELETE' then old.receipt_number else new.receipt_number end, '')
      end,
      ''
    )
  );
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$ language plpgsql security definer;

-- Triggers
drop trigger if exists trg_audit_credit_notes on public.credit_notes;
create trigger trg_audit_credit_notes after insert or update or delete on public.credit_notes for each row execute function public.audit_credit_notes();

drop trigger if exists trg_audit_receipts on public.receipts;
create trigger trg_audit_receipts after insert or update or delete on public.receipts for each row execute function public.audit_receipts();
