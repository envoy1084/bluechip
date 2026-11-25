-- Runs once, when the Postgres volume is created: tests get their own database, so they never touch dev data.
CREATE DATABASE bluechip_test OWNER bluechip;
