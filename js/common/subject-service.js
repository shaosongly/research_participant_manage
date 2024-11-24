import { SubjectOperations, VisitRecordOperations } from './db-operations.js';

export class SubjectService {
    /**
     * 计算受试者的计划访视日期
     * @param {Object} subject - 受试者对象
     * @returns {Array} 计划访视数组，每个元素包含 baseDate, earliestDate, latestDate
     */
    static calculatePlannedVisits(subject) {
        const firstDate = new Date(subject.firstDate);
        const totalVisits = parseInt(subject.totalVisits);
        const plannedVisits = [];

        // 解析访视间隔
        const frequencies = this.parseFrequencies(subject.frequency, totalVisits);
        if (!frequencies) return null;

        // 解析访视窗口
        const visitWindows = this.parseVisitWindows(subject.visitWindow, totalVisits);
        if (!visitWindows) return null;

        // 计算每次访视的日期
        let currentDate = new Date(firstDate);
        plannedVisits.push({
            baseDate: new Date(currentDate),
            earliestDate: new Date(currentDate),
            latestDate: new Date(currentDate)
        });

        for (let i = 0; i < frequencies.length; i++) {
            currentDate = new Date(currentDate.getTime() + frequencies[i] * 24 * 60 * 60 * 1000);
            const window = visitWindows[i];

            plannedVisits.push({
                baseDate: new Date(currentDate),
                earliestDate: new Date(currentDate.getTime() - window * 24 * 60 * 60 * 1000),
                latestDate: new Date(currentDate.getTime() + window * 24 * 60 * 60 * 1000)
            });
        }

        return plannedVisits;
    }

    /**
     * 解析访视间隔
     * @param {string} frequency - 访视间隔字符串
     * @param {number} totalVisits - 总访视次数
     * @returns {Array|null} 访视间隔数组
     */
    static parseFrequencies(frequency, totalVisits) {
        try {
            if (frequency.includes(',')) {
                const frequencies = frequency.split(',').map(Number);
                if (frequencies.length !== totalVisits - 1) {
                    throw new Error('访视间隔数量应该等于总访视次数-1');
                }
                return frequencies;
            } else {
                const fixedFrequency = parseInt(frequency);
                return Array(totalVisits - 1).fill(fixedFrequency);
            }
        } catch (error) {
            console.error('解析访视间隔失败:', error);
            return null;
        }
    }

    /**
     * 解析访视窗口
     * @param {string} visitWindow - 访视窗口字符串
     * @param {number} totalVisits - 总访视次数
     * @returns {Array} 访视窗口数组
     */
    static parseVisitWindows(visitWindow, totalVisits) {
        try {
            if (visitWindow && visitWindow.trim() !== '') {
                const windowValue = visitWindow.trim();
                if (windowValue.includes(',')) {
                    const windows = windowValue.split(',').map(Number);
                    if (windows.length !== totalVisits - 1) {
                        throw new Error('访视窗口数量应该等于总访视次数-1');
                    }
                    return windows;
                } else {
                    const fixedWindow = parseInt(windowValue);
                    return Array(totalVisits - 1).fill(fixedWindow);
                }
            }
            return Array(totalVisits - 1).fill(0);
        } catch (error) {
            console.error('解析访视窗口失败:', error);
            return null;
        }
    }

    /**
     * 检查受试者的访视记录是否超窗
     * @param {Object} subject - 受试者对象
     * @param {Date} checkDate - 检查日期
     * @returns {Promise<Array>} 超窗记录数组
     */
    static async checkVisitViolations(subject, checkDate) {
        try {
            const plannedVisits = this.calculatePlannedVisits(subject);
            const subjectVisits = await VisitRecordOperations.getVisitRecordsForSubject(
                subject.project,
                subject.center,
                subject.name
            );

            const violations = [];
            subjectVisits.forEach(visit => {
                const plannedVisit = plannedVisits[visit.visitNumber - 1];
                if (!plannedVisit) return;

                const actualDate = new Date(visit.visitDate);
                const latestDate = plannedVisit.latestDate;

                if (actualDate > latestDate) {
                    const overdueDays = Math.ceil((actualDate - latestDate) / (1000 * 60 * 60 * 24));
                    violations.push({
                        id: `${visit.project}-${visit.center}-${visit.subjectName}-${visit.visitNumber}`,
                        project: visit.project,
                        center: visit.center,
                        subject: visit.subjectName,
                        visitNumber: visit.visitNumber,
                        actualDate: actualDate,
                        earliestDate: plannedVisit.earliestDate,
                        latestDate: latestDate,
                        overdueDays: overdueDays
                    });
                }
            });

            return violations;
        } catch (error) {
            console.error('检查访视超窗失败:', error);
            throw error;
        }
    }
} 