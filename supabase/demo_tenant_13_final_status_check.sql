reset role;

select
  (select count(*)::text from sales_plans where tenant_id = (select id from tenants where code='DEMO')) as sales_plans,
  (select count(*)::text from sales_plan_periods where tenant_id = (select id from tenants where code='DEMO')) as sales_plan_periods,
  (select count(*)::text from sales_plan_weeks where tenant_id = (select id from tenants where code='DEMO')) as sales_plan_weeks,
  (select count(*)::text from sales_plan_milestones where tenant_id = (select id from tenants where code='DEMO')) as sales_plan_milestones,
  (select count(*)::text from platform_activities where tenant_id = (select id from tenants where code='DEMO')) as planner_activities,
  (select count(*)::text from projects where tenant_id = (select id from tenants where code='DEMO')) as projects,
  (select count(*)::text from products where tenant_id = (select id from tenants where code='DEMO')) as products,
  (select count(*)::text from suppliers where tenant_id = (select id from tenants where code='DEMO')) as suppliers,
  (select count(*)::text from bank_accounts where tenant_id = (select id from tenants where code='DEMO')) as bank_accounts;
