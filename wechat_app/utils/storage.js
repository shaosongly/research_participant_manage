const STORAGE_KEYS = {
    PLANS: 'plans',
    SNAPSHOTS: 'planSnapshots',
    HOLIDAY_OVERRIDES: 'holidayOverrides'
};

const getList = (key) => {
    const value = wx.getStorageSync(key);
    if (Array.isArray(value)) {
        return value;
    }
    return [];
};

const setList = (key, list) => {
    wx.setStorageSync(key, list);
};

const generateId = (prefix) => {
    const stamp = Date.now();
    const rand = Math.random().toString(16).slice(2, 8);
    return `${prefix}_${stamp}_${rand}`;
};

const upsertItem = (key, item, idField = 'id') => {
    const list = getList(key);
    const index = list.findIndex((entry) => entry[idField] === item[idField]);
    if (index >= 0) {
        list.splice(index, 1, item);
    } else {
        list.unshift(item);
    }
    setList(key, list);
    return list;
};

const removeItem = (key, id, idField = 'id') => {
    const list = getList(key).filter((entry) => entry[idField] !== id);
    setList(key, list);
    return list;
};

const pruneList = (key, maxCount) => {
    const list = getList(key);
    if (list.length <= maxCount) {
        return list;
    }
    const trimmed = list.slice(0, maxCount);
    setList(key, trimmed);
    return trimmed;
};

module.exports = {
    STORAGE_KEYS,
    getList,
    setList,
    generateId,
    upsertItem,
    removeItem,
    pruneList
};
