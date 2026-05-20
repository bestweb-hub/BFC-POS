-- Previous due salary (amounts owed to employee, e.g. from last month or manual entries)
CREATE TABLE IF NOT EXISTS staff_previous_due (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id varchar NOT NULL,
  amount decimal(10,2) NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending',
  staff_salary_id varchar,
  created_at timestamp NOT NULL DEFAULT now()
);
