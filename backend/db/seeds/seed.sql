-- Seed users + equipment. Idempotent (ON CONFLICT DO NOTHING).
-- X-User-Id header values are the ids below — no login needed (brief §2).

INSERT INTO users (id, name, role) VALUES
  ('stu-aria',  'Aria Sharma',   'student'),
  ('stu-rohan', 'Rohan Verma',   'student'),
  ('stu-meera', 'Meera Iyer',    'student'),
  ('asst-rahul','Rahul Gupta',   'assistant'),
  ('asst-priya','Priya Nair',    'assistant')
ON CONFLICT (id) DO NOTHING;

INSERT INTO equipment (name, total_units) VALUES
  ('Oscilloscope', 3),
  ('Multimeter', 5),
  ('Arduino Uno Dev Board', 4),
  ('Raspberry Pi 4 Kit', 2),
  ('Function Generator', 2),
  ('Soldering Station', 3)
ON CONFLICT (lower(name)) DO NOTHING;
