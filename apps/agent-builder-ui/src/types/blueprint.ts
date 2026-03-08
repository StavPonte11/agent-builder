/**
 * Shared TypeScript types for the Universal Agentic Canvas Platform.
 * Mirrors the BlueprintDefinition schema v2.0 from the platform spec.
 */

// ─── Canvas Modes ────────────────────────────────────────────────────────────

export type CanvasMode = 'build' | 'execute' | 'review'

export type NodeStatus =
    | 'idle'
    | 'running'
    | 'completed'
    | 'failed'
    | 'retrying'
    | 'paused'
    | 'skipped'

export type BlueprintStatus =
    | 'draft'
    | 'validating'
    | 'testing'
    | 'pending_approval'
    | 'published'
    | 'archived'
    | 'paused'

// ─── Blueprint Core ───────────────────────────────────────────────────────────

export type BlueprintType = 'workflow' | 'agent' | 'sub_blueprint'

export type TriggerType =
    | 'webhook'
    | 'schedule'
    | 'manual'
    | 'event'
    | 'api'
    | 'chat'

export interface TriggerConfig {
    type: TriggerType
    config: Record<string, unknown>
    idempotency_key_expr?: string
    idempotency_window_seconds?: number
}

export interface StateFieldDefinition {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any'
    default?: unknown
    description: string
    is_persisted: boolean
    is_sensitive: boolean
    is_inspectable: boolean
}

export interface ExecutionConfig {
    timeout_minutes: number
    max_retries_per_node: number
    checkpoint_enabled: boolean
    allow_parallel: boolean
    priority: 'low' | 'normal' | 'high' | 'critical'
}

export interface GuardrailConfig {
    input_moderation: boolean
    output_moderation: boolean
    pii_detection: 'off' | 'detect' | 'redact' | 'block'
    injection_detection: boolean
    max_input_tokens: number
    max_output_tokens: number
    max_cost_usd: number | null
    rate_limit_per_user: number | null
}

export interface EvalDimension {
    name: string
    weight: number
    rubric: string
    score_type: 'continuous' | 'binary'
}

export interface EvaluationConfig {
    auto_evaluate: boolean
    judge_model: string
    scoring_dimensions: EvalDimension[]
    pass_threshold: number
    auto_pause_after_failures: number
    langfuse_dataset_id?: string
}

// ─── Node Data ───────────────────────────────────────────────────────────────

export type NodeType =
    | 'trigger'
    | 'llm'
    | 'tool'
    | 'condition'
    | 'router'
    | 'approval'
    | 'memory_read'
    | 'memory_write'
    | 'code'
    | 'sub_blueprint'
    | 'output'
    | 'parallel_fork'
    | 'loop'
    | 'llm_judge'

// Common fields on ALL node data objects
export interface BaseNodeData {
    label: string
    description?: string
    timeout?: number
    retry_max_attempts?: number
    retry_backoff?: 'linear' | 'exponential'
    input_mapping?: MappingEntry[]
    output_mapping?: MappingEntry[]
    notes?: string
}

export interface MappingEntry {
    id: string
    param: string
    expression: string
}

export interface LLMNodeData extends BaseNodeData {
    provider?: 'openai' | 'anthropic' | 'google' | 'custom'
    model?: string
    system_prompt?: string
    user_prompt?: string
    output_schema?: string // JSON schema string
    temperature?: number
    max_tokens?: number
    streaming?: boolean
}

export interface ToolNodeData extends BaseNodeData {
    tool_id?: string
    capability?: string
}

export interface ConditionNodeData extends BaseNodeData {
    expression?: string
    true_label?: string
    false_label?: string
}

export interface RouterNodeData extends BaseNodeData {
    routing_prompt?: string
    routes?: RouteEntry[]
    fallback_route?: string
    confidence_threshold?: number
}

export interface RouteEntry {
    id: string
    name: string
    description: string
}

export interface ApprovalNodeData extends BaseNodeData {
    approver_role?: string
    context_template?: string
    timeout_minutes?: number
    timeout_action?: 'approve' | 'reject' | 'escalate'
    escalation_path?: string
}

export interface SubBlueprintNodeData extends BaseNodeData {
    blueprint_id?: string
    version?: string | 'latest'
}

export interface ParallelForkNodeData extends BaseNodeData {
    merge_strategy?: 'union' | 'first_wins' | 'custom_expression'
    merge_expression?: string
    max_parallelism?: number
    timeout_minutes?: number
    on_branch_failure?: 'continue_others' | 'cancel_all'
    branches?: BranchEntry[]
}

export interface BranchEntry {
    id: string
    name: string
    node_ids: string[]
}

export interface LoopNodeData extends BaseNodeData {
    iterate_over?: string
    loop_body_node_ids?: string[]
    item_variable_name?: string
    output_variable_name?: string
    parallelism?: number
    max_iterations?: number
}

export interface LLMJudgeNodeData extends BaseNodeData {
    target_field?: string
    rubric?: string
    judge_model?: string
    score_threshold?: number
    pass_route?: string
    fail_route?: string
    max_attempts?: number
}

export interface MemoryNodeData extends BaseNodeData {
    backend?: 'redis' | 'postgres'
    key?: string
    ttl?: number // seconds, 0 = no expiry (write only)
}

export interface CodeNodeData extends BaseNodeData {
    code?: string
}

export interface OutputNodeData extends BaseNodeData {
    output_fields?: MappingEntry[]
}

// ─── Blueprint Definition ─────────────────────────────────────────────────────

export interface BlueprintDefinition {
    schema_version: '2.0'
    blueprint_id: string
    name: string
    description: string
    blueprint_type: BlueprintType
    domain: string
    trigger: TriggerConfig
    nodes: BlueprintNode[]
    edges: BlueprintEdge[]
    state_schema: Record<string, StateFieldDefinition>
    input_schema: Record<string, unknown>
    output_schema: Record<string, unknown>
    base_prompt_id?: string
    guardrails: GuardrailConfig
    execution: ExecutionConfig
    evaluation: EvaluationConfig
    metadata: {
        author_id: string
        created_at: string
        tags: string[]
        domain: string
        complexity_estimate: number
        estimated_cost_per_run_usd: number
    }
}

export interface BlueprintNode {
    id: string
    type: NodeType
    position: { x: number; y: number }
    data: BaseNodeData & Record<string, unknown>
}

export interface BlueprintEdge {
    id: string
    source: string
    target: string
    sourceHandle?: string
    targetHandle?: string
    label?: string
    type?: string
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationError {
    type: 'error' | 'warning'
    node_id?: string
    field?: string
    message: string
    code: string
}

export interface ValidationResult {
    valid: boolean
    errors: ValidationError[]
    warnings: ValidationError[]
}

// ─── Cost Estimation ─────────────────────────────────────────────────────────

export interface NodeCostEstimate {
    node_id: string
    node_label: string
    estimated_tokens: number
    estimated_cost_usd: number
}

export interface CostEstimate {
    nodes: NodeCostEstimate[]
    total_tokens: number
    total_cost_usd: number
}

// ─── Tool Registry ────────────────────────────────────────────────────────────

export type ToolHealthStatus = 'healthy' | 'degraded' | 'offline' | 'unknown'

export interface ToolCapability {
    name: string
    description: string
    when_to_use: string
    method: string
    path: string
    input_schema: Record<string, unknown>
    output_schema: Record<string, unknown>
    estimated_latency_ms?: number
}

export interface Tool {
    tool_id: string
    name: string
    version: string
    description: string
    llm_description: string
    llm_when_to_use: string
    capabilities: ToolCapability[]
    tags: string[]
    health_status?: ToolHealthStatus
}

// ─── WebSocket Events ─────────────────────────────────────────────────────────

export type ExecutionEventType =
    | 'node_queued'
    | 'node_started'
    | 'node_streaming'
    | 'node_completed'
    | 'node_failed'
    | 'node_retrying'
    | 'node_skipped'
    | 'approval_required'
    | 'approval_resolved'
    | 'guardrail_triggered'
    | 'state_updated'
    | 'execution_started'
    | 'execution_completed'
    | 'execution_failed'
    | 'execution_cancelled'
    | 'cost_update'

export interface ExecutionEvent {
    type: ExecutionEventType
    execution_id: string
    timestamp: string
    node_id?: string
    node_type?: string
    node_label?: string
    input_preview?: string
    output_preview?: string
    chunk?: string
    duration_ms?: number
    token_usage?: { prompt: number; completion: number; total: number }
    error_type?: string
    error_message?: string
    will_retry?: boolean
    attempt?: number
    max_attempts?: number
    reason?: string
    approval_id?: string
    context?: string
    timeout_minutes?: number
    action?: string
    check_type?: string
    action_taken?: string
    detail?: string
    changed_fields?: string[]
    blueprint_name?: string
    version?: string
    mode?: string
    estimated_cost_usd?: number
    total_duration_ms?: number
    total_cost_usd?: number
    failed_node_id?: string
    cancelled_by?: string
    cumulative_tokens?: number
    cumulative_cost_usd?: number
    budget_pct_used?: number
}

// ─── State Schema Derived Types ───────────────────────────────────────────────

export interface DerivedStateField {
    field: string
    type: string
    written_by: string
    read_by: string[]
    is_orphaned: boolean // produced but never consumed
    is_undefined: boolean // consumed but never produced
}
