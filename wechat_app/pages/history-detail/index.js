const { STORAGE_KEYS, getList } = require('../../utils/storage');
const { exportPlanFile, shareExportedFile } = require('../../utils/export-excel');

const DATE_TYPE_LABELS = {
    earliest: '提前',
    base: '基准',
    latest: '延后'
};

Page({
    data: {
        snapshot: null
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
        const decorated = (snapshot.items || []).map((item) => ({
            ...item,
            dateTypeLabel: DATE_TYPE_LABELS[item.dateType] || item.dateType,
            isHoliday: item.holidayInfo && item.holidayInfo !== '非节假日',
            groupClass: `visit-group ${item.visitNumber % 2 === 0 ? 'visit-group-even' : 'visit-group-odd'}`
        }));
        this.setData({
            snapshot: {
                ...snapshot,
                items: decorated
            }
        });
    },
    async handleExport() {
        const { snapshot } = this.data;
        if (!snapshot) {
            return;
        }
        const rows = [
            ['方案名称', snapshot.planName],
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
        try {
            const result = await exportPlanFile({
                rows,
                fileName: `visit_plan_${snapshot.planName}`
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
