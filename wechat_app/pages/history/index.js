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
        filteredSnapshots: [],
        groupedSnapshots: [],
        typeFilter: 'all'
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
            type: item.type || 'single',
            createdAt: formatDateTime(item.createdAt)
        }));
        this.setData({ snapshots });
        this.applyFilter(this.data.keyword, this.data.typeFilter, snapshots);
    },
    applyFilter(keyword, typeFilter, snapshots) {
        const term = String(keyword || '').trim().toLowerCase();
        let filtered = snapshots;
        if (typeFilter !== 'all') {
            filtered = filtered.filter((item) => item.type === typeFilter);
        }
        if (term) {
            filtered = filtered.filter((item) =>
                String(item.planName || '').toLowerCase().includes(term)
            );
        }
        const grouped = this.groupByPlan(filtered);
        this.setData({ filteredSnapshots: filtered, groupedSnapshots: grouped });
    },
    groupByPlan(snapshots) {
        const map = {};
        snapshots.forEach((item) => {
            const key = item.planName || '未命名方案';
            if (!map[key]) {
                map[key] = {
                    planName: key,
                    total: 0,
                    singleList: [],
                    batchList: []
                };
            }
            map[key].total += 1;
            if (item.type === 'batch') {
                map[key].batchList.push(item);
            } else {
                map[key].singleList.push(item);
            }
        });
        return Object.values(map).sort((a, b) =>
            a.planName.localeCompare(b.planName)
        );
    },
    handleKeyword(event) {
        const value = event.detail.value;
        this.setData({ keyword: value });
        this.applyFilter(value, this.data.typeFilter, this.data.snapshots);
    },
    handleTypeFilter(event) {
        const { type } = event.currentTarget.dataset;
        if (type === this.data.typeFilter) {
            return;
        }
        this.setData({ typeFilter: type });
        this.applyFilter(this.data.keyword, type, this.data.snapshots);
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
