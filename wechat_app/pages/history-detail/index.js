const { STORAGE_KEYS, getList } = require('../../utils/storage');
const { exportPlanFile, shareExportedFile } = require('../../utils/export-excel');

const DATE_TYPE_LABELS = {
    earliest: '提前',
    base: '基准',
    latest: '延后'
};

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

Page({
    data: {
        snapshot: null
    },
    formatDetailText(details) {
        if (!details || !details.length) {
            return '';
        }
        return details
            .map((detail) => {
                const label = detail.visitLabel || `第 ${detail.visitNumber} 次访视`;
                const dates = (detail.dates || [])
                    .map((item) => `${item.date} ${item.holidayInfo}`)
                    .join(' | ');
                return `${label}: ${dates}`;
            })
            .join('; ');
    },
    formatWeekday(dateValue) {
        if (!dateValue) {
            return '';
        }
        const date = new Date(`${dateValue}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        return WEEKDAY_LABELS[date.getDay()] || '';
    },
    onLoad(query) {
        this.loadSnapshot(query.id || '');
    },
    loadSnapshot(id) {
        const snapshots = getList(STORAGE_KEYS.SNAPSHOTS);
        const snapshot = snapshots.find((item) => item.id === id);
        if (!snapshot) {
            this.setData({ snapshot: null });
            return;
        }
        const type = snapshot.type || 'single';
        if (type === 'batch') {
            const results = (snapshot.results || [])
                .slice()
                .sort((a, b) => (a.firstVisitDate < b.firstVisitDate ? -1 : 1))
                .map((item) => ({
                    ...item,
                    detailText: this.formatDetailText(item.unavoidableDetails || []),
                    isBest: item.firstVisitDate === snapshot.bestFirstVisitDate
                }));
            this.setData({
                snapshot: {
                    ...snapshot,
                    type,
                    results
                }
            });
            return;
        }
        const decorated = (snapshot.items || []).map((item) => ({
            ...item,
            dateTypeLabel: DATE_TYPE_LABELS[item.dateType] || item.dateType,
            isHoliday: item.holidayInfo && item.holidayInfo !== '非节假日',
            groupClass: `visit-group ${item.visitNumber % 2 === 0 ? 'visit-group-even' : 'visit-group-odd'}`
        }));
        this.setData({
            snapshot: {
                ...snapshot,
                type,
                items: decorated
            }
        });
    },
    handleViewResult(event) {
        const { index } = event.currentTarget.dataset;
        const { snapshot } = this.data;
        if (!snapshot || snapshot.type !== 'batch') {
            return;
        }
        const item = snapshot.results[index];
        if (!item) {
            return;
        }
        wx.setStorageSync('currentPlanResult', {
            plan: {
                id: snapshot.planId,
                name: snapshot.planName,
                totalVisits: snapshot.totalVisits,
                frequency: snapshot.frequency,
                visitWindow: snapshot.visitWindow,
                visitLabelRule: snapshot.visitLabelRule
            },
            firstVisitDate: item.firstVisitDate,
            result: {
                items: item.items || [],
                unavoidableCount: item.unavoidableCount || 0,
                unavoidableDetails: item.unavoidableDetails || []
            }
        });
        wx.navigateTo({ url: '/pages/plan-result/index' });
    },
    async handleExport() {
        const { snapshot } = this.data;
        if (!snapshot) {
            return;
        }
        let rows = [];
        if (snapshot.type === 'batch') {
            rows = [
                ['方案名称', snapshot.planName],
                ['访视次数', snapshot.totalVisits],
                ['访视频率', snapshot.frequency],
                ['访视窗口', snapshot.visitWindow || '0'],
                ['日期范围', `${snapshot.rangeStart} ~ ${snapshot.rangeEnd}`],
                ['导出时间', new Date().toLocaleString()],
                [],
                ['首访日期', '星期', '不可避次数', '不可避详情']
            ];
            (snapshot.results || []).forEach((item) => {
                rows.push([
                    item.firstVisitDate,
                    this.formatWeekday(item.firstVisitDate),
                    item.unavoidableCount,
                    this.formatDetailText(item.unavoidableDetails || [])
                ]);
            });
        } else {
            rows = [
                ['方案名称', snapshot.planName],
                ['访视次数', snapshot.totalVisits],
                ['访视频率', snapshot.frequency],
                ['访视窗口', snapshot.visitWindow || '0'],
                ['首访日期', snapshot.firstVisitDate],
                ['导出时间', new Date().toLocaleString()],
                [],
                ['访视序号', '访视名称', '日期类型', '计划日期', '节假日信息']
            ];
            snapshot.items.forEach((item) => {
                rows.push([
                    item.visitNumber,
                    item.visitLabel,
                    item.dateTypeLabel,
                    item.date,
                    item.holidayInfo
                ]);
            });
        }
        try {
            const result = await exportPlanFile({
                rows,
                fileName:
                    snapshot.type === 'batch'
                        ? `visit_plan_batch_${snapshot.planName}`
                        : `visit_plan_${snapshot.planName}`
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
