# Stage 1: Build Client
FROM node:22-alpine AS client-build
WORKDIR /src/WhereHouse.Client
COPY WhereHouse.Client/package*.json ./
RUN npm ci --ignore-scripts
COPY WhereHouse.Client/ .
RUN npm run build:production

# Stage 2: Build API
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src
COPY WhereHouse.API/WhereHouse.API.csproj WhereHouse.API/
COPY WhereHouse.Core/WhereHouse.Core.csproj WhereHouse.Core/
COPY WhereHouse.Data/WhereHouse.Data.csproj WhereHouse.Data/
COPY WhereHouse.Infrastructure/WhereHouse.Infrastructure.csproj WhereHouse.Infrastructure/

RUN dotnet restore WhereHouse.API/WhereHouse.API.csproj

COPY . .
WORKDIR /src/WhereHouse.API
RUN dotnet publish -c Release -o /app/publish

# Stage 3: Final Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=api-build /app/publish .
# Copy client build to wwwroot
COPY --from=client-build /src/WhereHouse.Client/dist/WhereHouse.Client/browser ./wwwroot

EXPOSE 8080
ENTRYPOINT ["dotnet", "WhereHouse.API.dll"]
