// ==UserScript==
// @name         iMini 账号切换器 v4
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  快速切换 imini.com 账号 - 支持单删/批量删/全删与低饱和界面
// @author       You
// @match        https://imini.com/*
// @match        https://*.imini.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 账号数据管理 ====================

    function getAccounts() {
        return GM_getValue('accounts', []);
    }

    function saveAccounts(accounts) {
        GM_setValue('accounts', accounts);
    }

    function importAccounts(jsonData) {
        try {
            let accounts = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            if (!Array.isArray(accounts)) {
                throw new Error('数据格式错误：需要JSON数组');
            }
            // 验证必要字段
            const validAccounts = accounts.filter(acc => acc.userId && acc.token && acc.mail);
            if (validAccounts.length === 0) {
                throw new Error('没有找到有效账号（需要userId, token, mail字段）');
            }
            // 合并或替换
            const existing = getAccounts();
            const existingIds = new Set(existing.map(a => a.userId));
            let newCount = 0;
            validAccounts.forEach(acc => {
                if (!existingIds.has(acc.userId)) {
                    existing.push(acc);
                    newCount++;
                }
            });
            saveAccounts(existing);
            return { total: validAccounts.length, new: newCount };
        } catch (e) {
            throw new Error('导入失败: ' + e.message);
        }
    }

    function clearAllAccounts() {
        saveAccounts([]);
        saveUsedAccounts([]);
    }

    function exportAccounts() {
        const accounts = getAccounts();
        return JSON.stringify(accounts, null, 2);
    }

    function removeUsedAccount(userId) {
        const usedList = getUsedAccounts();
        const nextUsed = usedList.filter(id => id !== userId);
        saveUsedAccounts(nextUsed);
    }

    function deleteAccount(userId) {
        const accounts = getAccounts();
        const target = accounts.find(acc => acc.userId === userId);
        if (!target) {
            return { deleted: false, currentDeleted: false };
        }

        const result = deleteAccounts([userId]);
        return { deleted: result.deleted > 0, currentDeleted: result.currentDeleted, mail: target.mail };
    }

    function deleteAccounts(userIds) {
        const ids = Array.from(new Set((userIds || []).filter(Boolean)));
        if (ids.length === 0) {
            return { deleted: 0, currentDeleted: false };
        }

        const idSet = new Set(ids);
        const accounts = getAccounts();
        const nextAccounts = accounts.filter(acc => !idSet.has(acc.userId));
        const deletedCount = accounts.length - nextAccounts.length;

        if (deletedCount === 0) {
            return { deleted: 0, currentDeleted: false };
        }

        saveAccounts(nextAccounts);
        saveUsedAccounts(getUsedAccounts().filter(id => !idSet.has(id)));

        const currentId = getCurrentAccount();
        const currentDeleted = !!currentId && idSet.has(currentId);
        if (currentDeleted) {
            localStorage.removeItem('_gcl_ls');
            localStorage.removeItem('user-storage');
        }

        return { deleted: deletedCount, currentDeleted };
    }

    // ==================== 已使用账号管理 ====================

    function getUsedAccounts() {
        return GM_getValue('usedAccounts', []);
    }

    function saveUsedAccounts(usedList) {
        GM_setValue('usedAccounts', usedList);
    }

    function markAccountUsed(userId) {
        const usedList = getUsedAccounts();
        if (!usedList.includes(userId)) {
            usedList.push(userId);
            saveUsedAccounts(usedList);
        }
    }

    function isAccountUsed(userId) {
        const usedList = getUsedAccounts();
        return usedList.includes(userId);
    }

    // ==================== 当前账号 ====================

    function getCurrentAccount() {
        try {
            const data = JSON.parse(localStorage.getItem('user-storage') || '{}');
            return data?.state?.user?.userId || null;
        } catch {
            return null;
        }
    }

    function getCurrentMail() {
        try {
            const data = JSON.parse(localStorage.getItem('user-storage') || '{}');
            return data?.state?.user?.mail || '未登录';
        } catch {
            return '未登录';
        }
    }

    // ==================== 切换账号 ====================

    function switchToAccount(account) {
        const fullAccount = {
            userId: account.userId,
            providerId: "email",
            providerUid: null,
            mobile: "",
            mail: account.mail,
            nickname: account.nickname || account.mail.split('@')[0],
            avatar: null,
            token: account.token,
            timeZone: "Asia/Shanghai",
            theme: null,
            language: null,
            packageType: "free",
            plan: "Free",
            expiryTime: null,
            subscription: false,
            upgrade: true,
            creditsPack: false,
            isRegister: true,
            hasCreatedContent: false,
            firebaseUid: "",
            goodsType: null,
            goodsTypeName: null,
            creditsInfo: [],
            createTime: new Date().toISOString(),
            streakDays: null,
            surplusChatCount: 50,
            surplusOtherChatCount: 0,
            surplusNanoBananaCount: 1,
            aigcFreeTrialCount: 1,
            activity: {
                "nano-banana-2_activity_id": { activityId: "nano-banana-2_activity_id", count: 1, isAvailable: true, resetTime: null, description: null },
                "nano_banana_new_user_activity_id": { activityId: "nano_banana_new_user_activity_id", count: 1, isAvailable: true, resetTime: null, description: null },
                "sora2_new_user_activity_id": { activityId: "sora2_new_user_activity_id", count: 0, isAvailable: false, resetTime: null, description: null }
            }
        };

        const data = {
            state: {
                user: fullAccount,
                token: account.token,
                isLoggedIn: true,
                chatCount: 50,
                otherChatCount: 0,
                activity: {
                    "nano-banana-2_activity_id": { isAvailable: true, count: 1, resetTime: null },
                    "nano_banana_new_user_activity_id": { isAvailable: true, count: 1, resetTime: null },
                    "seedream4_banana_new_user_activity_id": { isAvailable: false, count: 0, resetTime: null },
                    "sora2_new_user_activity_id": { isAvailable: false, count: 0, resetTime: null }
                },
                creditsInfo: {}
            },
            version: 0
        };

        localStorage.setItem('_gcl_ls', JSON.stringify(data));
        localStorage.setItem('user-storage', JSON.stringify(data));

        markAccountUsed(account.userId);
        location.reload();
    }

    function switchToNextAvailable() {
        const ACCOUNTS = getAccounts();
        const available = ACCOUNTS.filter(acc => !isAccountUsed(acc.userId));
        if (available.length === 0) {
            showToast('所有账号都已用完！', 'error');
            return;
        }
        switchToAccount(available[0]);
    }

    function resetAllUsage() {
        if (confirm('确定要重置所有使用记录吗？\n所有已报废的账号将恢复为"可用"状态')) {
            saveUsedAccounts([]);
            location.reload();
        }
    }

    // ==================== Toast 提示 ====================

    function showToast(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            background: ${type === 'error' ? '#e74c3c' : type === 'warning' ? '#f39c12' : '#2ecc71'};
            color: white;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 2147483647;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // ==================== UI 创建 ====================

    function createUI() {
        const ACCOUNTS = getAccounts();
        const currentUserId = getCurrentAccount();
        const currentMail = getCurrentMail();
        const availableCount = ACCOUNTS.filter(acc => !isAccountUsed(acc.userId)).length;
        const usedCount = ACCOUNTS.length - availableCount;
        let batchMode = false;
        const selectedAccountIds = new Set();

        // 样式
        const style = document.createElement('style');
        style.textContent = `
            #imini-btn {
                position: fixed !important;
                bottom: 120px !important;
                right: 24px !important;
                width: 56px !important;
                height: 56px !important;
                border-radius: 50% !important;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                border: none !important;
                cursor: pointer !important;
                z-index: 2147483647 !important;
                box-shadow: 0 4px 20px rgba(102, 126, 234, 0.5) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: all 0.3s ease !important;
                font-family: -apple-system, sans-serif !important;
            }
            #imini-btn:hover {
                transform: scale(1.1) !important;
            }
            #imini-btn .badge {
                position: absolute;
                top: -5px;
                right: -5px;
                background: #2ecc71;
                color: white;
                font-size: 12px;
                font-weight: bold;
                min-width: 22px;
                height: 22px;
                border-radius: 11px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            #imini-btn svg {
                width: 26px;
                height: 26px;
                fill: white;
            }
            #imini-overlay {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                background: rgba(0,0,0,0.6) !important;
                z-index: 2147483646 !important;
                opacity: 0 !important;
                visibility: hidden !important;
                transition: all 0.3s !important;
            }
            #imini-overlay.show {
                opacity: 1 !important;
                visibility: visible !important;
            }
            #imini-panel {
                position: fixed !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) scale(0.9) !important;
                width: 450px !important;
                max-width: 90vw !important;
                max-height: 85vh !important;
                background: #1a1a2e !important;
                border-radius: 16px !important;
                box-shadow: 0 25px 80px rgba(0,0,0,0.6) !important;
                z-index: 2147483647 !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
                color: #fff !important;
                opacity: 0 !important;
                visibility: hidden !important;
                transition: all 0.3s !important;
                overflow: hidden !important;
                display: flex !important;
                flex-direction: column !important;
            }
            #imini-panel.show {
                opacity: 1 !important;
                visibility: visible !important;
                transform: translate(-50%, -50%) scale(1) !important;
            }
            .imini-header {
                padding: 18px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            }
            .imini-header h3 {
                margin: 0;
                font-size: 17px;
                font-weight: 600;
            }
            .imini-close {
                width: 30px;
                height: 30px;
                border-radius: 50%;
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                font-size: 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .imini-close:hover {
                background: rgba(255,255,255,0.3);
            }
            .imini-current {
                padding: 14px 20px;
                background: rgba(102, 126, 234, 0.15);
                border-bottom: 1px solid rgba(255,255,255,0.05);
                flex-shrink: 0;
            }
            .imini-current small {
                color: #888;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .imini-current p {
                margin: 4px 0 0;
                font-size: 13px;
                word-break: break-all;
            }
            .imini-stats {
                display: flex;
                gap: 10px;
                padding: 14px 20px;
                border-bottom: 1px solid rgba(255,255,255,0.05);
                flex-shrink: 0;
            }
            .imini-stat {
                flex: 1;
                text-align: center;
                padding: 10px;
                background: rgba(255,255,255,0.05);
                border-radius: 10px;
            }
            .imini-stat-num {
                font-size: 22px;
                font-weight: 700;
            }
            .imini-stat-num.green { color: #2ecc71; }
            .imini-stat-num.red { color: #e74c3c; }
            .imini-stat-num.blue { color: #3498db; }
            .imini-stat-label {
                font-size: 10px;
                color: #888;
                margin-top: 2px;
            }
            .imini-actions {
                display: flex;
                gap: 10px;
                padding: 14px 20px;
                flex-shrink: 0;
                flex-wrap: wrap;
            }
            .imini-btn {
                flex: 1;
                padding: 11px;
                border: none;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                min-width: 100px;
            }
            .imini-btn-green {
                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                color: white;
            }
            .imini-btn-blue {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            .imini-btn-orange {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
            }
            .imini-btn-gray {
                background: rgba(255,255,255,0.1);
                color: #aaa;
            }
            .imini-btn-gray:hover {
                background: rgba(255,255,255,0.15);
                color: #fff;
            }
            .imini-tabs {
                display: flex;
                padding: 0 20px 14px;
                gap: 8px;
                flex-shrink: 0;
            }
            .imini-tab {
                flex: 1;
                padding: 8px;
                background: rgba(255,255,255,0.05);
                border: none;
                border-radius: 6px;
                color: #888;
                font-size: 12px;
                cursor: pointer;
            }
            .imini-tab.active {
                background: rgba(102, 126, 234, 0.3);
                color: #fff;
            }
            .imini-list {
                flex: 1;
                overflow-y: auto;
                padding: 0 12px 12px;
                min-height: 150px;
                max-height: 250px;
            }
            .imini-list::-webkit-scrollbar {
                width: 6px;
            }
            .imini-list::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.2);
                border-radius: 3px;
            }
            .imini-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 12px;
                margin: 5px 0;
                background: rgba(255,255,255,0.03);
                border-radius: 8px;
                cursor: pointer;
                border: 1px solid transparent;
                transition: all 0.2s;
            }
            .imini-item:hover {
                background: rgba(255,255,255,0.08);
            }
            .imini-item.used {
                opacity: 0.5;
            }
            .imini-item.current {
                background: rgba(102, 126, 234, 0.2);
                border-color: rgba(102, 126, 234, 0.4);
            }
            .imini-item-left {
                display: flex;
                align-items: center;
                gap: 10px;
                overflow: hidden;
            }
            .imini-item-idx {
                width: 26px;
                height: 26px;
                background: rgba(255,255,255,0.1);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                color: #aaa;
                flex-shrink: 0;
            }
            .imini-item.current .imini-item-idx {
                background: #667eea;
                color: white;
            }
            .imini-item-info {
                overflow: hidden;
            }
            .imini-item-mail {
                font-size: 12px;
                color: #ddd;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 230px;
            }
            .imini-item-date {
                font-size: 10px;
                color: #666;
                margin-top: 2px;
            }
            .imini-item-tag {
                font-size: 10px;
                padding: 3px 8px;
                border-radius: 10px;
                font-weight: 600;
                flex-shrink: 0;
            }
            .imini-item-tag.green {
                background: rgba(46, 204, 113, 0.2);
                color: #2ecc71;
            }
            .imini-item-tag.red {
                background: rgba(231, 76, 60, 0.2);
                color: #e74c3c;
            }
            .imini-item-tag.blue {
                background: rgba(52, 152, 219, 0.2);
                color: #3498db;
            }
            .imini-empty {
                text-align: center;
                color: #666;
                padding: 30px 20px;
            }
            .imini-empty p {
                margin: 10px 0;
                font-size: 13px;
            }
            /* 导入弹窗 */
            #imini-import-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.9);
                width: 500px;
                max-width: 90vw;
                max-height: 80vh;
                background: #1a1a2e;
                border-radius: 16px;
                box-shadow: 0 25px 80px rgba(0,0,0,0.6);
                z-index: 2147483648;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            #imini-import-modal.show {
                opacity: 1;
                visibility: visible;
                transform: translate(-50%, -50%) scale(1);
            }
            .imini-import-header {
                padding: 16px 20px;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .imini-import-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: white;
            }
            .imini-import-body {
                padding: 20px;
                flex: 1;
                overflow-y: auto;
            }
            .imini-import-body label {
                display: block;
                margin-bottom: 8px;
                font-size: 13px;
                color: #aaa;
            }
            .imini-import-body textarea {
                width: 100%;
                height: 200px;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px;
                color: #fff;
                font-family: monospace;
                font-size: 12px;
                padding: 12px;
                resize: vertical;
                box-sizing: border-box;
            }
            .imini-import-body textarea:focus {
                outline: none;
                border-color: rgba(102, 126, 234, 0.5);
            }
            .imini-import-tips {
                margin-top: 12px;
                padding: 10px;
                background: rgba(243, 156, 18, 0.1);
                border-radius: 6px;
                font-size: 11px;
                color: #f39c12;
            }
            .imini-import-footer {
                padding: 16px 20px;
                border-top: 1px solid rgba(255,255,255,0.05);
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            .imini-import-file {
                display: none;
            }
            .imini-import-file-btn {
                display: inline-block;
                padding: 8px 16px;
                background: rgba(255,255,255,0.1);
                border-radius: 6px;
                color: #aaa;
                font-size: 12px;
                cursor: pointer;
                margin-bottom: 12px;
            }
            .imini-import-file-btn:hover {
                background: rgba(255,255,255,0.15);
                color: #fff;
            }
            /* v4.1 低饱和主题 + 批量删除样式 */
            #imini-btn {
                background: #0f172a !important;
                border: 1px solid #334155 !important;
                box-shadow: 0 8px 22px rgba(2, 6, 23, 0.5) !important;
            }
            #imini-btn:hover {
                background: #111827 !important;
                transform: translateY(-1px) scale(1.03) !important;
            }
            #imini-btn .badge {
                background: #0284c7;
            }
            #imini-overlay {
                background: rgba(2, 6, 23, 0.62) !important;
                backdrop-filter: none !important;
            }
            #imini-panel,
            #imini-import-modal {
                width: 500px !important;
                border-radius: 14px !important;
                border: 1px solid #334155 !important;
                background: #0b1220 !important;
                box-shadow: 0 24px 60px rgba(2, 6, 23, 0.7) !important;
                backdrop-filter: none !important;
            }
            .imini-header,
            .imini-import-header {
                background: #111827 !important;
                box-shadow: inset 0 -1px 0 rgba(148, 163, 184, 0.2);
            }
            .imini-current {
                background: rgba(30, 41, 59, 0.55);
                border-bottom-color: rgba(148, 163, 184, 0.14);
            }
            .imini-stats,
            .imini-import-footer {
                border-bottom-color: rgba(148, 163, 184, 0.14);
                border-top-color: rgba(148, 163, 184, 0.14);
            }
            .imini-stat {
                background: #121a2b;
                border: 1px solid rgba(148, 163, 184, 0.16);
            }
            .imini-stat-num.green { color: #38bdf8; }
            .imini-stat-num.red { color: #f87171; }
            .imini-stat-num.blue { color: #93c5fd; }
            .imini-btn {
                border: 1px solid rgba(148, 163, 184, 0.28);
                box-shadow: none;
                transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
            }
            .imini-btn:hover {
                transform: translateY(-1px);
            }
            .imini-btn-green {
                background: #2563eb;
            }
            .imini-btn-green:hover {
                background: #1d4ed8;
            }
            .imini-btn-blue {
                background: #334155;
            }
            .imini-btn-blue:hover {
                background: #3f4f67;
            }
            .imini-btn-orange {
                background: #0284c7;
            }
            .imini-btn-orange:hover {
                background: #0369a1;
            }
            .imini-btn-gray {
                background: #1f2937;
                color: #cbd5e1;
            }
            .imini-btn-gray:hover {
                background: #263244;
                color: #e2e8f0;
            }
            .imini-btn-danger {
                background: #b91c1c;
                color: #fff;
            }
            .imini-btn-danger:hover {
                background: #991b1b;
            }
            .imini-tab {
                border: 1px solid rgba(148, 163, 184, 0.2);
                background: #111827;
                color: #94a3b8;
                transition: all 0.2s ease;
            }
            .imini-tab:hover {
                color: #e2e8f0;
                background: #172033;
            }
            .imini-tab.active {
                background: #1e293b;
                color: #e2e8f0;
                border-color: #475569;
            }
            .imini-list {
                padding-top: 4px;
            }
            .imini-item {
                gap: 10px;
                padding: 12px;
                border-radius: 10px;
                border: 1px solid rgba(148, 163, 184, 0.18);
                background: #111827;
            }
            .imini-item:hover {
                background: #182235;
                border-color: #3b4c66;
            }
            .imini-item.current {
                background: #1d2b42;
                border-color: #3f5b84;
            }
            .imini-item.used {
                opacity: 0.72;
            }
            .imini-item-idx {
                background: #1f2937;
                color: #94a3b8;
            }
            .imini-item-mail {
                color: #e2e8f0;
            }
            .imini-item-date {
                color: #94a3b8;
            }
            .imini-item-right {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-left: 10px;
                flex-shrink: 0;
            }
            .imini-item-actions {
                display: flex;
                gap: 6px;
            }
            .imini-item-action {
                border: 1px solid rgba(148, 163, 184, 0.28);
                border-radius: 6px;
                padding: 4px 10px;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                color: #fff;
                transition: all 0.2s ease;
                background: #334155;
            }
            .imini-item-action.switch {
                background: #2563eb;
            }
            .imini-item-action.delete {
                background: #b91c1c;
            }
            .imini-item-action:hover {
                filter: brightness(1.05);
                transform: translateY(-1px);
            }
            .imini-item-tag.green {
                background: rgba(14, 116, 144, 0.2);
                color: #67e8f9;
            }
            .imini-item-tag.red {
                background: rgba(153, 27, 27, 0.2);
                color: #fca5a5;
            }
            .imini-item-tag.blue {
                background: rgba(37, 99, 235, 0.2);
                color: #93c5fd;
            }
            .imini-import-file-btn {
                background: #1f2937;
                color: #cbd5e1;
                border: 1px solid rgba(148, 163, 184, 0.25);
            }
            .imini-import-file-btn:hover {
                background: #263244;
                color: #e2e8f0;
            }
            .imini-import-body textarea {
                background: #111827;
                border-color: rgba(148, 163, 184, 0.25);
            }
            .imini-import-body textarea:focus {
                border-color: #3b82f6;
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
            }
            .imini-batch-bar {
                display: none;
                align-items: center;
                gap: 8px;
                padding: 0 20px 12px;
                flex-wrap: wrap;
            }
            .imini-batch-bar.show {
                display: flex;
            }
            .imini-batch-count {
                font-size: 12px;
                color: #cbd5e1;
                margin-right: auto;
            }
            .imini-btn-mini {
                padding: 6px 10px;
                font-size: 11px;
                border: 1px solid rgba(148, 163, 184, 0.3);
                border-radius: 6px;
                background: #1f2937;
                color: #e2e8f0;
                cursor: pointer;
            }
            .imini-btn-mini:hover {
                background: #263244;
            }
            .imini-btn-mini.danger {
                background: #7f1d1d;
                border-color: #b91c1c;
                color: #fecaca;
            }
            .imini-btn-mini.danger:hover {
                background: #991b1b;
            }
            .imini-btn-mini:disabled {
                opacity: 0.45;
                cursor: not-allowed;
            }
            .imini-check-wrap {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 18px;
                height: 18px;
                margin-right: 2px;
            }
            .imini-item-check {
                width: 14px;
                height: 14px;
                accent-color: #3b82f6;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);

        // 遮罩
        const overlay = document.createElement('div');
        overlay.id = 'imini-overlay';
        document.body.appendChild(overlay);

        // 按钮
        const btn = document.createElement('button');
        btn.id = 'imini-btn';
        btn.innerHTML = `
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
            <span class="badge" id="imini-badge">${availableCount}</span>
        `;
        document.body.appendChild(btn);

        // 主面板
        const panel = document.createElement('div');
        panel.id = 'imini-panel';
        panel.innerHTML = `
            <div class="imini-header">
                <h3>🔄 账号切换器 v4</h3>
                <button class="imini-close" id="imini-close">✕</button>
            </div>
            <div class="imini-current">
                <small>当前账号</small>
                <p id="imini-current-mail">${currentMail}</p>
            </div>
            <div class="imini-stats">
                <div class="imini-stat">
                    <div class="imini-stat-num green" id="stat-available">${availableCount}</div>
                    <div class="imini-stat-label">可用</div>
                </div>
                <div class="imini-stat">
                    <div class="imini-stat-num red" id="stat-used">${usedCount}</div>
                    <div class="imini-stat-label">已报废</div>
                </div>
                <div class="imini-stat">
                    <div class="imini-stat-num blue" id="stat-total">${ACCOUNTS.length}</div>
                    <div class="imini-stat-label">总计</div>
                </div>
            </div>
            <div class="imini-actions">
                <button class="imini-btn imini-btn-green" id="imini-next">⚡ 切换下一个</button>
                <button class="imini-btn imini-btn-blue" id="imini-import-btn">📥 导入</button>
                <button class="imini-btn imini-btn-gray" id="imini-export-btn">📤 导出</button>
                <button class="imini-btn imini-btn-gray" id="imini-reset">🔄 重置报废</button>
                <button class="imini-btn imini-btn-gray" id="imini-batch-toggle">🧩 批量删除</button>
                <button class="imini-btn imini-btn-danger" id="imini-delete-all">🗑️ 删除全部</button>
            </div>
            <div class="imini-tabs">
                <button class="imini-tab active" data-filter="all">全部 (<span id="tab-all">${ACCOUNTS.length}</span>)</button>
                <button class="imini-tab" data-filter="available">可用 (<span id="tab-available">${availableCount}</span>)</button>
                <button class="imini-tab" data-filter="used">已报废 (<span id="tab-used">${usedCount}</span>)</button>
            </div>
            <div class="imini-batch-bar" id="imini-batch-bar">
                <span class="imini-batch-count" id="imini-selected-count">已选 0 项</span>
                <button class="imini-btn-mini" id="imini-select-visible">全选当前</button>
                <button class="imini-btn-mini danger" id="imini-delete-selected">删除选中</button>
                <button class="imini-btn-mini" id="imini-cancel-batch">退出</button>
            </div>
            <div class="imini-list" id="imini-list"></div>
        `;
        document.body.appendChild(panel);

        // 导入弹窗
        const importModal = document.createElement('div');
        importModal.id = 'imini-import-modal';
        importModal.innerHTML = `
            <div class="imini-import-header">
                <h3>📥 导入账号</h3>
                <button class="imini-close" id="imini-import-close">✕</button>
            </div>
            <div class="imini-import-body">
                <label class="imini-import-file-btn" for="imini-file-input">📁 选择JSON文件</label>
                <input type="file" id="imini-file-input" class="imini-import-file" accept=".json">
                <label>或粘贴 JSON 数据：</label>
                <textarea id="imini-import-text" placeholder='[{"userId":"xxx","mail":"xxx@xxx.com","token":"xxx"}, ...]'></textarea>
                <div class="imini-import-tips">
                    💡 提示：JSON 格式需要包含 userId、mail、token 字段。导入时会自动跳过已存在的账号。
                </div>
            </div>
            <div class="imini-import-footer">
                <button class="imini-btn imini-btn-gray" id="imini-clear-all">🗑️ 清空所有</button>
                <button class="imini-btn imini-btn-orange" id="imini-import-confirm">确认导入</button>
            </div>
        `;
        document.body.appendChild(importModal);

        // 渲染列表
        function getFilteredAccounts(filter = 'all') {
            const accounts = getAccounts();
            if (filter === 'available') return accounts.filter(acc => !isAccountUsed(acc.userId));
            if (filter === 'used') return accounts.filter(acc => isAccountUsed(acc.userId));
            return accounts;
        }

        function syncSelectionWithAccounts() {
            const existingIds = new Set(getAccounts().map(acc => acc.userId));
            Array.from(selectedAccountIds).forEach(id => {
                if (!existingIds.has(id)) {
                    selectedAccountIds.delete(id);
                }
            });
        }

        function getActiveFilter() {
            return panel.querySelector('.imini-tab.active')?.dataset.filter || 'all';
        }

        function updateBatchBar() {
            const batchBar = document.getElementById('imini-batch-bar');
            if (!batchBar) return;

            syncSelectionWithAccounts();
            batchBar.classList.toggle('show', batchMode);
            document.getElementById('imini-selected-count').textContent = `已选 ${selectedAccountIds.size} 项`;

            const visibleIds = getFilteredAccounts(getActiveFilter()).map(acc => acc.userId);
            const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedAccountIds.has(id));
            document.getElementById('imini-select-visible').textContent = allVisibleSelected ? '取消全选当前' : '全选当前';
            document.getElementById('imini-delete-selected').disabled = selectedAccountIds.size === 0;
        }

        function setBatchMode(enabled) {
            batchMode = !!enabled;
            if (!batchMode) selectedAccountIds.clear();
            document.getElementById('imini-batch-toggle').textContent = batchMode ? '✅ 完成批量' : '🧩 批量删除';
            updateBatchBar();
        }

        function renderList(filter = 'all') {
            const allAccounts = getAccounts();
            const filteredAccounts = getFilteredAccounts(filter);
            const currentUserId = getCurrentAccount();
            const list = document.getElementById('imini-list');
            list.innerHTML = '';

            if (allAccounts.length === 0) {
                list.innerHTML = `
                    <div class="imini-empty">
                        <p>📭 暂无账号</p>
                        <p>点击上方"导入"按钮添加账号</p>
                    </div>
                `;
                updateBatchBar();
                return;
            }

            filteredAccounts.forEach((acc, i) => {
                const used = isAccountUsed(acc.userId);
                const isCurrent = acc.userId === currentUserId;
                const canSwitch = !isCurrent && !used && !batchMode;
                const checked = selectedAccountIds.has(acc.userId) ? 'checked' : '';

                const item = document.createElement('div');
                item.className = `imini-item ${used ? 'used' : ''} ${isCurrent ? 'current' : ''}`;

                let tagText = '可用', tagClass = 'green';
                if (isCurrent) { tagText = '当前'; tagClass = 'blue'; }
                else if (used) { tagText = '已报废'; tagClass = 'red'; }

                const checkboxHtml = batchMode
                    ? `<label class="imini-check-wrap"><input class="imini-item-check" type="checkbox" data-user-id="${acc.userId}" ${checked}></label>`
                    : '';

                const rightHtml = batchMode
                    ? `<div class="imini-item-right"><span class="imini-item-tag ${tagClass}">${tagText}</span></div>`
                    : `
                        <div class="imini-item-right">
                            <span class="imini-item-tag ${tagClass}">${tagText}</span>
                            <div class="imini-item-actions">
                                ${canSwitch ? '<button class="imini-item-action switch" data-action="switch">切换</button>' : ''}
                                <button class="imini-item-action delete" data-action="delete">删除</button>
                            </div>
                        </div>
                    `;

                item.innerHTML = `
                    <div class="imini-item-left">
                        ${checkboxHtml}
                        <div class="imini-item-idx">${i + 1}</div>
                        <div class="imini-item-info">
                            <div class="imini-item-mail" title="${acc.mail}">${acc.mail}</div>
                            <div class="imini-item-date">${used ? '已报废' : '未使用'}</div>
                        </div>
                    </div>
                    ${rightHtml}
                `;

                if (batchMode) {
                    item.onclick = () => {
                        if (selectedAccountIds.has(acc.userId)) selectedAccountIds.delete(acc.userId);
                        else selectedAccountIds.add(acc.userId);
                        renderList(getActiveFilter());
                    };
                    const checkbox = item.querySelector('.imini-item-check');
                    checkbox.onclick = e => e.stopPropagation();
                    checkbox.onchange = (e) => {
                        if (e.target.checked) selectedAccountIds.add(acc.userId);
                        else selectedAccountIds.delete(acc.userId);
                        updateBatchBar();
                    };
                } else {
                    if (canSwitch) {
                        item.onclick = () => {
                            switchToAccount(acc);
                        };
                    }

                    const switchBtn = item.querySelector('[data-action="switch"]');
                    if (switchBtn) {
                        switchBtn.onclick = (e) => {
                            e.stopPropagation();
                            switchToAccount(acc);
                        };
                    }

                    const deleteBtn = item.querySelector('[data-action="delete"]');
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation();
                        const confirmText = isCurrent
                            ? `确定删除当前账号 ${acc.mail} 吗？\n删除后会退出并刷新页面。`
                            : `确定删除账号 ${acc.mail} 吗？`;
                        if (!confirm(confirmText)) return;

                        const result = deleteAccount(acc.userId);
                        if (!result.deleted) {
                            showToast('删除失败：账号不存在', 'error');
                            return;
                        }

                        selectedAccountIds.delete(acc.userId);
                        updateStats();
                        renderList(getActiveFilter());
                        showToast(`已删除账号：${acc.mail}`, 'warning');

                        if (result.currentDeleted) {
                            hidePanel();
                            setTimeout(() => location.reload(), 300);
                        }
                    };
                }

                list.appendChild(item);
            });

            if (list.children.length === 0) {
                list.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px;">当前筛选下暂无账号</div>';
            }

            updateBatchBar();
        }

        // 更新统计
        function updateStats() {
            const ACCOUNTS = getAccounts();
            const availableCount = ACCOUNTS.filter(acc => !isAccountUsed(acc.userId)).length;
            const usedCount = ACCOUNTS.length - availableCount;

            document.getElementById('stat-available').textContent = availableCount;
            document.getElementById('stat-used').textContent = usedCount;
            document.getElementById('stat-total').textContent = ACCOUNTS.length;
            document.getElementById('tab-all').textContent = ACCOUNTS.length;
            document.getElementById('tab-available').textContent = availableCount;
            document.getElementById('tab-used').textContent = usedCount;
            document.getElementById('imini-badge').textContent = availableCount;
            document.getElementById('imini-current-mail').textContent = getCurrentMail();
            updateBatchBar();
        }

        renderList();

        // 显示/隐藏主面板
        function showPanel() {
            panel.classList.add('show');
            overlay.classList.add('show');
        }
        function hidePanel() {
            panel.classList.remove('show');
            overlay.classList.remove('show');
        }

        // 显示/隐藏导入弹窗
        function showImportModal() {
            importModal.classList.add('show');
        }
        function hideImportModal() {
            importModal.classList.remove('show');
            document.getElementById('imini-import-text').value = '';
        }

        // 事件绑定
        btn.onclick = showPanel;
        overlay.onclick = () => {
            hidePanel();
            hideImportModal();
        };
        document.getElementById('imini-close').onclick = hidePanel;
        document.getElementById('imini-next').onclick = switchToNextAvailable;
        document.getElementById('imini-reset').onclick = resetAllUsage;
        document.getElementById('imini-batch-toggle').onclick = () => {
            setBatchMode(!batchMode);
            renderList(getActiveFilter());
        };
        document.getElementById('imini-cancel-batch').onclick = () => {
            setBatchMode(false);
            renderList(getActiveFilter());
        };
        document.getElementById('imini-select-visible').onclick = () => {
            const visibleIds = getFilteredAccounts(getActiveFilter()).map(acc => acc.userId);
            const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedAccountIds.has(id));

            if (allSelected) {
                visibleIds.forEach(id => selectedAccountIds.delete(id));
            } else {
                visibleIds.forEach(id => selectedAccountIds.add(id));
            }
            renderList(getActiveFilter());
        };
        document.getElementById('imini-delete-selected').onclick = () => {
            const ids = Array.from(selectedAccountIds);
            if (ids.length === 0) {
                showToast('请先勾选要删除的账号', 'warning');
                return;
            }

            const currentId = getCurrentAccount();
            const includesCurrent = !!currentId && ids.includes(currentId);
            const confirmText = includesCurrent
                ? `确定删除选中的 ${ids.length} 个账号吗？\n其中包含当前账号，删除后会退出并刷新页面。`
                : `确定删除选中的 ${ids.length} 个账号吗？`;
            if (!confirm(confirmText)) return;

            const result = deleteAccounts(ids);
            if (result.deleted === 0) {
                showToast('删除失败：没有匹配账号', 'error');
                return;
            }

            setBatchMode(false);
            updateStats();
            renderList(getActiveFilter());
            showToast(`已删除 ${result.deleted} 个账号`, 'warning');

            if (result.currentDeleted) {
                hidePanel();
                setTimeout(() => location.reload(), 300);
            }
        };
        document.getElementById('imini-delete-all').onclick = () => {
            const ids = getAccounts().map(acc => acc.userId);
            if (ids.length === 0) {
                showToast('暂无可删除账号', 'warning');
                return;
            }

            const currentId = getCurrentAccount();
            const includesCurrent = !!currentId && ids.includes(currentId);
            const confirmText = includesCurrent
                ? `确定删除全部 ${ids.length} 个账号吗？\n其中包含当前账号，删除后会退出并刷新页面。`
                : `确定删除全部 ${ids.length} 个账号吗？此操作不可恢复。`;
            if (!confirm(confirmText)) return;

            const result = deleteAccounts(ids);
            if (result.deleted === 0) {
                showToast('删除失败：没有匹配账号', 'error');
                return;
            }

            setBatchMode(false);
            hideImportModal();
            updateStats();
            renderList(getActiveFilter());
            showToast(`已删除全部账号（${result.deleted}）`, 'warning');

            if (result.currentDeleted) {
                hidePanel();
                setTimeout(() => location.reload(), 300);
            }
        };

        // 导入相关
        document.getElementById('imini-import-btn').onclick = showImportModal;
        document.getElementById('imini-import-close').onclick = hideImportModal;

        // 文件选择
        document.getElementById('imini-file-input').onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    document.getElementById('imini-import-text').value = ev.target.result;
                };
                reader.readAsText(file);
            }
        };

        // 确认导入
        document.getElementById('imini-import-confirm').onclick = () => {
            const text = document.getElementById('imini-import-text').value.trim();
            if (!text) {
                showToast('请输入或选择JSON数据', 'warning');
                return;
            }
            try {
                const result = importAccounts(text);
                showToast(`导入成功！共 ${result.total} 个账号，新增 ${result.new} 个`, 'success');
                hideImportModal();
                updateStats();
                renderList(getActiveFilter());
            } catch (e) {
                showToast(e.message, 'error');
            }
        };

        // 导出
        document.getElementById('imini-export-btn').onclick = () => {
            const data = exportAccounts();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `imini-accounts-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('导出成功！', 'success');
        };

        // 清空所有
        document.getElementById('imini-clear-all').onclick = () => {
            if (confirm('确定要清空所有账号吗？此操作不可恢复！')) {
                const ids = getAccounts().map(acc => acc.userId);
                const result = ids.length === 0 ? { deleted: 0, currentDeleted: false } : deleteAccounts(ids);
                setBatchMode(false);
                hideImportModal();
                updateStats();
                renderList(getActiveFilter());
                showToast('已清空所有账号', 'warning');
                if (result.currentDeleted) {
                    hidePanel();
                    setTimeout(() => location.reload(), 300);
                }
            }
        };

        // 筛选
        panel.querySelectorAll('.imini-tab').forEach(tab => {
            tab.onclick = () => {
                panel.querySelectorAll('.imini-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderList(tab.dataset.filter);
            };
        });

        // ESC关闭
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                hidePanel();
                hideImportModal();
            }
        });
    }

    // 延迟初始化
    setTimeout(createUI, 800);
})();
