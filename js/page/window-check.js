import { ProjectOperations, CenterOperations, SubjectOperations, VisitRecordOperations } from '../common/db-operations.js';
import { SubjectService } from '../common/subject-service.js';

const { createApp } = Vue;

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
                let subjects = await SubjectOperations.getAllSubjects();
                if (this.filters.project) {
                    subjects = subjects.filter(subject => subject.project === this.filters.project);
                }
                if (this.filters.center) {
                    subjects = subjects.filter(subject => subject.center === this.filters.center);
                }

                const allViolations = [];
                for (const subject of subjects) {
                    const violations = await SubjectService.checkVisitViolations(subject);
                    allViolations.push(...violations);
                }

                this.violations = allViolations;
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
                let subjects = await SubjectOperations.getAllSubjects();
                if (this.reminderFilters.project) {
                    subjects = subjects.filter(subject => subject.project === this.reminderFilters.project);
                }
                if (this.reminderFilters.center) {
                    subjects = subjects.filter(subject => subject.center === this.reminderFilters.center);
                }

                const checkDate = new Date(this.reminderFilters.date);
                const reminders = [];

                for (const subject of subjects) {
                    const plannedVisits = SubjectService.calculatePlannedVisits(subject);
                    if (!plannedVisits) continue;

                    const subjectVisits = await VisitRecordOperations.getVisitRecordsForSubject(
                        subject.project,
                        subject.center,
                        subject.name
                    );

                    plannedVisits.forEach((plannedVisit, index) => {
                        if (index === 0) return;

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