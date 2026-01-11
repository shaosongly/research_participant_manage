const PRIVACY_KEY = 'privacyAgreementAccepted';
const PRIVACY_TITLE = '隐私与免责声明';
const PRIVACY_CONTENT =
    '本工具仅在本机离线运行，访视方案、节假日与历史记录仅保存在设备本地存储中，不会上传服务器。\n' +
    '我们不会收集任何个人信息、定位或设备标识。\n' +
    '导出文件需由用户手动分享或保存，请自行妥善保管。\n' +
    '生成结果仅供参考，最终安排请结合实际情况执行。';

App({
    globalData: {
        appName: '访视计划工具',
        privacyTitle: PRIVACY_TITLE,
        privacyContent: PRIVACY_CONTENT
    },
    ensurePrivacyConsent() {
        if (wx.getStorageSync(PRIVACY_KEY)) {
            return;
        }
        if (this._privacyPrompting) {
            return;
        }
        this._privacyPrompting = true;
        const prompt = () => {
            wx.showModal({
                title: PRIVACY_TITLE,
                content: PRIVACY_CONTENT,
                confirmText: '同意继续',
                cancelText: '不同意',
                success: (res) => {
                    if (res.confirm) {
                        wx.setStorageSync(PRIVACY_KEY, true);
                        this._privacyPrompting = false;
                    } else {
                        setTimeout(prompt, 120);
                    }
                },
                fail: (error) => {
                    console.warn('[privacy] showModal fail', error);
                    this._privacyPrompting = false;
                }
            });
        };
        prompt();
    }
});
