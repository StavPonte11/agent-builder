/**
 * API Client for backend communication
 */

import axios, { type AxiosInstance } from 'axios';
import type {
    Blueprint,
    TestSuite,
    Evaluation,
    ExecuteRequest,
    ExecuteResponse,
    PublishRequest,
    PublishResponse,
    SandboxChatResponse,
} from './types';
export type { ApprovalRequest } from './types'; // re-exported for consumers

export interface ExecutionStatusResponse {
    execution_id: string;
    workflow_id: string;
    status: 'running' | 'completed' | 'failed';
    result?: any;
    created_at: string;
}

class APIClient {
    private client: AxiosInstance;

    constructor(baseURL: string = 'http://localhost:8000') {
        this.client = axios.create({
            baseURL,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    // Blueprint Management

    async createBlueprint(blueprint: Blueprint): Promise<Blueprint> {
        const response = await this.client.post('/api/blueprints', blueprint);
        return response.data;
    }

    async getBlueprint(blueprintId: string): Promise<Blueprint> {
        const response = await this.client.get(`/api/blueprints/${blueprintId}`);
        const backendData = response.data;

        // Transform backend response to match frontend Blueprint type
        return {
            id: backendData.id,
            blueprint_id: backendData.id,
            name: backendData.name,
            description: backendData.description,
            ...backendData.blueprint_data,
            owner_id: backendData.owner_id,
            created_at: backendData.created_at,
            updated_at: backendData.updated_at,
        };
    }

    async updateBlueprint(
        blueprintId: string,
        blueprint: Blueprint
    ): Promise<Blueprint> {
        const response = await this.client.put(
            `/api/blueprints/${blueprintId}`,
            blueprint
        );
        return response.data;
    }

    async listBlueprints(): Promise<Blueprint[]> {
        const response = await this.client.get('/api/blueprints');
        return response.data;
    }

    // Testing & Execution

    async createTestSuite(
        buildId: string,
        testSuite: TestSuite
    ): Promise<{ test_suite_id: string }> {
        const response = await this.client.post(
            `/api/builds/${buildId}/tests`,
            testSuite
        );
        return response.data;
    }

    async runTests(
        buildId: string,
        testId: string,
        userId: string
    ): Promise<{
        evaluation_id: string;
        passed: boolean;
        metrics: any;
        langfuse_experiment_id?: string;
    }> {
        const response = await this.client.post(
            `/api/builds/${buildId}/tests/${testId}/run?user_id=${userId}`
        );
        return response.data;
    }

    async getEvaluations(buildId: string): Promise<{ evaluations: Evaluation[] }> {
        const response = await this.client.get(`/api/builds/${buildId}/evaluations`);
        return response.data;
    }

    // Sandbox

    async sandboxChat(
        buildId: string,
        message: string,
        userId: string,
        sessionId: string = 'default'
    ): Promise<SandboxChatResponse> {
        const response = await this.client.post(
            `/api/sandbox/${buildId}/chat?message=${encodeURIComponent(
                message
            )}&user_id=${userId}&session_id=${sessionId}`
        );
        return response.data;
    }

    async getSandboxHistory(
        buildId: string,
        sessionId: string
    ): Promise<{ messages: any[] }> {
        const response = await this.client.get(
            `/api/sandbox/${buildId}/history?session_id=${sessionId}`
        );
        return response.data;
    }

    // Publishing

    async requestPublish(request: PublishRequest): Promise<PublishResponse> {
        const response = await this.client.post(
            `/api/builds/${request.build_id}/publish`,
            request
        );
        return response.data;
    }

    async approvePublish(
        approvalId: string,
        adminId: string
    ): Promise<{ message: string; version: number }> {
        const response = await this.client.post(
            `/api/approvals/${approvalId}/approve?admin_id=${adminId}`
        );
        return response.data;
    }

    async rejectPublish(
        approvalId: string,
        adminId: string,
        reason: string
    ): Promise<{ message: string; reason: string }> {
        const response = await this.client.post(
            `/api/approvals/${approvalId}/reject?admin_id=${adminId}&reason=${encodeURIComponent(
                reason
            )}`
        );
        return response.data;
    }

    // Execution

    async execute(request: ExecuteRequest): Promise<ExecuteResponse> {
        const response = await this.client.post(
            `/api/builds/${request.build_id}/execute`,
            request
        );
        return response.data;
    }

    async triggerExecution(blueprintId: string, inputData: any = {}): Promise<ExecutionStatusResponse> {
        const response = await this.client.post('/api/execute', {
            blueprint_id: blueprintId,
            input_data: inputData
        });
        return response.data;
    }

    async getExecutionStatus(executionId: string): Promise<ExecutionStatusResponse> {
        const response = await this.client.get(`/api/execute/${executionId}/status`);
        return response.data;
    }

    async getExecutions(
        buildId: string,
        limit: number = 50
    ): Promise<{ executions: any[] }> {
        const response = await this.client.get(
            `/api/builds/${buildId}/executions?limit=${limit}`
        );
        return response.data;
    }

    async getExecutionDetails(
        buildId: string,
        executionId: string
    ): Promise<any> {
        const response = await this.client.get(
            `/api/builds/${buildId}/executions/${executionId}`
        );
        return response.data;
    }

    // MCP Tools (New)
    async listMCPTools(): Promise<any[]> {
        const response = await this.client.get('/api/tools/mcp');
        return response.data;
    }
}

const apiClient = new APIClient();
export default apiClient;
