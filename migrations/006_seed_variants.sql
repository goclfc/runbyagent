-- Seed the ten variants

INSERT INTO variants (slug, name, description, file) VALUES
  ('01', 'ledger', 'numbers are public', '01.html'),
  ('02', 'control room', 'an agent is operating right now', '02.html'),
  ('03', 'lab notebook', 'it''s an experiment', '03.html'),
  ('04', 'bento', 'the whole thing at a glance', '04.html'),
  ('05', 'manifesto', 'the rules', '05.html'),
  ('06', 'receipt', 'the changelog and the zeros', '06.html'),
  ('07', 'transcript', 'the agent does the work', '07.html'),
  ('08', 'gazette', 'the day by day public story', '08.html'),
  ('09', 'comic', 'the loop, for non-developers', '09.html'),
  ('10', 'poster', 'confidence and minimalism', '10.html')
ON CONFLICT (slug) DO NOTHING;
