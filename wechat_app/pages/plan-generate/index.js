const { STORAGE_KEYS, getList } = require('../../utils/storage');
const { calculatePlan } = require('../../utils/visit-plan');
const { buildOverrideMap, getHolidayInfo } = require('../../utils/holiday');

Page({
    data: {
        plans: [],
        planNames: [],
        selectedIndex: 0,
        selectedPlan: null,
        selectedPlanName: '',
        firstVisitDate: ''
    },
    onLoad(query) {
        this.loadPlans(query.planId || '');
    },
    onShow() {
        if (this.getTabBar) {
            this.getTabBar().setSelected(1);
        }
        this.loadPlans(this.data.selectedPlan ? this.data.selectedPlan.id : '');
    },
    loadPlans(selectedId) {
        const plans = getList(STORAGE_KEYS.PLANS);
        const planNames = plans.map((plan) => plan.name);
        let selectedIndex = 0;
        if (selectedId) {
            const foundIndex = plans.findIndex((plan) => plan.id === selectedId);
            if (foundIndex >= 0) {
                selectedIndex = foundIndex;
            }
        }
        const selectedPlan = plans[selectedIndex] || null;
        this.setData({
            plans,
            planNames,
            selectedIndex,
            selectedPlan,
            selectedPlanName: selectedPlan ? selectedPlan.name : ''
        });
    },
    handlePlanChange(event) {
        const index = Number(event.detail.value);
        const selectedPlan = this.data.plans[index] || null;
        this.setData({
            selectedIndex: index,
            selectedPlan,
            selectedPlanName: selectedPlan ? selectedPlan.name : ''
        });
    },
    handleDateChange(event) {
        this.setData({ firstVisitDate: event.detail.value });
    },
    handleGenerate() {
        const { selectedPlan, firstVisitDate } = this.data;
        if (!selectedPlan) {
            wx.showToast({ title: '请选择方案', icon: 'none' });
            return;
        }
        if (!firstVisitDate) {
            wx.showToast({ title: '请选择首访日期', icon: 'none' });
            return;
        }
        const overrides = getList(STORAGE_KEYS.HOLIDAY_OVERRIDES);
        const overrideMap = buildOverrideMap(overrides);

        const result = calculatePlan({
            firstVisitDate,
            totalVisits: selectedPlan.totalVisits,
            frequency: selectedPlan.frequency,
            visitWindow: selectedPlan.visitWindow,
            visitLabelRule: selectedPlan.visitLabelRule,
            getHolidayInfo: (dateKey) => getHolidayInfo(dateKey, overrideMap)
        });

        if (!result) {
            wx.showToast({ title: '计划生成失败', icon: 'none' });
            return;
        }

        wx.setStorageSync('currentPlanResult', {
            plan: selectedPlan,
            firstVisitDate,
            result
        });
        wx.navigateTo({ url: '/pages/plan-result/index' });
    }
});
