const { STORAGE_KEYS, getList, removeItem } = require('../../utils/storage');

const formatDateTime = (value) => {
    if (!value) {
        return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`;
};

Page({
    data: {
        plans: []
    },
    onShow() {
        if (this.getTabBar) {
            this.getTabBar().setSelected(0);
        }
        this.loadPlans();
    },
    loadPlans() {
        const plans = getList(STORAGE_KEYS.PLANS).map((plan) => ({
            ...plan,
            updatedAt: formatDateTime(plan.updatedAt)
        }));
        this.setData({ plans });
    },
    handleCreate() {
        wx.navigateTo({ url: '/pages/plan-edit/index' });
    },
    handleGenerate(event) {
        const { id } = event.currentTarget.dataset;
        wx.setStorageSync('selectedPlanId', id);
        wx.switchTab({ url: '/pages/plan-generate/index' });
    },
    handleDelete(event) {
        const { id } = event.currentTarget.dataset;
        wx.showModal({
            title: '删除方案',
            content: '确定删除该方案吗？相关历史记录不会自动删除。',
            success: (res) => {
                if (res.confirm) {
                    removeItem(STORAGE_KEYS.PLANS, id);
                    this.loadPlans();
                }
            }
        });
    }
});
