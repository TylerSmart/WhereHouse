docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=YourStrong@Passw0rd" -p 1433:1433 -d --name wherehouse-db mcr.microsoft.com/mssql/server:2025-latest
