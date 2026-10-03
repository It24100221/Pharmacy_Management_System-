# SQL Server migrations

Run ordered migrations from `backend` with:

```powershell
npm.cmd run migrate
```

The runner creates `dbo.schema_migrations`, applies numeric `.sql` files in order inside one transaction per migration, and records a migration only after every batch commits. Re-running is safe: recorded migrations are skipped, and each new DDL script also checks object existence.

`001_baseline_existing_database` is an explicit baseline marker for the live A1/A2 foundation. It validates the known core tables but does not claim that the historical monolithic schema ran. `002_prescription_file_storage` is the first forward migration managed by this mechanism.

Do not run `database/schema.sql` over an existing database. It remains a historical/bootstrap reference and contains deferred commerce objects that are not approved for deployment.
