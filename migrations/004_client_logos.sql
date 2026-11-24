CREATE TABLE IF NOT EXISTS client_logos (
  client_id integer PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  mime text NOT NULL,
  data text NOT NULL
);
