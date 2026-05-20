-- Staff deductions (pending until applied at salary release)
CREATE TABLE IF NOT EXISTS staff_deductions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id varchar NOT NULL,
  amount decimal(10,2) NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  staff_salary_id varchar,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Staff advances (pending until deducted at salary release)
CREATE TABLE IF NOT EXISTS staff_advances (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id varchar NOT NULL,
  amount decimal(10,2) NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending',
  staff_salary_id varchar,
  created_at timestamp NOT NULL DEFAULT now()
);
