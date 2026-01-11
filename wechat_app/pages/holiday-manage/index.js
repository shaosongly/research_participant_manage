const { STORAGE_KEYS, getList, setList } = require('../../utils/storage');

Page({
    data: {
        overrides: [],
        form: {
            date: '',
            isHoliday: true,
            holidayName: ''
        }
    },
    onShow() {
        const app = getApp();
        if (app && app.ensurePrivacyConsent) {
            app.ensurePrivacyConsent();
        }
        if (this.getTabBar) {
            this.getTabBar().setSelected(3);
        }
        this.loadOverrides();
    },
    loadOverrides() {
        const overrides = getList(STORAGE_KEYS.HOLIDAY_OVERRIDES).sort((a, b) =>
            a.date.localeCompare(b.date)
        );
        this.setData({ overrides });
    },
    onDateChange(event) {
        this.setData({ 'form.date': event.detail.value });
    },
    onHolidayChange(event) {
        this.setData({ 'form.isHoliday': event.detail.value });
    },
    onInput(event) {
        const { field } = event.currentTarget.dataset;
        const value = event.detail.value;
        this.setData({ [`form.${field}`]: value });
    },
    handleSave() {
        const { date, isHoliday, holidayName } = this.data.form;
        if (!date) {
            wx.showToast({ title: '请选择日期', icon: 'none' });
            return;
        }
        if (isHoliday && !String(holidayName || '').trim()) {
            wx.showToast({ title: '请输入节假日名称', icon: 'none' });
            return;
        }
        const overrides = getList(STORAGE_KEYS.HOLIDAY_OVERRIDES);
        const payload = {
            date,
            isHoliday: Boolean(isHoliday),
            holidayName: String(holidayName || '').trim(),
            updatedAt: new Date().toISOString()
        };
        const index = overrides.findIndex((item) => item.date === date);
        if (index >= 0) {
            overrides.splice(index, 1, payload);
        } else {
            overrides.unshift(payload);
        }
        setList(STORAGE_KEYS.HOLIDAY_OVERRIDES, overrides);
        this.setData({
            form: {
                date: '',
                isHoliday: true,
                holidayName: ''
            }
        });
        this.loadOverrides();
        wx.showToast({ title: '已保存', icon: 'success' });
    },
    handleDelete(event) {
        const { date } = event.currentTarget.dataset;
        wx.showModal({
            title: '删除覆盖',
            content: '确定删除该条覆盖吗？',
            success: (res) => {
                if (res.confirm) {
                    const overrides = getList(STORAGE_KEYS.HOLIDAY_OVERRIDES).filter(
                        (item) => item.date !== date
                    );
                    setList(STORAGE_KEYS.HOLIDAY_OVERRIDES, overrides);
                    this.loadOverrides();
                }
            }
        });
    }
});
