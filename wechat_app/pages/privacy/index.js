Page({
    data: {
        content: ''
    },
    onLoad() {
        const app = getApp();
        this.setData({ content: app.globalData.privacyContent || '' });
    },
    onShow() {
        const app = getApp();
        if (app && app.ensurePrivacyConsent) {
            app.ensurePrivacyConsent();
        }
    }
});
