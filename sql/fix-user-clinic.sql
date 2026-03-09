-- Diagnóstico: clínicas e quantidade de usuários vinculados em app_users
-- Use para identificar clínicas sem owner vinculado
SELECT
  c.id,
  c.name,
  c.email,
  (SELECT COUNT(*) FROM app_users au WHERE au.clinic_id = c.id) AS user_count
FROM clinics c
ORDER BY c.created_at DESC;
