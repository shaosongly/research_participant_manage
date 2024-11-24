import { ProjectOperations, CenterOperations, SubjectOperations, VisitRecordOperations } from '../common/db-operations.js';

const { createApp } = Vue;

// 确保 Dexie 已初始化
if (!window.Dexie) {
    throw new Error('Dexie is not loaded');
}

createApp({
    data() {
        return {
            projects: [],
            centers: [],
            reminderCenters: [],
            violations: [],
            reminders: [],
            filters: {
                project: '',
                center: ''
            },
            reminderFilters: {
                project: '',
                center: '',
                date: new Date().toISOString().split('T')[0]
            }
        };
    },

    computed: {
        sortedViolations() {
            return [...this.violations].sort((a, b) => b.overdueDays - a.overdueDays);
        },
        sortedReminders() {
            return [...this.reminders].sort((a, b) => b.overdueDays - a.overdueDays);
        }
    },

    methods: {
        // 保留原有的计算计划访视日期方法
        calculatePlannedVisits(subject) {
            const firstDate = new Date(subject.firstDate);
            const totalVisits = parseInt(subject.totalVisits);
            const plannedVisits = [];

            // 解析访视间隔
            let frequencies = [];
            if (subject.frequency.includes(',')) {
                frequencies = subject.frequency.split(',').map(Number);
            } else {
                const fixedFrequency = parseInt(subject.frequency);
                frequencies = Array(totalVisits - 1).fill(fixedFrequency);
            }

            // 解析访视窗口
            let visitWindows = [];
            if (subject.visitWindow && subject.visitWindow.trim() !== '') {
                const windowValue = subject.visitWindow.trim();
                if (windowValue.includes(',')) {
                    visitWindows = windowValue.split(',').map(Number);
                } else {
                    const fixedWindow = parseInt(windowValue);
                    visitWindows = Array(totalVisits - 1).fill(fixedWindow);
                }
            } else {
                visitWindows = Array(totalVisits - 1).fill(0);
            }

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
        },

        formatDate(date) {
            if (!date) return '';
            const d = new Date(date);
            return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
        },

        async loadProjects() {
            try {
                this.projects = await ProjectOperations.getAllProjects();
            } catch (error) {
                console.error('加载项目列表失败:', error);
                alert('加载项目列表失败，请刷新页面重试');
            }
        },

        async loadCenters(projectName, type = 'violation') {
            try {
                const centers = projectName ?
                    await CenterOperations.getCentersForProject(projectName) :
                    await CenterOperations.getAllCenters();
                
                if (type === 'violation') {
                    this.centers = centers;
                } else {
                    this.reminderCenters = centers;
                }
            } catch (error) {
                console.error('加载中心列表失败:', error);
                alert('加载中心列表失败');
            }
        },

        async onProjectChange(type) {
            const projectName = type === 'violation' ? this.filters.project : this.reminderFilters.project;
            if (type === 'violation') {
                this.filters.center = '';
            } else {
                this.reminderFilters.center = '';
            }
            await this.loadCenters(projectName, type);
        },

        async checkViolations() {
            try {
                // 1. 获取符合条件的受试者
                let subjects;
                if (this.filters.project && this.filters.center) {
                    subjects = await SubjectOperations.getSubjectsForProjectCenter(
                        this.filters.project,
                        this.filters.center
                    );
                } else {
                    subjects = await SubjectOperations.getAllSubjects();
                    if (this.filters.project) {
                        subjects = subjects.filter(subject => subject.project === this.filters.project);
                    }
                    if (this.filters.center) {
                        subjects = subjects.filter(subject => subject.center === this.filters.center);
                    }
                }

                const violations = [];

                // 3. 检查每个受试者的访视记录
                for (const subject of subjects) {
                    const plannedVisits = this.calculatePlannedVisits(subject);
                    const subjectVisits = await VisitRecordOperations.getVisitRecordsForSubject(
                        subject.project,
                        subject.center,
                        subject.name
                    );

                    // 检查每条实际访视记录是否超窗
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
                }

                this.violations = violations;
            } catch (error) {
                console.error('检查超窗记录失败:', error);
                alert('检查失败，请重试');
            }
        },

        async checkReminders() {
            if (!this.reminderFilters.date) {
                alert('请选择截止日期');
                return;
            }

            try {
                // 1. 获取符合条件的受试者
                let subjects;
                if (this.reminderFilters.project && this.reminderFilters.center) {
                    subjects = await SubjectOperations.getSubjectsForProjectCenter(
                        this.reminderFilters.project,
                        this.reminderFilters.center
                    );
                } else {
                    subjects = await SubjectOperations.getAllSubjects();
                    if (this.reminderFilters.project) {
                        subjects = subjects.filter(subject => subject.project === this.reminderFilters.project);
                    }
                    if (this.reminderFilters.center) {
                        subjects = subjects.filter(subject => subject.center === this.reminderFilters.center);
                    }
                }

                const checkDate = new Date(this.reminderFilters.date);
                const reminders = [];

                // 3. 检查每个受试者的访视记录
                for (const subject of subjects) {
                    const plannedVisits = this.calculatePlannedVisits(subject);
                    const subjectVisits = await VisitRecordOperations.getVisitRecordsForSubject(
                        subject.project,
                        subject.center,
                        subject.name
                    );

                    // 检查每次计划访视是否已完成
                    plannedVisits.forEach((plannedVisit, index) => {
                        if (index === 0) return; // 跳过首次访视

                        const visitNumber = index + 1;
                        const hasVisitRecord = subjectVisits.some(visit => visit.visitNumber === visitNumber);

                        if (!hasVisitRecord && plannedVisit.latestDate < checkDate) {
                            const overdueDays = Math.ceil((checkDate - plannedVisit.latestDate) / (1000 * 60 * 60 * 24));
                            reminders.push({
                                id: `${subject.project}-${subject.center}-${subject.name}-${visitNumber}`,
                                project: subject.project,
                                center: subject.center,
                                subject: subject.name,
                                visitNumber: visitNumber,
                                earliestDate: plannedVisit.earliestDate,
                                latestDate: plannedVisit.latestDate,
                                overdueDays: overdueDays
                            });
                        }
                    });
                }

                this.reminders = reminders;
            } catch (error) {
                console.error('检查超窗提醒失败:', error);
                alert('检查失败，请重试');
            }
        }
    },

    async mounted() {
        await this.loadProjects();
        await this.loadCenters();
    }
}).mount('#app');