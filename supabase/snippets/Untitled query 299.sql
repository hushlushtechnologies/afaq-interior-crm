$checks = @(
    "database-authorization",
    "employee-status",
    "last-super-admin"
)

foreach ($name in $checks) {
    $file = ".\tests\sql\$name.sql"

    if (-not (Test-Path $file)) {
        throw "Missing test file: $file"
    }

    Get-Content -Raw $file |
        docker exec -i supabase_db_afaq-interiors-crm-s09-local `
            psql -U postgres -d postgres -X -v ON_ERROR_STOP=1

    if ($LASTEXITCODE -ne 0) {
        throw "SQL verification failed: $name"
    }
}