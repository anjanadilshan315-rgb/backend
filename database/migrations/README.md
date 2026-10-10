# Migrations

`../schema.sql` always builds the complete, current database from scratch.

When you change a table, update `schema.sql` **and** add a dated file here with the
`ALTER` statements for databases that already exist, e.g.

    2026-11-01-add-template-price-currency.sql

Apply them in date order on existing databases.
