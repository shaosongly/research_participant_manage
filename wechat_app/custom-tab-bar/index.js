Component({
    data: {
        selected: 0,
        list: [
            {
                pagePath: '/pages/plan-list/index',
                text: '方案'
            },
            {
                pagePath: '/pages/plan-generate/index',
                text: '生成'
            },
            {
                pagePath: '/pages/history/index',
                text: '历史'
            },
            {
                pagePath: '/pages/holiday-manage/index',
                text: '节假日'
            }
        ]
    },
    methods: {
        switchTab(event) {
            const path = event.currentTarget.dataset.path;
            wx.switchTab({ url: path });
        },
        setSelected(index) {
            this.setData({ selected: index });
        },
        updateSelected() {
            const pages = getCurrentPages();
            if (!pages.length) {
                return;
            }
            const current = pages[pages.length - 1];
            if (!current || !current.route) {
                return;
            }
            const route = `/${current.route}`;
            const index = this.data.list.findIndex((item) => item.pagePath === route);
            this.setData({ selected: index >= 0 ? index : 0 });
        }
    },
    lifetimes: {
        attached() {
            this.updateSelected();
        }
    },
    pageLifetimes: {
        show() {
            this.updateSelected();
        }
    }
});
