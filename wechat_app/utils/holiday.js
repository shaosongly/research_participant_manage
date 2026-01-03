let HolidayUtil = null;
try {
    ({ HolidayUtil } = require('lunar-javascript'));
} catch (error) {
    HolidayUtil = null;
}

const buildOverrideMap = (overrides) => {
    const map = new Map();
    (overrides || []).forEach((item) => {
        if (item && item.date) {
            map.set(item.date, item);
        }
    });
    return map;
};

const getHolidayInfo = (dateKey, overrideMap) => {
    if (!dateKey) {
        return '非节假日';
    }

    if (overrideMap && overrideMap.has(dateKey)) {
        const override = overrideMap.get(dateKey);
        if (!override.isHoliday) {
            return '非节假日';
        }
        const name = String(override.holidayName || '').trim();
        return name || '自定义节假日';
    }

    const [year, month, day] = dateKey.split('-').map((value) => Number(value));
    if (HolidayUtil && year && month && day) {
        const holiday = HolidayUtil.getHoliday(year, month, day);
        if (holiday) {
            return holiday.isWork() ? `${holiday.getName()}调休` : holiday.getName();
        }
    }

    const date = new Date(dateKey);
    if (!Number.isNaN(date.getTime())) {
        const weekDay = date.getDay();
        if (weekDay === 0) {
            return '周日';
        }
        if (weekDay === 6) {
            return '周六';
        }
    }

    return '非节假日';
};

module.exports = {
    buildOverrideMap,
    getHolidayInfo
};
