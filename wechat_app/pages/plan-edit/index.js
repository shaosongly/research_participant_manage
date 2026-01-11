const { STORAGE_KEYS, getList, upsertItem, generateId } = require('../../utils/storage');
const { parseNumberList } = require('../../utils/visit-plan');

Page({
    data: {
        planId: '',
        form: {
            name: '',
            totalVisits: '',
            frequency: '',
            visitWindow: '',
            visitLabelRule: ''
        },
        frequencyMode: 'fixed',
        visitWindowMode: 'fixed',
        frequencyList: [''],
        visitWindowList: [],
        intervalCount: 0
    },
    onLoad(query) {
        const { id } = query;
        if (id) {
            this.loadPlan(id);
        }
    },
    onShow() {
        const app = getApp();
        if (app && app.ensurePrivacyConsent) {
            app.ensurePrivacyConsent();
        }
    },
    loadPlan(id) {
        const plans = getList(STORAGE_KEYS.PLANS);
        const plan = plans.find((item) => item.id === id);
        if (!plan) {
            wx.showToast({ title: '未找到方案', icon: 'none' });
            return;
        }
        const totalVisits = Number(plan.totalVisits || 0);
        const frequencyValue = plan.frequency || '';
        const windowValue = plan.visitWindow || '';
        const frequencyList = this.parseListValue(frequencyValue);
        const windowList = this.parseListValue(windowValue);
        this.setData({
            planId: id,
            form: {
                name: plan.name || '',
                totalVisits: String(plan.totalVisits || ''),
                frequency: frequencyValue,
                visitWindow: windowValue,
                visitLabelRule: plan.visitLabelRule || ''
            },
            intervalCount: Math.max(0, totalVisits - 1),
            frequencyMode: frequencyValue.includes(',') ? 'list' : 'fixed',
            visitWindowMode: windowValue.includes(',') ? 'list' : 'fixed',
            frequencyList: frequencyList.length ? frequencyList : [''],
            visitWindowList: windowList.length ? windowList : []
        });
    },
    onInput(event) {
        const { field } = event.currentTarget.dataset;
        const value = event.detail.value;
        const next = { [`form.${field}`]: value };
        if (field === 'totalVisits') {
            const totalVisits = Number(value || 0);
            next.intervalCount = Math.max(0, totalVisits - 1);
        }
        this.setData(next);
    },
    parseListValue(value) {
        return String(value || '')
            .split(/[，,]/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    },
    onModeChange(event) {
        const { field, mode } = event.currentTarget.dataset;
        if (field === 'frequency') {
            if (mode === 'list') {
                const list = this.parseListValue(this.data.form.frequency);
                this.setData({
                    frequencyMode: 'list',
                    frequencyList: list.length ? list : ['']
                });
            } else {
                const list = this.data.frequencyList;
                this.setData({
                    frequencyMode: 'fixed',
                    'form.frequency': list.find((item) => item.trim()) || ''
                });
            }
            return;
        }
        if (field === 'visitWindow') {
            if (mode === 'list') {
                const list = this.parseListValue(this.data.form.visitWindow);
                this.setData({
                    visitWindowMode: 'list',
                    visitWindowList: list.length ? list : ['']
                });
            } else {
                const list = this.data.visitWindowList;
                this.setData({
                    visitWindowMode: 'fixed',
                    'form.visitWindow': list.find((item) => item.trim()) || ''
                });
            }
        }
    },
    onIntervalInput(event) {
        const { index, type } = event.currentTarget.dataset;
        const value = event.detail.value;
        const key = type === 'visitWindow' ? 'visitWindowList' : 'frequencyList';
        const list = [...this.data[key]];
        list[index] = value;
        this.setData({ [key]: list });
    },
    addIntervalItem(event) {
        const { type } = event.currentTarget.dataset;
        const key = type === 'visitWindow' ? 'visitWindowList' : 'frequencyList';
        const maxCount = Math.max(0, Number(this.data.form.totalVisits || 0) - 1);
        const list = [...this.data[key]];
        if (maxCount > 0 && list.length >= maxCount) {
            wx.showToast({ title: '已达到最大项数', icon: 'none' });
            return;
        }
        list.push('');
        this.setData({ [key]: list });
    },
    removeIntervalItem(event) {
        const { index, type } = event.currentTarget.dataset;
        const key = type === 'visitWindow' ? 'visitWindowList' : 'frequencyList';
        const list = [...this.data[key]];
        list.splice(index, 1);
        this.setData({ [key]: list.length ? list : [''] });
    },
    normalizeNumberList(list) {
        return list
            .map((item) => String(item || '').trim())
            .filter((item) => item.length > 0);
    },
    handleSave() {
        const { form, planId } = this.data;
        const name = String(form.name || '').trim();
        const totalVisits = Number(form.totalVisits);
        let frequency = String(form.frequency || '').trim();
        let visitWindow = String(form.visitWindow || '').trim();
        const visitLabelRule = String(form.visitLabelRule || '').trim();

        if (!name) {
            wx.showToast({ title: '请输入方案名称', icon: 'none' });
            return;
        }
        if (!totalVisits || totalVisits <= 0) {
            wx.showToast({ title: '请输入有效访视次数', icon: 'none' });
            return;
        }
        if (this.data.frequencyMode === 'list') {
            const list = this.normalizeNumberList(this.data.frequencyList);
            if (!list.length) {
                wx.showToast({ title: '请输入访视频率', icon: 'none' });
                return;
            }
            if (list.length !== totalVisits - 1) {
                wx.showToast({ title: '访视频率数量不匹配', icon: 'none' });
                return;
            }
            if (list.some((item) => Number(item) <= 0 || Number.isNaN(Number(item)))) {
                wx.showToast({ title: '访视频率需为正整数', icon: 'none' });
                return;
            }
            frequency = list.join(',');
        } else {
            if (!frequency) {
                wx.showToast({ title: '请输入访视频率', icon: 'none' });
                return;
            }
            const frequencyList = parseNumberList(frequency, totalVisits - 1);
            if (!frequencyList) {
                wx.showToast({ title: '访视频率数量不匹配', icon: 'none' });
                return;
            }
        }

        if (this.data.visitWindowMode === 'list') {
            const list = this.normalizeNumberList(this.data.visitWindowList);
            if (!list.length) {
                wx.showToast({ title: '请输入访视窗口或切换为固定', icon: 'none' });
                return;
            }
            if (list.length !== totalVisits - 1) {
                wx.showToast({ title: '访视窗口数量不匹配', icon: 'none' });
                return;
            }
            if (list.some((item) => Number(item) < 0 || Number.isNaN(Number(item)))) {
                wx.showToast({ title: '访视窗口需为非负整数', icon: 'none' });
                return;
            }
            visitWindow = list.join(',');
        } else if (visitWindow) {
            const windowList = parseNumberList(visitWindow, totalVisits - 1);
            if (!windowList) {
                wx.showToast({ title: '访视窗口数量不匹配', icon: 'none' });
                return;
            }
        }

        const now = new Date().toISOString();
        const id = planId || generateId('plan');
        const payload = {
            id,
            name,
            totalVisits,
            frequency,
            visitWindow,
            visitLabelRule,
            createdAt: planId ? undefined : now,
            updatedAt: now
        };

        const existing = getList(STORAGE_KEYS.PLANS).find((item) => item.id === id);
        if (existing) {
            payload.createdAt = existing.createdAt;
        }

        upsertItem(STORAGE_KEYS.PLANS, payload);
        wx.showToast({ title: '已保存', icon: 'success' });
        setTimeout(() => {
            wx.navigateBack();
        }, 600);
    }
});
