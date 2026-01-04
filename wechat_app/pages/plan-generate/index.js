const {
    STORAGE_KEYS,
    getList,
    setList,
    generateId,
    pruneList
} = require('../../utils/storage');
const { calculatePlan, toDateKey } = require('../../utils/visit-plan');
const { buildOverrideMap, getHolidayInfo } = require('../../utils/holiday');

Page({
    data: {
        plans: [],
        planNames: [],
        selectedIndex: 0,
        selectedPlan: null,
        selectedPlanName: '',
        firstVisitDate: '',
        mode: 'single',
        rangeStart: '',
        rangeEnd: '',
        batchResults: [],
        bestResult: null
    },
    onLoad(query) {
        this.loadPlans(query.planId || '');
    },
    onShow() {
        if (this.getTabBar) {
            this.getTabBar().setSelected(1);
        }
        const storedId = wx.getStorageSync('selectedPlanId');
        if (storedId) {
            wx.removeStorageSync('selectedPlanId');
        }
        this.loadPlans(
            storedId || (this.data.selectedPlan ? this.data.selectedPlan.id : '')
        );
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
            selectedPlanName: selectedPlan ? selectedPlan.name : '',
            batchResults: [],
            bestResult: null
        });
    },
    handleDateChange(event) {
        this.setData({ firstVisitDate: event.detail.value });
    },
    handleRangeStartChange(event) {
        this.setData({ rangeStart: event.detail.value });
    },
    handleRangeEndChange(event) {
        this.setData({ rangeEnd: event.detail.value });
    },
    handleModeChange(event) {
        const { mode } = event.currentTarget.dataset;
        if (mode === this.data.mode) {
            return;
        }
        this.setData({
            mode,
            batchResults: [],
            bestResult: null
        });
    },
    normalizeDate(value) {
        if (!value) {
            return null;
        }
        const date = new Date(`${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        return date;
    },
    collectDateRange(start, end) {
        const dates = [];
        const cursor = new Date(start.getTime());
        while (cursor <= end) {
            dates.push(toDateKey(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        return dates;
    },
    buildPlanResult(plan, firstVisitDate, overrideMap) {
        const result = calculatePlan({
            firstVisitDate,
            totalVisits: plan.totalVisits,
            frequency: plan.frequency,
            visitWindow: plan.visitWindow,
            visitLabelRule: plan.visitLabelRule,
            getHolidayInfo: (dateKey) => getHolidayInfo(dateKey, overrideMap)
        });
        if (!result) {
            return null;
        }
        return {
            firstVisitDate,
            items: result.items,
            unavoidableCount: result.unavoidableCount || 0,
            unavoidableDetails: result.unavoidableDetails || []
        };
    },
    handleBatchGenerate() {
        const { selectedPlan, rangeStart, rangeEnd } = this.data;
        if (!selectedPlan) {
            wx.showToast({ title: '请选择方案', icon: 'none' });
            return;
        }
        const start = this.normalizeDate(rangeStart);
        const end = this.normalizeDate(rangeEnd);
        if (!start || !end) {
            wx.showToast({ title: '请选择起止日期', icon: 'none' });
            return;
        }
        if (start > end) {
            wx.showToast({ title: '结束日期需晚于开始日期', icon: 'none' });
            return;
        }
        const overrides = getList(STORAGE_KEYS.HOLIDAY_OVERRIDES);
        const overrideMap = buildOverrideMap(overrides);
        const dates = this.collectDateRange(start, end);
        wx.showLoading({ title: '生成中...' });
        try {
            const results = dates
                .map((date) => this.buildPlanResult(selectedPlan, date, overrideMap))
                .filter(Boolean);
            let best = null;
            results.forEach((item) => {
                if (!best) {
                    best = item;
                    return;
                }
                if (item.unavoidableCount < best.unavoidableCount) {
                    best = item;
                } else if (
                    item.unavoidableCount === best.unavoidableCount &&
                    item.firstVisitDate < best.firstVisitDate
                ) {
                    best = item;
                }
            });
            results.sort((a, b) => (a.firstVisitDate < b.firstVisitDate ? -1 : 1));
            this.setData({
                batchResults: results,
                bestResult: best
            });
        } finally {
            wx.hideLoading();
        }
    },
    handleViewBatchResult(event) {
        const { index } = event.currentTarget.dataset;
        const item =
            index === 'best' ? this.data.bestResult : this.data.batchResults[index];
        const plan = this.data.selectedPlan;
        if (!item || !plan) {
            return;
        }
        wx.setStorageSync('currentPlanResult', {
            plan,
            firstVisitDate: item.firstVisitDate,
            result: {
                items: item.items,
                unavoidableCount: item.unavoidableCount,
                unavoidableDetails: item.unavoidableDetails
            }
        });
        wx.navigateTo({ url: '/pages/plan-result/index' });
    },
    handleSaveBatch() {
        const { selectedPlan, rangeStart, rangeEnd, batchResults, bestResult } = this.data;
        if (!selectedPlan || !batchResults.length) {
            wx.showToast({ title: '暂无可保存内容', icon: 'none' });
            return;
        }
        const snapshot = {
            id: generateId('snapshot'),
            type: 'batch',
            planId: selectedPlan.id,
            planName: selectedPlan.name,
            totalVisits: selectedPlan.totalVisits,
            frequency: selectedPlan.frequency,
            visitWindow: selectedPlan.visitWindow,
            visitLabelRule: selectedPlan.visitLabelRule,
            rangeStart,
            rangeEnd,
            bestFirstVisitDate: bestResult ? bestResult.firstVisitDate : '',
            results: batchResults.map((item) => ({
                firstVisitDate: item.firstVisitDate,
                unavoidableCount: item.unavoidableCount,
                unavoidableDetails: item.unavoidableDetails,
                items: item.items
            })),
            createdAt: new Date().toISOString()
        };
        const list = getList(STORAGE_KEYS.SNAPSHOTS);
        list.unshift(snapshot);
        setList(STORAGE_KEYS.SNAPSHOTS, list);
        pruneList(STORAGE_KEYS.SNAPSHOTS, 100);
        wx.showToast({ title: '已保存', icon: 'success' });
    },
    handleGenerate() {
        const { selectedPlan, firstVisitDate, plans, selectedIndex } = this.data;
        const effectivePlan = selectedPlan || plans[selectedIndex] || null;
        if (!effectivePlan) {
            wx.showToast({ title: '请选择方案', icon: 'none' });
            return;
        }
        if (!firstVisitDate) {
            wx.showToast({ title: '请选择首访日期', icon: 'none' });
            return;
        }
        const overrides = getList(STORAGE_KEYS.HOLIDAY_OVERRIDES);
        const overrideMap = buildOverrideMap(overrides);

        const result = this.buildPlanResult(effectivePlan, firstVisitDate, overrideMap);

        if (!result) {
            wx.showToast({ title: '计划生成失败', icon: 'none' });
            return;
        }

        wx.setStorageSync('currentPlanResult', {
            plan: effectivePlan,
            firstVisitDate,
            result: {
                items: result.items,
                unavoidableCount: result.unavoidableCount,
                unavoidableDetails: result.unavoidableDetails
            }
        });
        wx.navigateTo({ url: '/pages/plan-result/index' });
    }
});
