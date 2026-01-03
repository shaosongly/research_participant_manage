const { STORAGE_KEYS, getList, setList } = require('../../utils/storage');

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
        keyword: '',
        snapshots: [],
        filteredSnapshots: []
    },
    onShow() {
        if (this.getTabBar) {
            this.getTabBar().setSelected(2);
        }
        this.loadSnapshots();
    },
    loadSnapshots() {
        const snapshots = getList(STORAGE_KEYS.SNAPSHOTS).map((item) => ({
            ...item,
            createdAt: formatDateTime(item.createdAt)
        }));
        this.setData({ snapshots });
        this.applyFilter(this.data.keyword, snapshots);
    },
    applyFilter(keyword, snapshots) {
        const term = String(keyword || '').trim().toLowerCase();
        if (!term) {
            this.setData({ filteredSnapshots: snapshots });
            return;
        }
        const filtered = snapshots.filter((item) =>
            String(item.planName || '').toLowerCase().includes(term)
        );
        this.setData({ filteredSnapshots: filtered });
    },
    handleKeyword(event) {
        const value = event.detail.value;
        this.setData({ keyword: value });
        this.applyFilter(value, this.data.snapshots);
    },
    handleDetail(event) {
        const { id } = event.currentTarget.dataset;
        wx.navigateTo({ url: `/pages/history-detail/index?id=${id}` });
    },
    handleDelete(event) {
        const { id } = event.currentTarget.dataset;
        wx.showModal({
            title: '删除记录',
            content: '确定删除该历史记录吗？',
            success: (res) => {
                if (res.confirm) {
                    const next = getList(STORAGE_KEYS.SNAPSHOTS).filter(
                        (item) => item.id !== id
                    );
                    setList(STORAGE_KEYS.SNAPSHOTS, next);
                    this.loadSnapshots();
                }
            }
        });
    }
});
