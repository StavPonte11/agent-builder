/**
 * NodePalette.tsx — Animated premium node palette
 * Grouped by category with Framer Motion hover effects
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Cpu, Wrench, Database, GitBranch, UserCheck,
  Play, Square, Eye, PenLine, BookOpen,
  MapPin, BarChart3, ChevronDown, Search
} from 'lucide-react';
import type { NodeType } from '../types';

interface NodePaletteProps {
  onAddNode: (type: NodeType, config?: any) => void;
}

interface NodeTemplate {
  type: NodeType | string;
  label: string;
  description: string;
  icon: React.FC<any>;
  color: string;
  category: string;
  defaultConfig?: any;
}

const NODE_TEMPLATES: NodeTemplate[] = [
  // Core Agents
  {
    type: 'llm', label: 'LLM Agent', icon: Cpu, color: '#6366f1', category: 'Core',
    description: 'AI reasoning with model selection',
    defaultConfig: { provider: 'openai', model: 'gpt-4o', temperature: 0.7, max_tokens: 1000 }
  },
  {
    type: 'tool_executor', label: 'Tool Executor', icon: Wrench, color: '#06b6d4', category: 'Core',
    description: 'Execute MCP tools dynamically',
    defaultConfig: { servers: [], allowed_tools: [] }
  },
  {
    type: 'observer', label: 'Observer', icon: Eye, color: '#a78bfa', category: 'Core',
    description: 'Extract entities to knowledge graph',
    defaultConfig: { cognee_enabled: true, extract_entities: true }
  },
  {
    type: 'evaluator', label: 'Evaluator', icon: BarChart3, color: '#fb923c', category: 'Core',
    description: 'Score outputs, sync to Langfuse',
    defaultConfig: { metrics: ['quality', 'safety'], langfuse_enabled: true }
  },

  // Memory & KG
  {
    type: 'memory', label: 'Memory', icon: Database, color: '#10b981', category: 'Memory',
    description: 'Read/write thread state',
    defaultConfig: { memory_type: 'short_term', storage_backend: 'redis' }
  },
  {
    type: 'state_writer', label: 'State Writer', icon: PenLine, color: '#38bdf8', category: 'Memory',
    description: 'Write to shared exercise state',
    defaultConfig: { target: 'exercise_state', operation: 'merge' }
  },
  {
    type: 'state_reader', label: 'State Reader', icon: BookOpen, color: '#67e8f9', category: 'Memory',
    description: 'Read from shared exercise state',
    defaultConfig: { source: 'exercise_state', fields: [] }
  },

  // Flow Control
  {
    type: 'router', label: 'Router', icon: GitBranch, color: '#f59e0b', category: 'Flow',
    description: 'Conditional routing logic',
    defaultConfig: { routing_strategy: 'llm', routes: {} }
  },
  {
    type: 'human_approval', label: 'Human Approval', icon: UserCheck, color: '#ec4899', category: 'Flow',
    description: 'Pause for human decision',
    defaultConfig: { timeout_seconds: 3600 }
  },
  {
    type: 'start', label: 'Start', icon: Play, color: '#22c55e', category: 'Flow',
    description: 'Workflow entry point',
  },
  {
    type: 'end', label: 'End', icon: Square, color: '#ef4444', category: 'Flow',
    description: 'Workflow exit point',
  },

  // Output
  {
    type: 'map_output', label: 'Map Output', icon: MapPin, color: '#06b6d4', category: 'Output',
    description: 'Format output as GeoJSON for map',
    defaultConfig: { format: 'geojson', include_routes: true }
  },
];

const CATEGORIES = ['Core', 'Memory', 'Flow', 'Output'];

const PaletteCard: React.FC<{
  template: NodeTemplate;
  onAdd: () => void;
}> = ({ template, onAdd }) => {
  const Icon = template.icon;
  return (
    <motion.div
      className="palette-node-card"
      whileHover={{ x: 3, borderColor: template.color }}
      whileTap={{ scale: 0.97 }}
      onClick={onAdd}
      transition={{ duration: 0.12 }}
      style={{ borderColor: `${template.color}20`, position: 'relative', overflow: 'hidden' }}
    >
      {/* Glow strip on left */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
        background: template.color, opacity: 0.7, borderRadius: '2px 0 0 2px'
      }} />

      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: `${template.color}18`, border: `1px solid ${template.color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Icon size={13} color={template.color} />
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {template.label}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {template.description}
        </div>
      </div>
    </motion.div>
  );
};

const CategorySection: React.FC<{
  name: string;
  templates: NodeTemplate[];
  onAdd: (t: NodeTemplate) => void;
}> = ({ name, templates, onAdd }) => {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 4px 4px', gap: 6
        }}
      >
        <span className="palette-section-title" style={{ padding: 0 }}>{name}</span>
        <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.15 }}>
          <ChevronDown size={12} color="var(--text-muted)" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            {templates.map(t => (
              <PaletteCard key={t.type} template={t} onAdd={() => onAdd(t)} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const filtered = query
    ? NODE_TEMPLATES.filter(n =>
      n.label.toLowerCase().includes(query.toLowerCase()) ||
      n.description.toLowerCase().includes(query.toLowerCase())
    )
    : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Search */}
      <div style={{ padding: '12px 12px 8px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input"
            placeholder={t('common.search') + '...'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ paddingLeft: 30, fontSize: 12, height: 32 }}
          />
        </div>
      </div>

      {/* Node list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
        {filtered ? (
          <div>
            <div className="palette-section-title">Results ({filtered.length})</div>
            {filtered.map(t => (
              <PaletteCard
                key={t.type}
                template={t}
                onAdd={() => onAddNode(t.type as NodeType, t.defaultConfig)}
              />
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '20px 4px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No nodes found
              </div>
            )}
          </div>
        ) : (
          CATEGORIES.map(cat => {
            const items = NODE_TEMPLATES.filter(n => n.category === cat);
            return (
              <CategorySection
                key={cat}
                name={cat}
                templates={items}
                onAdd={t => onAddNode(t.type as NodeType, t.defaultConfig)}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default NodePalette;
