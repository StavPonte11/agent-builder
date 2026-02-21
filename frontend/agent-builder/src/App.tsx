/**
 * App.tsx — Main layout with premium dark UI
 * Framer Motion sidebar, i18n RTL support, animated routing
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ConfigProvider, theme as antTheme } from 'antd';
import { useTranslation } from 'react-i18next';
import '../src/i18n/i18n';

import BuildCanvas from './components/BuildCanvas';
import SandboxChat from './components/SandboxChat';
import TestBuilder from './components/TestBuilder';
import ApprovalDashboard from './components/ApprovalDashboard';
import ExerciseDashboard from './components/ExerciseDashboard';
import TemplateManager from './components/TemplateManager';
import SkillManager from './components/SkillManager';
import { ChatPage } from './components/chatpage/ChatPage';
import { isRTL } from './i18n/i18n';


// ── Icons ──────────────────────────────────────────────────────────
import {
  LayoutGrid, MessageSquare, FlaskConical, ShieldCheck,
  Globe, Sun, Moon, ChevronLeft, ChevronRight,
  Cpu, Zap, Settings, PlusCircle, FileText, Sparkles
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────
const CURRENT_BUILD_ID = '67de047a-4ee0-4383-8066-5bef776a5422';
const USER_ID = 'user_default';

const antDarkTheme = {
  algorithm: antTheme.darkAlgorithm,
  token: {
    colorBgBase: '#111113',
    colorBgContainer: '#18181b',
    colorBgElevated: '#1c1c21',
    colorBorder: '#27272a',
    colorText: '#fafafa',
    colorTextSecondary: '#a1a1aa',
    colorPrimary: '#6366f1',
    borderRadius: 8,
    fontFamily: "'Inter', sans-serif",
  },
  components: {
    Select: { colorBgContainer: '#18181b' },
    Input: { colorBgContainer: '#18181b' },
    InputNumber: { colorBgContainer: '#18181b' },
  },
};

// ── Nav Definition ─────────────────────────────────────────────────
interface NavItem {
  key: string;
  path: string;
  icon: React.ReactNode;
  labelKey: string;
  badge?: number;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'build', path: '/', icon: <LayoutGrid size={15} />, labelKey: 'nav.build' },
  { key: 'chat', path: '/chat', icon: <MessageSquare size={15} />, labelKey: 'nav.chat' },
  { key: 'sandbox', path: '/sandbox', icon: <Cpu size={15} />, labelKey: 'nav.sandbox' },
  { key: 'tests', path: '/testing', icon: <FlaskConical size={15} />, labelKey: 'nav.tests' },
  { key: 'exercises', path: '/exercises', icon: <Zap size={15} />, labelKey: 'nav.exercises', badge: 2 },
  { key: 'templates', path: '/templates', icon: <FileText size={15} />, labelKey: 'nav.templates' },
  { key: 'skills', path: '/skills', icon: <Sparkles size={15} />, labelKey: 'nav.skills' },
  { key: 'approvals', path: '/approvals', icon: <ShieldCheck size={15} />, labelKey: 'nav.approvals', adminOnly: true },
];

// ── Animated Page Wrapper ──────────────────────────────────────────
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2, ease: 'easeOut' }}
    style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}
  >
    {children}
  </motion.div>
);

// ── Sidebar ────────────────────────────────────────────────────────
interface SidebarProps {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  lang: string;
  onLangToggle: () => void;
  darkMode: boolean;
  onThemeToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onCollapse, lang, onLangToggle, darkMode, onThemeToggle }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const activeKey = NAV_ITEMS.find(n => n.path === location.pathname)?.key ?? 'build';

  return (
    <motion.aside
      className="sidebar"
      animate={{ width: collapsed ? 60 : 220 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      style={{ overflow: 'hidden', flexShrink: 0 }}
    >
      {/* Logo */}
      <div className="sidebar-header" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <div className="logo-mark">⚡</div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="logo-text">{t('app.title')}</div>
              <div className="logo-sub">v2.0 Pro</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {!collapsed && <div className="nav-section-label">Workspace</div>}
        {NAV_ITEMS.filter(n => !n.adminOnly).map(item => (
          <NavRow
            key={item.key}
            item={item}
            active={activeKey === item.key}
            collapsed={collapsed}
            onClick={() => navigate(item.path)}
            t={t}
          />
        ))}

        {!collapsed && <div className="nav-section-label" style={{ marginTop: 12 }}>Admin</div>}
        {NAV_ITEMS.filter(n => n.adminOnly).map(item => (
          <NavRow
            key={item.key}
            item={item}
            active={activeKey === item.key}
            collapsed={collapsed}
            onClick={() => navigate(item.path)}
            t={t}
          />
        ))}
      </nav>

      {/* Footer controls */}
      <div className="sidebar-footer">
        <button
          className="nav-item"
          onClick={onLangToggle}
          title="Toggle language"
          style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
        >
          <Globe size={14} className="nav-icon" />
          {!collapsed && (
            <span style={{ fontSize: 12 }}>{lang === 'en' ? 'עברית' : 'English'}</span>
          )}
        </button>

        <button
          className="nav-item"
          onClick={onThemeToggle}
          title="Toggle theme"
          style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
        >
          {darkMode ? <Sun size={14} className="nav-icon" /> : <Moon size={14} className="nav-icon" />}
          {!collapsed && <span style={{ fontSize: 12 }}>{darkMode ? 'Light' : 'Dark'}</span>}
        </button>

        {/* Collapse toggle */}
        <button
          className="nav-item"
          onClick={() => onCollapse(!collapsed)}
          style={{ justifyContent: collapsed ? 'center' : 'flex-start', marginTop: 4 }}
        >
          {collapsed
            ? <ChevronRight size={14} />
            : <><ChevronLeft size={14} /><span style={{ fontSize: 12 }}>Collapse</span></>
          }
        </button>
      </div>
    </motion.aside>
  );
};

interface NavRowProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  t: (key: string) => string;
}

const NavRow: React.FC<NavRowProps> = ({ item, active, collapsed, onClick, t }) => (
  <motion.button
    className={`nav-item ${active ? 'active' : ''}`}
    onClick={onClick}
    whileHover={{ x: 2 }}
    whileTap={{ scale: 0.97 }}
    style={{ width: '100%', background: 'none', border: active ? undefined : '1px solid transparent', justifyContent: collapsed ? 'center' : 'flex-start' }}
    title={collapsed ? t(item.labelKey) : undefined}
  >
    <span className="nav-icon">{item.icon}</span>
    <AnimatePresence>
      {!collapsed && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{ flex: 1, textAlign: 'start' }}
        >
          {t(item.labelKey)}
        </motion.span>
      )}
    </AnimatePresence>
    {!collapsed && item.badge && (
      <span className="nav-badge">{item.badge}</span>
    )}
  </motion.button>
);

// ── Topbar ─────────────────────────────────────────────────────────
const Topbar: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const current = NAV_ITEMS.find(n => n.path === location.pathname);

  return (
    <header className="topbar">
      <span className="topbar-title">{current ? t(current.labelKey) : 'Agent Studio'}</span>

      <div className="topbar-actions">
        <motion.button
          className="btn btn-primary btn-sm"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <PlusCircle size={13} />
          New Agent
        </motion.button>

        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

        <button className="btn btn-ghost btn-icon" title="Settings">
          <Settings size={15} />
        </button>
        <button className="btn btn-ghost btn-icon" title="Profile">
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700
          }}>A</div>
        </button>
      </div>
    </header>
  );
};

// ── Main App ───────────────────────────────────────────────────────
const AppShell: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('he') ? 'he' : 'en';
  const dir = isRTL(lang) ? 'rtl' : 'ltr';
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [dir, lang, darkMode]);

  const handleLangToggle = () => {
    i18n.changeLanguage(lang === 'en' ? 'he' : 'en');
  };

  return (
    <ConfigProvider theme={darkMode ? antDarkTheme : { token: { colorPrimary: '#6366f1', borderRadius: 8 } }}>
      <div className="app-layout" dir={dir}>
        <Sidebar
          collapsed={collapsed}
          onCollapse={setCollapsed}
          lang={lang}
          onLangToggle={handleLangToggle}
          darkMode={darkMode}
          onThemeToggle={() => setDarkMode(!darkMode)}
        />

        <div className="main-content">
          <Topbar />

          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={
                  <PageTransition>
                    <BuildCanvas initialBlueprintId={CURRENT_BUILD_ID} />
                  </PageTransition>
                } />
                <Route path="/chat" element={
                  <PageTransition><ChatPage /></PageTransition>
                } />
                <Route path="/sandbox" element={
                  <PageTransition>
                    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
                      <SandboxChat buildId={CURRENT_BUILD_ID} userId={USER_ID} />
                    </div>
                  </PageTransition>
                } />
                <Route path="/testing" element={
                  <PageTransition>
                    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
                      <TestBuilder buildId={CURRENT_BUILD_ID} userId={USER_ID} />
                    </div>
                  </PageTransition>
                } />
                <Route path="/approvals" element={
                  <PageTransition>
                    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
                      <ApprovalDashboard adminId={USER_ID} />
                    </div>
                  </PageTransition>
                } />
                <Route path="/exercises" element={
                  <PageTransition>
                    <ExerciseDashboard />
                  </PageTransition>
                } />
                <Route path="/templates" element={
                  <PageTransition>
                    <TemplateManager />
                  </PageTransition>
                } />
                <Route path="/skills" element={
                  <PageTransition>
                    <SkillManager />
                  </PageTransition>
                } />
              </Routes>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

// ── Root Export ────────────────────────────────────────────────────
const App: React.FC = () => (
  <Router>
    <AppShell />
  </Router>
);

export default App;