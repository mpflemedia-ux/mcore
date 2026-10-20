reset role;

update tenants set onboarding_completed = true where code = 'DEMO';

select code, onboarding_done, onboarding_completed from tenants where code = 'DEMO';
