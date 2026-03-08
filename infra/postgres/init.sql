-- Initialize additional databases for Langfuse and Temporal
-- This script runs on first PostgreSQL startup

CREATE DATABASE langfuse
    WITH OWNER = agent
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.utf8'
    LC_CTYPE = 'en_US.utf8'
    TEMPLATE = template0;

GRANT ALL PRIVILEGES ON DATABASE langfuse TO agent;
