/**
 * TypeScript types for the Blueprint Access
 * Mirrors backend Pydantic models
 */

export type BuilderType = 'workflow' | 'agent';

// Node Types
export type NodeType =
    | 'llm'
    | 'tool_executor'
    | 'memory'
    | 'router'
    | 'human_approval'
    | 'start'
    | 'end'
    | 'observer'
    | 'state_writer'
    | 'state_reader'
    | 'map_output'
    | 'evaluator';

export type EdgeType = 'default' | 'conditional';

export interface NodePosition {
    x: number;
    y: number;
}

// Configuration Interfaces

export interface LLMConfig {
    provider: 'openai' | 'anthropic' | 'google';
    model: string;
    temperature: number;
    max_tokens: number;
    system_prompt: string;
    user_prompt_template?: string;
    streaming?: boolean;
}

export interface ToolExecutorConfig {
    servers: string[]; // List of MCP server names
    allowed_tools: string[]; // List of specific tool names
}

export interface MemoryConfig {
    memory_type: 'short_term' | 'long_term';
    storage_backend: 'redis' | 'postgres' | 'in_memory';
    session_id_template?: string;
}

export interface RouterConfig {
    routing_strategy: 'llm' | 'rule_based';
    routes: Record<string, string>; // match -> next_node_id
    llm_config?: LLMConfig;
}

export interface HumanApprovalConfig {
    timeout_seconds?: number;
    required_role?: string;
}

// Blueprint Node
export interface BlueprintNode {
    id: string;
    type: NodeType;
    config: Record<string, any>; // Flexible config bag
    position?: NodePosition; // UI-only, might not be sent to backend if backend doesn't care
    label?: string; // UI-only
    description?: string; // UI-only
}

// Blueprint Edge
export interface BlueprintEdge {
    id?: string; // UI-only usually
    source: string;
    target: string;
    source_handle?: string; // Connector ID (e.g., 'model', 'memory')
    type?: EdgeType;
    condition?: string; // For conditional edges
    label?: string;
}

// The Blueprint itself
export interface Blueprint {
    id?: string;
    blueprint_id: string; // "agent_customer_support"
    name: string;
    description?: string;
    state_schema: string; // "BaseMessageState"
    nodes: BlueprintNode[];
    edges: BlueprintEdge[];
    entry_point: string;
    version?: number;
    metadata?: Record<string, any>;
}

// MCP Tool Definition (for the Palette/Configuration)
export interface MCPTool {
    name: string;
    description?: string;
    server_name: string;
    input_schema: Record<string, any>;
}


// --- Legacy or Shared Types (kept for compatibility during refactor if needed) ---

export interface ValidationIssue {
    severity: 'error' | 'warning' | 'info';
    node_id?: string;
    message: string;
    suggestion?: string;
    auto_fix_available?: boolean;
}

export interface ValidationResult {
    status: 'valid' | 'warnings' | 'errors';
    issues: ValidationIssue[];
    estimated_cost?: number;
    estimated_duration?: number;
    estimated_tokens?: number;
}

// Sandbox Types
export interface SandboxChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    metadata?: {
        tokens_used?: number;
        cost?: number;
        langfuse_trace_url?: string;
    };
}

export interface SandboxChatResponse {
    response: string;
    tokens_used: number;
    cost: number;
    langfuse_trace_url?: string;
    guardrail_violations: any[];
}

// Testing Types
export interface TestCase {
    id: string;
    name: string;
    description?: string;
    input_data: Record<string, any>;
    expected_output?: Record<string, any>;
    success_criteria?: Record<string, any>;
    tags?: string[];
}

export interface TestSuite {
    id: string;
    build_id: string;
    name: string;
    test_type: 'unit' | 'integration' | 'e2e';
    test_cases: TestCase[];
    created_at: string;
}

export interface Evaluation {
    id: string;
    test_suite_id: string;
    passed: boolean;
    metrics: {
        success_rate: number;
        avg_latency: number;
        total_cost: number;
        avg_tokens: number;
    };
    langfuse_experiment_id?: string;
    created_at: string;
}

// Execution Types
export interface ExecuteRequest {
    build_id: string;
    input: Record<string, any>;
    user_id?: string;
}

export interface ExecuteResponse {
    execution_id: string;
    output: Record<string, any>;
    status: 'success' | 'failure';
    error?: string;
    metadata?: Record<string, any>;
}

// Publishing Types
export interface PublishRequest {
    build_id: string;
    version_note: string;
    requested_by: string;
}

export interface PublishResponse {
    approval_id: string;
    status: 'pending' | 'approved' | 'rejected';
}

export interface ApprovalRequest {
    id: string;
    build_id: string;
    build_version: number;
    requested_by: string;
    requested_at: string;
    status: 'pending' | 'approved' | 'rejected';
    version_note: string;
    notes?: string;
    evaluation_id?: string;
    passed_tests?: number;
    sanity_check_results?: Array<{ check: string; passed: boolean; details?: string }>;
}