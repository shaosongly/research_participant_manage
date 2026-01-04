const {
    STORAGE_KEYS,
    getList,
    setList,
    generateId,
    pruneList
} = require('../../utils/storage');
const { calculatePlan } = require('../../utils/visit-plan');
const { buildOverrideMap, getHolidayInfo } = require('../../utils/holiday');
const { exportPlanFile, shareExportedFile } = require('../../utils/export-excel');

const DATE_TYPE_LABELS = {
    earliest: '提前',
    base: '基准',
    latest: '延后'
};

Page({
    data: {
        plan: null,
        firstVisitDate: '',
        items: [],
        unavoidableCount: 0,
        unavoidableDetails: []
    },
    onShow() {
        this.loadResult();
    },
    loadResult() {
        const payload = wx.getStorageSync('currentPlanResult');
        if (!payload || !payload.plan) {
            this.setData({ plan: null });
            return;
        }
        const decorated = this.decorateItems(payload.result.items || []);
        this.setData({
            plan: payload.plan,
            firstVisitDate: payload.firstVisitDate,
            items: decorated,
            unavoidableCount: payload.result.unavoidableCount || 0,
            unavoidableDetails: payload.result.unavoidableDetails || []
        });
    },
    decorateItems(items) {
        return items.map((item) => ({
            ...item,
            dateTypeLabel: DATE_TYPE_LABELS[item.dateType] || item.dateType,
            isHoliday: item.holidayInfo && item.holidayInfo !== '非节假日',
            groupClass: `visit-group ${item.visitNumber % 2 === 0 ? 'visit-group-even' : 'visit-group-odd'}`
        }));
    },
    handleAdjustDate(event) {
        this.setData({ firstVisitDate: event.detail.value });
    },
    handleRegenerate() {
        const { plan, firstVisitDate } = this.data;
        if (!plan || !firstVisitDate) {
            wx.showToast({ title: '缺少必要信息', icon: 'none' });
            return;
        }
        const overrides = getList(STORAGE_KEYS.HOLIDAY_OVERRIDES);
        const overrideMap = buildOverrideMap(overrides);
        const result = calculatePlan({
            firstVisitDate,
            totalVisits: plan.totalVisits,
            frequency: plan.frequency,
            visitWindow: plan.visitWindow,
            visitLabelRule: plan.visitLabelRule,
            getHolidayInfo: (dateKey) => getHolidayInfo(dateKey, overrideMap)
        });
        if (!result) {
            wx.showToast({ title: '重新生成失败', icon: 'none' });
            return;
        }
        wx.setStorageSync('currentPlanResult', {
            plan,
            firstVisitDate,
            result
        });
        this.loadResult();
    },
    handleSave() {
        const { plan, firstVisitDate, items, unavoidableCount, unavoidableDetails } = this.data;
        if (!plan || !items.length) {
            wx.showToast({ title: '暂无可保存内容', icon: 'none' });
            return;
        }
        const snapshot = {
            id: generateId('snapshot'),
            planId: plan.id,
            planName: plan.name,
            firstVisitDate,
            totalVisits: plan.totalVisits,
            frequency: plan.frequency,
            visitWindow: plan.visitWindow,
            visitLabelRule: plan.visitLabelRule,
            items: items.map((item) => ({
                visitNumber: item.visitNumber,
                visitLabel: item.visitLabel,
                dateType: item.dateType,
                date: item.date,
                holidayInfo: item.holidayInfo
            })),
            unavoidableCount,
            unavoidableDetails,
            createdAt: new Date().toISOString()
        };
        const list = getList(STORAGE_KEYS.SNAPSHOTS);
        list.unshift(snapshot);
        setList(STORAGE_KEYS.SNAPSHOTS, list);
        pruneList(STORAGE_KEYS.SNAPSHOTS, 100);
        wx.showToast({ title: '已保存', icon: 'success' });
    },
    async handleExport() {
        const { plan, firstVisitDate, items } = this.data;
        if (!plan || !items.length) {
            wx.showToast({ title: '暂无可导出内容', icon: 'none' });
            return;
        }
        const rows = [
            ['方案名称', plan.name],
            ['访视次数', plan.totalVisits],
            ['访视频率', plan.frequency],
            ['访视窗口', plan.visitWindow || '0'],
            ['首访日期', firstVisitDate],
            ['导出时间', new Date().toLocaleString()],
            [],
            ['访视序号', '访视名称', '日期类型', '计划日期', '节假日信息']
        ];
        items.forEach((item) => {
            rows.push([
                item.visitNumber,
                item.visitLabel,
                DATE_TYPE_LABELS[item.dateType] || item.dateType,
                item.date,
                item.holidayInfo
            ]);
        });
        try {
            const result = await exportPlanFile({
                rows,
                fileName: `visit_plan_${plan.name}`
            });
            if (wx.canIUse && wx.canIUse('shareFileMessage')) {
                wx.showModal({
                    title: '已生成CSV',
                    content: result.opened
                        ? '已打开预览，可继续分享保存。'
                        : '当前设备无法预览 CSV，建议分享保存到手机。',
                    confirmText: '分享',
                    cancelText: '取消',
                    success: async (res) => {
                        if (!res.confirm) {
                            return;
                        }
                        try {
                            await shareExportedFile(result.filePath, result.fileName);
                            wx.showToast({ title: '已发起分享', icon: 'success' });
                        } catch (error) {
                            wx.showToast({ title: '分享失败', icon: 'none' });
                        }
                    }
                });
            } else {
                wx.showToast({ title: '已导出为CSV', icon: 'success' });
            }
        } catch (error) {
            wx.showToast({ title: '导出失败', icon: 'none' });
        }
    }
});
