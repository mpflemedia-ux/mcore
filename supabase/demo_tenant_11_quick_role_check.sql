reset role;
select current_user, has_schema_privilege(current_user, 'public', 'CREATE') as can_create;
