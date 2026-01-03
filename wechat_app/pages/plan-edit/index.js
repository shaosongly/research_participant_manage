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
        }
    },
    onLoad(query) {
        const { id } = query;
        if (id) {
            this.loadPlan(id);
        }
    },
    loadPlan(id) {
        const plans = getList(STORAGE_KEYS.PLANS);
        const plan = plans.find((item) => item.id === id);
        if (!plan) {
            wx.showToast({ title: '未找到方案', icon: 'none' });
            return;
        }
        this.setData({
            planId: id,
            form: {
                name: plan.name || '',
                totalVisits: String(plan.totalVisits || ''),
                frequency: plan.frequency || '',
                visitWindow: plan.visitWindow || '',
                visitLabelRule: plan.visitLabelRule || ''
            }
        });
    },
    onInput(event) {
        const { field } = event.currentTarget.dataset;
        const value = event.detail.value;
        this.setData({
            [`form.${field}`]: value
        });
    },
    handleSave() {
        const { form, planId } = this.data;
        const name = String(form.name || '').trim();
        const totalVisits = Number(form.totalVisits);
        const frequency = String(form.frequency || '').trim();
        const visitWindow = String(form.visitWindow || '').trim();
        const visitLabelRule = String(form.visitLabelRule || '').trim();

        if (!name) {
            wx.showToast({ title: '请输入方案名称', icon: 'none' });
            return;
        }
        if (!totalVisits || totalVisits <= 0) {
            wx.showToast({ title: '请输入有效访视次数', icon: 'none' });
            return;
        }
        if (!frequency) {
            wx.showToast({ title: '请输入访视频率', icon: 'none' });
            return;
        }
        const frequencyList = parseNumberList(frequency, totalVisits - 1);
        if (!frequencyList) {
            wx.showToast({ title: '访视频率数量不匹配', icon: 'none' });
            return;
        }
        if (visitWindow) {
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
