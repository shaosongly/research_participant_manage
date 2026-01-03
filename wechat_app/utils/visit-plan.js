const parseNumberList = (value, count) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
        return Array(count).fill(0);
    }
    if (trimmed.includes(',')) {
        const parts = trimmed.split(',').map((item) => Number(item.trim()));
        if (parts.length !== count || parts.some((num) => Number.isNaN(num))) {
            return null;
        }
        return parts;
    }
    const fixed = Number(trimmed);
    if (Number.isNaN(fixed)) {
        return null;
    }
    return Array(count).fill(fixed);
};

const addDays = (date, days) => {
    const next = new Date(date.getTime());
    next.setDate(next.getDate() + days);
    return next;
};

const toDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getVisitLabel = (visitNumber, rule) => {
    const base = String(rule || '').trim();
    if (!base) {
        return `第 ${visitNumber} 次访视`;
    }
    const match = base.match(/^([A-Za-z]+)?(\d+)$/);
    if (!match) {
        return `第 ${visitNumber} 次访视`;
    }
    const prefix = match[1] || '';
    const start = Number(match[2]);
    if (Number.isNaN(start)) {
        return `第 ${visitNumber} 次访视`;
    }
    return `${prefix}${start + visitNumber - 1}`;
};

const calculatePlan = ({
    firstVisitDate,
    totalVisits,
    frequency,
    visitWindow,
    visitLabelRule,
    getHolidayInfo
}) => {
    const count = Number(totalVisits);
    if (!count || count <= 0) {
        return null;
    }
    const firstDate = new Date(firstVisitDate);
    if (Number.isNaN(firstDate.getTime())) {
        return null;
    }

    const frequencyValues = parseNumberList(frequency, count - 1);
    if (!frequencyValues) {
        return null;
    }
    const windowValues = parseNumberList(visitWindow, count - 1);
    if (!windowValues) {
        return null;
    }

    const items = [];
    const unavoidableDetails = [];
    let unavoidableCount = 0;

    let baseDate = new Date(firstDate.getTime());
    for (let i = 0; i < count; i += 1) {
        const visitNumber = i + 1;
        const window = i === 0 ? 0 : windowValues[i - 1];

        const earliest = addDays(baseDate, -window);
        const latest = addDays(baseDate, window);

        const label = getVisitLabel(visitNumber, visitLabelRule);

        const entries = [
            {
                visitNumber,
                visitLabel: label,
                dateType: 'earliest',
                date: toDateKey(earliest)
            },
            {
                visitNumber,
                visitLabel: label,
                dateType: 'base',
                date: toDateKey(baseDate)
            },
            {
                visitNumber,
                visitLabel: label,
                dateType: 'latest',
                date: toDateKey(latest)
            }
        ];

        const list = window === 0 ? [entries[1]] : entries;
        list.forEach((entry) => {
            const info = getHolidayInfo ? getHolidayInfo(entry.date) : '非节假日';
            items.push({
                ...entry,
                holidayInfo: info
            });
        });

        if (getHolidayInfo) {
            const allDates = [];
            for (let j = 0; j <= window * 2; j += 1) {
                const date = addDays(earliest, j);
                const key = toDateKey(date);
                const info = getHolidayInfo(key);
                allDates.push({
                    date: key,
                    holidayInfo: info
                });
            }
            const nonWorking = allDates.filter((item) => item.holidayInfo !== '非节假日');
            const allHoliday = allDates.length > 0 && nonWorking.length === allDates.length;
            if (allHoliday) {
                unavoidableCount += 1;
                unavoidableDetails.push({
                    visitNumber,
                    visitLabel: label,
                    dates: nonWorking
                });
            }
        }

        if (i < count - 1) {
            baseDate = addDays(baseDate, frequencyValues[i]);
        }
    }

    return {
        items,
        unavoidableCount,
        unavoidableDetails
    };
};

module.exports = {
    parseNumberList,
    calculatePlan,
    getVisitLabel,
    toDateKey
};
