/**
 * CustomBuildNode.tsx — Premium node renderer with Framer Motion
 * n8n-inspired with glow effects, animated status, and per-type colors
 */

import React from 'react';
import { Handle, Position } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, Wrench, Database, GitBranch, UserCheck,
  Play, Square, Eye, PenLine, BookOpen,
  MapPin, BarChart3, Plus, CheckCircle2,
  AlertCircle, Loader2
} from 'lucide-react';
import type { BlueprintNode } from '../types';

// ── Types ──────────────────────────────────────────────────────────
interface CustomBuildNodeProps {
  data: BlueprintNode & {
    onNodeClick?: () => void;
    status?: 'running' | 'success' | 'error' | 'waiting';
  };
  selected?: boolean;
}

// ── Node Config ────────────────────────────────────────────────────
const NODE_CONFIG: Record<string, { icon: React.FC<any>; color: string; label: string; glow: string }> = {
  llm: { icon: Cpu, color: '#6366f1', label: 'LLM Agent', glow: 'rgba(99,102,241,0.35)' },
  tool_executor: { icon: Wrench, color: '#06b6d4', label: 'Tool', glow: 'rgba(6,182,212,0.3)' },
  memory: { icon: Database, color: '#10b981', label: 'Memory', glow: 'rgba(16,185,129,0.3)' },
  router: { icon: GitBranch, color: '#f59e0b', label: 'Router', glow: 'rgba(245,158,11,0.3)' },
  human_approval: { icon: UserCheck, color: '#ec4899', label: 'Human', glow: 'rgba(236,72,153,0.3)' },
  start: { icon: Play, color: '#22c55e', label: 'Start', glow: 'rgba(34,197,94,0.3)' },
  end: { icon: Square, color: '#ef4444', label: 'End', glow: 'rgba(239,68,68,0.3)' },
  observer: { icon: Eye, color: '#a78bfa', label: 'Observer', glow: 'rgba(167,139,250,0.3)' },
  state_writer: { icon: PenLine, color: '#38bdf8', label: 'State Writer', glow: 'rgba(56,189,248,0.3)' },
  state_reader: { icon: BookOpen, color: '#67e8f9', label: 'State Reader', glow: 'rgba(103,232,249,0.3)' },
  map_output: { icon: MapPin, color: '#06b6d4', label: 'Map Output', glow: 'rgba(6,182,212,0.3)' },
  evaluator: { icon: BarChart3, color: '#fb923c', label: 'Evaluator', glow: 'rgba(251,146,60,0.3)' },
};

const getConfig = (type: string) =>
  NODE_CONFIG[type] ?? { icon: Cpu, color: '#6366f1', label: type, glow: 'rgba(99,102,241,0.3)' };

// ── Status Ring ────────────────────────────────────────────────────
const StatusRing: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { icon: React.FC<any>; color: string; spin?: boolean }> = {
    running: { icon: Loader2, color: '#6366f1', spin: true },
    success: { icon: CheckCircle2, color: '#10b981' },
    error: { icon: AlertCircle, color: '#ef4444' },
    waiting: { icon: Loader2, color: '#f59e0b', spin: true },
  };
  const s = map[status];
  if (!s) return null;
  const Icon = s.icon;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      style={{
        position: 'absolute', top: -10, right: -10, zIndex: 20,
        background: '#111113', borderRadius: '50%', width: 24, height: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `2px solid ${s.color}`,
        boxShadow: `0 0 10px ${s.color}80`,
      }}
    >
      <motion.div animate={s.spin ? { rotate: 360 } : {}} transition={s.spin ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}>
        <Icon size={11} color={s.color} />
      </motion.div>
    </motion.div>
  );
};

// ── Handle Dot ─────────────────────────────────────────────────────
const HandleDot: React.FC<{ type: 'source' | 'target'; position: Position; id?: string; color: string }> = ({ type, position, id, color }) => (
  <Handle
    type={type}
    position={position}
    id={id}
    style={{
      background: '#111113',
      width: 10, height: 10,
      border: `2px solid ${color}`,
      borderRadius: '50%',
      zIndex: 10,
    }}
  />
);

// ── Main Node ──────────────────────────────────────────────────────
const CustomBuildNode: React.FC<CustomBuildNodeProps> = ({ data, selected }) => {
  const { type, label, config, onNodeClick, status } = data;
  const { icon: Icon, color, label: typeLabel, glow } = getConfig(type);
  const isLLM = type === 'llm';

  // Show model badge
  const modelBadge = config?.model
    ? config.model.includes('gpt') ? 'GPT-4'
      : config.model.includes('claude') ? 'Claude'
        : config.model.includes('gemini') ? 'Gemini'
          : config.model.slice(0, 8)
    : null;

  const toolBadge = (type === 'tool_executor') && (config?.tool_name || config?.name);

  return (
    <motion.div
      onClick={onNodeClick}
      className="flow-node"
      whileHover={{ scale: 1.02 }}
      animate={{
        boxShadow: selected
          ? `0 0 0 2px ${color}, 0 0 24px ${glow}`
          : status === 'running'
            ? `0 0 0 1px ${color}60, 0 0 20px ${glow}`
            : 'none',
        borderColor: selected ? color : '#27272a',
      }}
      transition={{ duration: 0.2 }}
      style={{ cursor: 'pointer', position: 'relative' }}
    >
      {/* Status ring */}
      <AnimatePresence>
        {status && <StatusRing key={status} status={status} />}
      </AnimatePresence>

      {/* Input handle */}
      {type !== 'start' && (
        <HandleDot type="target" position={Position.Left} color={color} />
      )}

      {/* Node header */}
      <div className="node-header">
        <motion.div
          className="node-icon-wrap"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
          animate={status === 'running' ? {
            boxShadow: [`0 0 0px ${color}00`, `0 0 12px ${color}80`, `0 0 0px ${color}00`],
          } : {}}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        >
          <Icon size={14} color={color} />
        </motion.div>

        <div className="node-label">{label || typeLabel}</div>
      </div>

      {/* Badges row */}
      {(modelBadge || toolBadge) && (
        <div className="node-badge-row">
          {modelBadge && (
            <span className="badge badge-primary">{modelBadge}</span>
          )}
          {toolBadge && (
            <span className="badge badge-cyan">{String(toolBadge).slice(0, 12)}</span>
          )}
        </div>
      )}

      {/* Type label at bottom */}
      <div className="node-type-label">{typeLabel}</div>

      {/* LLM Specialized port section */}
      {isLLM && (
        <div className="node-ports">
          {/* Model port */}
          <div className="node-port-col">
            <span className="node-port-label" style={{ color: '#818cf8' }}>MOD</span>
            <Handle
              type="source"
              position={Position.Bottom}
              id="model"
              style={{ bottom: -12, background: '#6366f1', width: 7, height: 7, border: '2px solid #111113' }}
            />
          </div>

          {/* Memory port */}
          <div className="node-port-col">
            <span className="node-port-label" style={{ color: '#34d399' }}>MEM</span>
            <Handle
              type="source"
              position={Position.Bottom}
              id="memory"
              style={{ bottom: -12, background: '#10b981', width: 7, height: 7, border: '2px solid #111113' }}
            />
          </div>

          {/* Tools port */}
          <div className="node-port-col">
            <span className="node-port-label" style={{ color: '#22d3ee' }}>TOOLS</span>
            <div style={{
              position: 'absolute', bottom: -22, left: '50%', transform: 'translateX(-50%)',
              background: '#1c1c21', borderRadius: '50%', width: 12, height: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid #27272a', zIndex: 11
            }}>
              <Plus size={7} color="#06b6d4" />
            </div>
            <Handle
              type="source"
              position={Position.Bottom}
              id="tools"
              style={{ bottom: -12, background: '#06b6d4', width: 7, height: 7, border: '2px solid #111113' }}
            />
          </div>
        </div>
      )}

      {/* Output handle */}
      {type !== 'end' && (
        <HandleDot type="source" position={Position.Right} color={color} />
      )}
    </motion.div>
  );
};

export default CustomBuildNode;
