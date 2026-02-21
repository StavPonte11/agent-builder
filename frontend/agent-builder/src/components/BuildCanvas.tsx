/**
 * Unified Build Canvas
 * Visual editor for Agent Blueprints
 */

import {
  Card,
  Drawer,
  Form,
  Input,
  List,
  message,
  Modal,
  Select,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  Code2,
  Database,
  LayoutGrid,
  Play,
  Save,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence as MotionPresence } from 'framer-motion';
import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  type Connection,
  ConnectionMode,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  Panel,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

import CodePreview from './CodePreview';
import CustomBuildNode from './CustomBuildNode';
import NodeConfigPanel from './NodeConfigPanel';
import NodePalette from './NodePalette';
import ValidationPanel from './ValidationPanel';

import type { Blueprint, BlueprintNode, BlueprintEdge, NodeType, ValidationResult } from '../types';
import apiClient from '../client';

const { Text } = Typography;

const nodeTypes = {
  custom: CustomBuildNode,
};

interface BuildCanvasProps {
  initialBlueprintId?: string;
  onSave?: (blueprintId: string) => void;
}

const BuildCanvas: React.FC<BuildCanvasProps> = ({
  initialBlueprintId,
  onSave,
}) => {
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<BlueprintNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [selectedNode, setSelectedNode] = useState<BlueprintNode | null>(null);
  const [configPanelVisible, setConfigPanelVisible] = useState(false);
  const [paletteVisible, setPaletteVisible] = useState(true);
  const [codePreviewVisible, setCodePreviewVisible] = useState(false);
  const [validation, _setValidation] = useState<ValidationResult | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars

  const [_loading, setLoading] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [saving, setSaving] = useState(false);

  // ── Template Modal ─────────────────────────────────────────────
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [importingTemplate, setImportingTemplate] = useState<string | null>(null);

  const openTemplateModal = async () => {
    setTemplateModalOpen(true);
    setTemplatesLoading(true);
    try {
      const resp = await fetch('/api/blueprints/templates');
      if (!resp.ok) throw new Error('Failed to load templates');
      const data = await resp.json();
      setTemplates(data);
    } catch (e) {
      message.error('Could not load templates');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleImportTemplate = async (templateId: string) => {
    setImportingTemplate(templateId);
    try {
      const resp = await fetch(
        `/api/blueprints/import-template?template_id=${encodeURIComponent(templateId)}`,
        { method: 'POST' }
      );
      if (!resp.ok) throw new Error(await resp.text());
      const saved = await resp.json();
      // Load the newly imported blueprint into canvas
      await loadBlueprint(saved.id);
      setTemplateModalOpen(false);
      message.success(`Template "${saved.name}" loaded into canvas!`);
    } catch (e: any) {
      message.error(`Import failed: ${e.message}`);
    } finally {
      setImportingTemplate(null);
    }
  };

  // Callback to handle node clicks
  const handleNodeClick = useCallback((nodeConfig: BlueprintNode) => {
    setSelectedNode(nodeConfig);
    setConfigPanelVisible(true);
  }, []);

  // Convert Blueprint to ReactFlow
  const blueprintToReactFlow = useCallback((bp: Blueprint) => {
    // We must ensure that the onNodeClick handler is attached to the data
    const flowNodes: Node<BlueprintNode>[] = bp.nodes.map((node) => ({
      id: node.id,
      type: 'custom',
      position: node.position || { x: 0, y: 0 },
      data: {
        ...node,
        // We will attach onNodeClick logic in the render/effect or here if we can close over it
      } as any,
    }));

    // Attach handler
    flowNodes.forEach(n => {
      (n.data as any).onNodeClick = () => handleNodeClick(n.data);
    });

    const flowEdges: Edge[] = bp.edges.map((edge) => ({
      id: edge.id || `e-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: edge.type === 'conditional' ? 'smoothstep' : 'default',
      sourceHandle: edge.source_handle,
      label: edge.label,
      animated: edge.type === 'conditional',
    }));

    // Add visual placeholder edges for LLM nodes (Design parity with n8n)
    bp.nodes.filter(n => n.type === 'llm').forEach(n => {
      // Add placeholders for model, memory, tools if not connected
      ['model', 'memory', 'tools'].forEach(handle => {
        const isConnected = bp.edges.some(e => e.source === n.id && e.source_handle === handle);
        if (!isConnected) {
          flowEdges.push({
            id: `placeholder-${n.id}-${handle}`,
            source: n.id,
            target: 'NOT_CONNECTED', // Visual only markers could be handled better but this works for CSS styling
            sourceHandle: handle,
            style: { strokeDasharray: '5,5', opacity: 0.3 },
            type: 'smoothstep',
            animated: true,
          } as any);
        }
      });
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [handleNodeClick]);

  // Convert ReactFlow to Blueprint
  const reactFlowToBlueprint = useCallback((): Blueprint => {
    const bpNodes: BlueprintNode[] = nodes.map((node) => {
      // The node.data contains the BlueprintNode fields
      const data = node.data as any as BlueprintNode;
      return {
        id: node.id,
        type: data.type,
        config: data.config || {},
        label: data.label,
        description: data.description,
        position: node.position,
      };
    });

    const bpEdges: BlueprintEdge[] = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: (edge.type === 'smoothstep' ? 'conditional' : 'default') as any,
      label: edge.label as string,
    }));

    return {
      blueprint_id: blueprint?.blueprint_id || 'new_agent',
      name: blueprint?.name || 'New Agent',
      description: blueprint?.description,
      state_schema: blueprint?.state_schema || 'BaseMessageState',
      entry_point: bpNodes.find(n => n.type === 'start')?.id || bpNodes[0]?.id || '',
      nodes: bpNodes,
      edges: bpEdges,
      version: (blueprint?.version || 0) + 1,
    };
  }, [nodes, edges, blueprint]);

  // Load blueprint
  useEffect(() => {
    if (initialBlueprintId) {
      loadBlueprint(initialBlueprintId);
    } else {
      // Initialize with default state
      const startNodeData: BlueprintNode = { id: 'start', type: 'start', label: 'Start', config: {} };
      const initialNodes: Node<BlueprintNode>[] = [
        {
          id: 'start',
          type: 'custom',
          position: { x: 50, y: 250 },
          data: { ...startNodeData, onNodeClick: () => handleNodeClick(startNodeData) } as any
        },
      ];
      setNodes(initialNodes);
      setBlueprint({
        blueprint_id: 'draft_' + Date.now(),
        name: 'Untitled Agent',
        state_schema: 'BaseMessageState',
        nodes: [],
        edges: [],
        entry_point: 'start',
      });
    }
  }, [initialBlueprintId, setNodes, handleNodeClick, blueprintToReactFlow]);

  const loadBlueprint = async (id: string) => {
    setLoading(true);
    try {
      const loadedBp = await apiClient.getBlueprint(id);
      setBlueprint(loadedBp);
      const { nodes: flowNodes, edges: flowEdges } = blueprintToReactFlow(loadedBp);
      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (error) {
      message.error('Failed to load blueprint');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
    setConfigPanelVisible(false);
  }, [setNodes, setEdges]);

  const [scheduleVisible, setScheduleVisible] = useState(false);

  const handleNodeConfigSave = useCallback(
    async (nodeId: string, updates: Record<string, any>) => {
      // Update nodes state
      setNodes((nds) => {
        const updatedNodes = nds.map((node) => {
          if (node.id === nodeId) {
            const updatedData = {
              ...node.data,
              ...updates,
              config: {
                ...node.data.config,
                ...updates.config,
              },
            };
            return {
              ...node,
              data: {
                ...updatedData,
                onNodeClick: () => handleNodeClick(updatedData as BlueprintNode),
              },
            } as Node<BlueprintNode>;
          }
          return node;
        });

        // Auto-spawn logic for LLM nodes
        const currentNode = updatedNodes.find(n => n.id === nodeId);
        if (currentNode && (currentNode.data as any).type === 'llm') {
          const config = (currentNode.data as any).config;

          // Handle Memory Auto-spawn
          if (config.memory_id) {
            const memoryExists = updatedNodes.some(n =>
              (n.data as any).type === 'memory' && (n.data as any).config.memory_id === config.memory_id
            );

            if (!memoryExists) {
              const memId = `memory_${Date.now()}`;
              const newNode: Node<BlueprintNode> = {
                id: memId,
                type: 'custom',
                position: { x: currentNode.position.x - 50, y: currentNode.position.y + 150 },
                data: {
                  id: memId,
                  type: 'memory',
                  label: 'Project Memory',
                  config: { memory_id: config.memory_id, memory_type: 'short_term' },
                  onNodeClick: () => { } // Will be attached later
                } as any,
              };
              updatedNodes.push(newNode);

              // Add edge
              setTimeout(() => {
                setEdges(eds => addEdge({
                  id: `e-${nodeId}-mem`,
                  source: nodeId,
                  target: memId,
                  sourceHandle: 'memory',
                }, eds));
              }, 100);
            }
          }

          // Handle Tools Auto-spawn
          if (config.tools && Array.isArray(config.tools)) {
            config.tools.forEach((toolName: string, idx: number) => {
              const toolExists = updatedNodes.some(n =>
                (n.data as any).type === 'tool_executor' && (n.data as any).config.tool_name === toolName
              );

              if (!toolExists) {
                const tId = `tool_${Date.now()}_${idx}`;
                const newNode: Node<BlueprintNode> = {
                  id: tId,
                  type: 'custom',
                  position: { x: currentNode.position.x + 150 + (idx * 200), y: currentNode.position.y + 150 },
                  data: {
                    id: tId,
                    type: 'tool_executor',
                    label: toolName,
                    config: { tool_name: toolName },
                    onNodeClick: () => { }
                  } as any,
                };
                updatedNodes.push(newNode);

                // Add edge
                setTimeout(() => {
                  setEdges(eds => addEdge({
                    id: `e-${nodeId}-tool-${idx}`,
                    source: nodeId,
                    target: tId,
                    sourceHandle: 'tools',
                  }, eds));
                }, 100);
              }
            });
          }
        }

        return updatedNodes;
      });

      setConfigPanelVisible(false);
    },
    [setNodes, setEdges, handleNodeClick]
  );

  const [executing, setExecuting] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);

  // Poll for execution status
  useEffect(() => {
    let pollInterval: any;
    if (executing && executionId) {
      pollInterval = window.setInterval(async () => {
        try {
          const status = await apiClient.getExecutionStatus(executionId);
          if (status.status === 'completed' || status.status === 'failed') {
            setExecuting(false);
            setNodes((nds) =>
              nds.map((node) => ({
                ...node,
                data: {
                  ...node.data,
                  status: status.status === 'completed' ? 'success' : 'error',
                },
              }))
            );
            message.success(`Workflow ${status.status}!`);
            window.clearInterval(pollInterval);
          }
        } catch (e) {
          console.error('Status poll failed', e);
        }
      }, 2000);
    }
    return () => {
      if (pollInterval) window.clearInterval(pollInterval);
    };
  }, [executing, executionId, setNodes]);

  const handleRunTest = async () => {
    if (!blueprint?.id) {
      message.error('Please save the blueprint first');
      return;
    }

    setExecuting(true);
    message.loading({ content: 'Starting test...', key: 'test-exec' });

    try {
      // 1. Trigger execution
      const result = await apiClient.triggerExecution(blueprint.id, { test_mode: true });
      setExecutionId(result.execution_id);

      // 2. Update nodes to 'running' status
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          data: { ...node.data, status: 'running' },
        }))
      );

      message.success({ content: 'Workflow started!', key: 'test-exec' });
    } catch (e) {
      message.error({ content: 'Failed to start test', key: 'test-exec' });
      setExecuting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentBlueprint = reactFlowToBlueprint();
      let response;
      if (blueprint && blueprint.id) {
        response = await apiClient.updateBlueprint(blueprint.id, currentBlueprint);
      } else {
        response = await apiClient.createBlueprint(currentBlueprint);
      }

      setBlueprint(response);
      message.success('Blueprint saved successfully');
      if (onSave && response.id) {
        onSave(response.id);
      }
    } catch (error) {
      console.warn('Backend save failed (mock mode)', error);
      message.success('Blueprint saved (Mock)');
      setBlueprint((prev) => ({ ...prev!, ...reactFlowToBlueprint() }));
    } finally {
      setSaving(false);
    }
  };

  const handleAddNode = useCallback(
    (type: NodeType, defaultConfig?: any) => {
      const id = `${type}_${Date.now()}`;
      const nodeData: BlueprintNode = {
        id,
        type,
        label: type.replace('_', ' '),
        config: defaultConfig || {},
      };

      const newNode: Node<BlueprintNode> = {
        id,
        type: 'custom',
        position: {
          x: Math.random() * 400 + 100,
          y: Math.random() * 300 + 100,
        },
        data: {
          ...nodeData,
          onNodeClick: () => handleNodeClick(nodeData),
        } as any,
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes, handleNodeClick]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, type: 'default' }, eds));
    },
    [setEdges]
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      {/* ── Toolbar ── */}
      <div style={{
        height: 56,
        minHeight: 56,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        gap: 12,
        flexShrink: 0,
      }}>
        {/* Left: blueprint name + version */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <LayoutGrid size={13} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {blueprint?.name || 'Untitled Agent'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
                background: 'rgba(99,102,241,0.15)', color: '#818cf8',
              }}>v{blueprint?.version || 1}</span>
              <Text style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {blueprint?.blueprint_id?.slice(0, 16)}
              </Text>
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={openTemplateModal}>
            <Database size={13} /> Load Template
          </button>
          <button
            className={`btn btn-sm ${paletteVisible ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPaletteVisible(!paletteVisible)}
          >
            <LayoutGrid size={13} /> Palette
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setScheduleVisible(true)}>
            <Play size={13} /> Schedule
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setCodePreviewVisible(true)}>
            <Code2 size={13} /> JSON
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
          <button className="btn btn-secondary btn-sm" onClick={handleSave} disabled={saving}>
            <Save size={13} /> {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            className="btn btn-sm btn-success"
            onClick={handleRunTest}
            disabled={executing}
          >
            <Zap size={13} /> {executing ? 'Running…' : 'Run & Test'}
          </button>
        </div>
      </div>

      {/* ── Canvas area: palette + flow ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Palette slide-over */}
        <MotionPresence>
          {paletteVisible && (
            <motion.div
              key="palette"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{
                background: 'var(--bg-surface)',
                borderRight: '1px solid var(--border)',
                overflow: 'hidden',
                flexShrink: 0,
                zIndex: 2,
              }}
            >
              <NodePalette onAddNode={handleAddNode} />
            </motion.div>
          )}
        </MotionPresence>

        {/* ReactFlow Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            onNodesDelete={(deleted) => { deleted.forEach(n => handleDeleteNode(n.id)); }}
            fitView
            style={{ width: '100%', height: '100%', background: 'var(--bg-base)' }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="var(--bg-subtle)"
            />
            <Controls showInteractive={false} style={{ margin: 16 }} />
            <MiniMap
              nodeStrokeColor={(n) => {
                const t = (n.data as any)?.type;
                if (t === 'start') return '#22c55e';
                if (t === 'end') return '#ef4444';
                if (t === 'llm') return '#6366f1';
                return '#6366f1';
              }}
              nodeColor={(n) => {
                const t = (n.data as any)?.type;
                if (t === 'start') return 'rgba(34,197,94,0.2)';
                if (t === 'end') return 'rgba(239,68,68,0.2)';
                return 'rgba(99,102,241,0.15)';
              }}
              maskColor="rgba(9,9,11,0.7)"
              style={{ height: 110, width: 160, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10 }}
            />

            <Panel position="top-right" style={{ margin: 16 }}>
              {validation && (
                <div style={{ maxWidth: 350 }}>
                  <ValidationPanel validation={validation} compact />
                </div>
              )}
            </Panel>
          </ReactFlow>
        </div>
      </div>

      {/* Node Configuration Panel */}
      <NodeConfigPanel
        onSave={handleNodeConfigSave}
        onDelete={handleDeleteNode}
        node={selectedNode}
        visible={configPanelVisible}
        onClose={() => setConfigPanelVisible(false)}
      />

      {/* Schedule Drawer */}
      <Drawer
        title="Schedule Workflow"
        placement="right"
        width={400}
        open={scheduleVisible}
        onClose={() => setScheduleVisible(false)}
      >
        <div style={{ padding: 16, background: 'var(--bg-elevated)', borderRadius: 8, marginBottom: 16, border: '1px solid var(--border)' }}>
          <Text style={{ color: 'var(--text-secondary)' }}>Define when this agent should run automatically.</Text>
        </div>
        <Form layout="vertical">
          <Form.Item label="Interval" name="interval">
            <Select defaultValue="manual">
              <Select.Option value="manual">Manual Only</Select.Option>
              <Select.Option value="hourly">Hourly</Select.Option>
              <Select.Option value="daily">Daily</Select.Option>
              <Select.Option value="weekly">Weekly</Select.Option>
              <Select.Option value="custom">Custom Cron</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="Cron Expression" name="cron">
            <Input placeholder="0 * * * *" />
          </Form.Item>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            <Save size={14} /> Set Schedule
          </button>
        </Form>
      </Drawer>

      {/* Code Preview */}
      <Drawer
        title="Blueprint JSON"
        placement="right"
        width={600}
        open={codePreviewVisible}
        onClose={() => setCodePreviewVisible(false)}
      >
        <CodePreview code={JSON.stringify(blueprint || reactFlowToBlueprint(), null, 2)} language="json" />
      </Drawer>

      {/* Template Picker Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={16} color="var(--brand-primary)" />
            <span>Load Blueprint Template</span>
          </div>
        }
        open={templateModalOpen}
        onCancel={() => setTemplateModalOpen(false)}
        footer={null}
        width={640}
      >
        {templatesLoading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spin size="large" tip="Loading templates..." />
          </div>
        ) : templates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
            No templates found. Add JSON files to <code>backend/templates/</code>.
          </div>
        ) : (
          <List
            dataSource={templates}
            renderItem={(tmpl: any) => (
              <Card
                key={tmpl.template_id}
                style={{ marginBottom: 12, cursor: 'pointer' }}
                bodyStyle={{ padding: '12px 16px' }}
                hoverable
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap size={13} color="#faad14" />
                      {tmpl.name}
                    </div>
                    <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                      {tmpl.description}
                    </div>
                    <div>
                      {(tmpl.tags || []).map((tag: string) => (
                        <Tag key={tag} color="blue" style={{ fontSize: 10 }}>{tag}</Tag>
                      ))}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ marginLeft: 16, flexShrink: 0 }}
                    disabled={importingTemplate === tmpl.template_id}
                    onClick={() => handleImportTemplate(tmpl.template_id)}
                  >
                    {importingTemplate === tmpl.template_id ? 'Loading…' : 'Load'}
                  </button>
                </div>
              </Card>
            )}
          />
        )}
      </Modal>
    </div>
  );
};

export default BuildCanvas;
