#!/usr/bin/env python3
"""
seed_tools.py — Seeds the tool registry with all 15 pre-built adapters (E5.3 spec).

Run:  python -m app.scripts.seed_tools
  or: python apps/agent-builder-backend/app/scripts/seed_tools.py
"""
from __future__ import annotations

import asyncio
import uuid
import logging
import os
import sys

log = logging.getLogger(__name__)

# ── Tool manifests ─────────────────────────────────────────────────────────────

TOOLS: list[dict] = [
    {
        "tool_id": "slack",
        "name": "Slack",
        "version": "1.0.0",
        "description": "Send messages and notifications to Slack channels and users.",
        "llm_description": "Sends messages to Slack. Use when the workflow needs to notify humans via Slack.",
        "llm_when_to_use": "Use after completing AI analysis when human notification is required, or to send workflow results.",
        "tags": ["communication", "notification"],
        "capabilities": [
            {
                "name": "send_message",
                "description": "Send a message to a Slack channel or DM",
                "when_to_use": "Send notifications, results, or alerts to Slack",
                "method": "POST",
                "path": "/slack/send",
                "input_schema": {"channel": "string", "message": "string", "blocks": "array?"},
                "output_schema": {"ts": "string", "ok": "boolean"},
                "estimated_latency_ms": 300,
            },
            {
                "name": "get_channel_history",
                "description": "Retrieve recent messages from a Slack channel",
                "when_to_use": "When you need context from recent Slack discussions",
                "method": "GET",
                "path": "/slack/history",
                "input_schema": {"channel": "string", "limit": "integer?"},
                "output_schema": {"messages": "array"},
                "estimated_latency_ms": 400,
            },
        ],
    },
    {
        "tool_id": "pagerduty",
        "name": "PagerDuty",
        "version": "1.0.0",
        "description": "Create and manage PagerDuty incidents and alerts.",
        "llm_description": "Creates PagerDuty incidents for on-call alerts. Use for critical system events.",
        "llm_when_to_use": "Use when a workflow detects a critical error or anomaly requiring immediate human intervention.",
        "tags": ["incident", "alerting", "ops"],
        "capabilities": [
            {
                "name": "create_incident",
                "description": "Create a PagerDuty incident",
                "when_to_use": "Critical system events requiring immediate on-call response",
                "method": "POST",
                "path": "/pagerduty/incidents",
                "input_schema": {"title": "string", "severity": "string", "body": "string", "service_id": "string"},
                "output_schema": {"id": "string", "status": "string", "html_url": "string"},
                "estimated_latency_ms": 500,
            },
        ],
    },
    {
        "tool_id": "email",
        "name": "Email (SMTP/SendGrid)",
        "version": "1.0.0",
        "description": "Send transactional emails via SMTP or SendGrid.",
        "llm_description": "Sends emails. Use when the workflow needs to communicate with users or external parties via email.",
        "llm_when_to_use": "Use to deliver workflow results, reports, or notifications to email recipients.",
        "tags": ["communication", "notification"],
        "capabilities": [
            {
                "name": "send_email",
                "description": "Send an email message",
                "when_to_use": "Send formatted results or notifications via email",
                "method": "POST",
                "path": "/email/send",
                "input_schema": {"to": "string", "subject": "string", "body_html": "string", "from": "string?"},
                "output_schema": {"message_id": "string", "accepted": "boolean"},
                "estimated_latency_ms": 800,
            },
        ],
    },
    {
        "tool_id": "ms-teams",
        "name": "Microsoft Teams",
        "version": "1.0.0",
        "description": "Send messages to Microsoft Teams channels via webhooks.",
        "llm_description": "Sends messages to Microsoft Teams. Use for office365 corporate notification workflows.",
        "llm_when_to_use": "Use when the organization uses Teams for communication and human notification is needed.",
        "tags": ["communication", "notification", "microsoft"],
        "capabilities": [
            {
                "name": "send_message",
                "description": "Post an adaptive card or message to a Teams channel",
                "when_to_use": "Teams notification for workflow events",
                "method": "POST",
                "path": "/msteams/send",
                "input_schema": {"webhook_url": "string", "title": "string", "text": "string"},
                "output_schema": {"ok": "boolean"},
                "estimated_latency_ms": 300,
            },
        ],
    },
    {
        "tool_id": "github",
        "name": "GitHub",
        "version": "1.0.0",
        "description": "Interact with GitHub: create issues, PRs, read repository content.",
        "llm_description": "GitHub integration for code workflows. Use for issue triage, PR review automation.",
        "llm_when_to_use": "Use when the workflow involves software development tasks: bug triage, PR creation, code review.",
        "tags": ["development", "code", "devops"],
        "capabilities": [
            {
                "name": "create_issue",
                "description": "Create a GitHub issue",
                "when_to_use": "Log bugs or tasks found during AI analysis",
                "method": "POST",
                "path": "/github/issues",
                "input_schema": {"repo": "string", "title": "string", "body": "string", "labels": "array?"},
                "output_schema": {"number": "integer", "html_url": "string"},
                "estimated_latency_ms": 400,
            },
            {
                "name": "get_file_content",
                "description": "Read a file from a GitHub repository",
                "when_to_use": "Code review and analysis workflows",
                "method": "GET",
                "path": "/github/content",
                "input_schema": {"repo": "string", "path": "string", "ref": "string?"},
                "output_schema": {"content": "string", "sha": "string"},
                "estimated_latency_ms": 300,
            },
        ],
    },
    {
        "tool_id": "jira",
        "name": "Jira",
        "version": "1.0.0",
        "description": "Create and update Jira issues and projects.",
        "llm_description": "Jira project management integration. Use for ticket creation and status updates.",
        "llm_when_to_use": "Use in workflows that need to create tickets, update sprint status, or search for issues.",
        "tags": ["project-management", "devops"],
        "capabilities": [
            {
                "name": "create_issue",
                "description": "Create a Jira issue",
                "when_to_use": "Create project tasks, bugs, or stories",
                "method": "POST",
                "path": "/jira/issues",
                "input_schema": {"project_key": "string", "summary": "string", "issue_type": "string", "description": "string?"},
                "output_schema": {"key": "string", "id": "string", "url": "string"},
                "estimated_latency_ms": 500,
            },
        ],
    },
    {
        "tool_id": "linear",
        "name": "Linear",
        "version": "1.0.0",
        "description": "Create and manage Linear issues.",
        "llm_description": "Linear issue tracking. Use for modern engineering teams using Linear.",
        "llm_when_to_use": "Use when the team uses Linear for issue tracking and you need to create or update issues.",
        "tags": ["project-management", "development"],
        "capabilities": [
            {
                "name": "create_issue",
                "description": "Create a Linear issue",
                "when_to_use": "Create bugs or feature requests in Linear",
                "method": "POST",
                "path": "/linear/issues",
                "input_schema": {"team_id": "string", "title": "string", "description": "string?", "priority": "integer?"},
                "output_schema": {"id": "string", "identifier": "string", "url": "string"},
                "estimated_latency_ms": 400,
            },
        ],
    },
    {
        "tool_id": "salesforce",
        "name": "Salesforce",
        "version": "1.0.0",
        "description": "Query and update Salesforce CRM objects.",
        "llm_description": "Salesforce CRM integration. Use for lead/opportunity enrichment and CRM writes.",
        "llm_when_to_use": "Use in sales automation workflows to lookup contacts, update opportunities, or log activities.",
        "tags": ["crm", "sales"],
        "capabilities": [
            {
                "name": "soql_query",
                "description": "Execute a SOQL query against Salesforce",
                "when_to_use": "Look up CRM data for enrichment",
                "method": "POST",
                "path": "/salesforce/query",
                "input_schema": {"soql": "string"},
                "output_schema": {"records": "array", "totalSize": "integer"},
                "estimated_latency_ms": 600,
            },
        ],
    },
    {
        "tool_id": "hubspot",
        "name": "HubSpot",
        "version": "1.0.0",
        "description": "Interact with HubSpot CRM contacts, deals, and companies.",
        "llm_description": "HubSpot CRM integration for marketing and sales automation workflows.",
        "llm_when_to_use": "Use for inbound sales workflows: enriching contacts, creating deals, sending sequences.",
        "tags": ["crm", "marketing", "sales"],
        "capabilities": [
            {
                "name": "get_contact",
                "description": "Retrieve a HubSpot contact by email",
                "when_to_use": "Enrich lead data with CRM information",
                "method": "GET",
                "path": "/hubspot/contacts",
                "input_schema": {"email": "string"},
                "output_schema": {"id": "string", "properties": "object"},
                "estimated_latency_ms": 350,
            },
        ],
    },
    {
        "tool_id": "postgres-query",
        "name": "PostgreSQL Query",
        "version": "1.0.0",
        "description": "Run parameterized read-only SQL queries against a configured PostgreSQL database.",
        "llm_description": "PostgreSQL read-only query tool. Use to look up data from internal databases.",
        "llm_when_to_use": "Use when the workflow needs structured data from a relational database. Always use parameterized queries.",
        "tags": ["database", "data"],
        "capabilities": [
            {
                "name": "run_query",
                "description": "Run a read-only SQL SELECT query",
                "when_to_use": "Fetch structured data from PostgreSQL",
                "method": "POST",
                "path": "/postgres/query",
                "input_schema": {"sql": "string", "params": "array?", "connection_name": "string?"},
                "output_schema": {"rows": "array", "row_count": "integer"},
                "estimated_latency_ms": 200,
            },
        ],
    },
    {
        "tool_id": "http-request",
        "name": "HTTP Request",
        "version": "1.0.0",
        "description": "Make arbitrary HTTP requests to any API endpoint.",
        "llm_description": "Generic HTTP client. Use when no specific tool is available for a target API.",
        "llm_when_to_use": "Fallback for any REST API call when a dedicated adapter doesn't exist.",
        "tags": ["http", "api", "generic"],
        "capabilities": [
            {
                "name": "request",
                "description": "Make an HTTP request",
                "when_to_use": "Call any REST API endpoint",
                "method": "POST",
                "path": "/http/request",
                "input_schema": {"url": "string", "method": "string", "headers": "object?", "body": "any?"},
                "output_schema": {"status_code": "integer", "body": "any", "headers": "object"},
                "estimated_latency_ms": 500,
            },
        ],
    },
    {
        "tool_id": "webhook-send",
        "name": "Webhook Send",
        "version": "1.0.0",
        "description": "Send a JSON payload to a configured webhook URL.",
        "llm_description": "Webhook sender. Use to trigger external systems that accept webhook events.",
        "llm_when_to_use": "Use to notify external systems (Zapier, Make, n8n) of workflow completion or events.",
        "tags": ["webhook", "integration"],
        "capabilities": [
            {
                "name": "send",
                "description": "POST a JSON payload to a webhook URL",
                "when_to_use": "Trigger external automations",
                "method": "POST",
                "path": "/webhook/send",
                "input_schema": {"url": "string", "payload": "object", "secret": "string?"},
                "output_schema": {"status_code": "integer", "ok": "boolean"},
                "estimated_latency_ms": 400,
            },
        ],
    },
    {
        "tool_id": "openai-embeddings",
        "name": "OpenAI Embeddings",
        "version": "1.0.0",
        "description": "Generate text embeddings using OpenAI's embedding models.",
        "llm_description": "Text embedding generator. Use for semantic search, similarity, and RAG workflows.",
        "llm_when_to_use": "Use when you need to embed text for semantic retrieval or similarity computations.",
        "tags": ["ai", "embeddings", "vector"],
        "capabilities": [
            {
                "name": "embed",
                "description": "Generate embeddings for one or more text chunks",
                "when_to_use": "Convert text to vector representations for RAG or similarity search",
                "method": "POST",
                "path": "/openai/embeddings",
                "input_schema": {"input": "string|array", "model": "string?"},
                "output_schema": {"embeddings": "array", "usage": "object"},
                "estimated_latency_ms": 300,
            },
        ],
    },
    {
        "tool_id": "openai-vision",
        "name": "OpenAI Vision",
        "version": "1.0.0",
        "description": "Analyze images using GPT-4 Vision (gpt-4o).",
        "llm_description": "Image understanding tool. Use when the workflow receives image URLs or base64 images.",
        "llm_when_to_use": "Use to extract text, describe scenes, classify images, or answer questions about visual content.",
        "tags": ["ai", "vision", "image"],
        "capabilities": [
            {
                "name": "analyze_image",
                "description": "Analyze an image with GPT-4 Vision",
                "when_to_use": "Extract information or describe images in a workflow",
                "method": "POST",
                "path": "/openai/vision",
                "input_schema": {"image_url": "string", "prompt": "string", "model": "string?"},
                "output_schema": {"description": "string", "raw_response": "string"},
                "estimated_latency_ms": 800,
            },
        ],
    },
    {
        "tool_id": "whisper",
        "name": "Whisper (Speech-to-Text)",
        "version": "1.0.0",
        "description": "Transcribe audio to text using OpenAI Whisper.",
        "llm_description": "Audio transcription tool. Converts voice recordings to text using Whisper.",
        "llm_when_to_use": "Use when the workflow processes audio files or voice memos that need to be transcribed.",
        "tags": ["ai", "audio", "transcription"],
        "capabilities": [
            {
                "name": "transcribe",
                "description": "Transcribe audio file to text",
                "when_to_use": "Convert audio recordings to text for downstream processing",
                "method": "POST",
                "path": "/whisper/transcribe",
                "input_schema": {"audio_url": "string", "language": "string?", "model": "string?"},
                "output_schema": {"text": "string", "language": "string", "duration_seconds": "number"},
                "estimated_latency_ms": 2000,
            },
        ],
    },
]


async def seed():
    """Insert tools into the database, skipping existing ones."""
    from app.db.session import async_session_factory
    from sqlalchemy import text
    import json

    log.basicConfig(level=log.INFO, format="%(levelname)s %(message)s")

    async with async_session_factory() as db:
        inserted = 0
        skipped = 0
        for tool in TOOLS:
            # Check if exists
            existing = await db.execute(
                text("SELECT id FROM tools WHERE tool_id = :tool_id"),
                {"tool_id": tool["tool_id"]},
            )
            if existing.scalar():
                skipped += 1
                continue

            await db.execute(
                text("""
                    INSERT INTO tools (id, tool_id, name, version, description, llm_description,
                                       llm_when_to_use, tags, capabilities, health_status)
                    VALUES (gen_random_uuid(), :tool_id, :name, :version, :description,
                            :llm_description, :llm_when_to_use, :tags::jsonb,
                            :capabilities::jsonb, 'unknown')
                """),
                {
                    "tool_id": tool["tool_id"],
                    "name": tool["name"],
                    "version": tool["version"],
                    "description": tool["description"],
                    "llm_description": tool["llm_description"],
                    "llm_when_to_use": tool["llm_when_to_use"],
                    "tags": json.dumps(tool["tags"]),
                    "capabilities": json.dumps(tool["capabilities"]),
                },
            )
            inserted += 1
            print(f"  ✓ {tool['name']}")

        await db.commit()
        print(f"\n{'─'*40}")
        print(f"Seeded {inserted} tools, skipped {skipped} existing.")


if __name__ == "__main__":
    asyncio.run(seed())
