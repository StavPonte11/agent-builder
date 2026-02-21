import type { ThemeConfig } from 'antd';

export const theme: ThemeConfig = {
    token: {
        colorPrimary: '#1890ff',
        colorSuccess: '#52c41a',
        colorWarning: '#faad14',
        colorError: '#ff4d4f',
        colorInfo: '#1890ff',
        borderRadius: 8,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        fontSize: 14,
        wireframe: false,
    },
    components: {
        Layout: {
            bodyBg: '#f0f2f5',
            headerBg: '#ffffff',
            siderBg: '#ffffff',
        },
        Card: {
            borderRadiusLG: 12,
            boxShadowTertiary: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
        },
        Button: {
            borderRadius: 6,
            controlHeight: 36,
        },
        Input: {
            borderRadius: 6,
            controlHeight: 36,
        },
        Select: {
            borderRadius: 6,
            controlHeight: 36,
        },
    },
};
