import { ProjectOperations, CenterOperations, SubjectOperations } from '../common/db-operations.js';
import { SubjectService } from '../common/subject-service.js';

const { createApp, ref, onMounted } = Vue;

const SchedulePage = {
    template: '#schedule-page-template',
    setup() {
        const projects = ref([]);
        const centers = ref([]);
        const scheduleItems = ref([]);
        const selectedProject = ref('');
        const selectedCenter = ref('');
        const error = ref('');
        const datePickerInput = ref(null);
        let datePicker = null;
        let lastVisitGroup = null;
        let isEvenGroup = true;

        const navItems = [
            { path: 'landing.html', text: '首页', active: false },
            { path: 'project_manage.html', text: '项目管理', active: false },
            { path: 'index.html', text: '添加受试者', active: false },
            { path: 'view.html', text: '查看受试者', active: false },
            { path: 'schedule.html', text: '访视安排', active: true },
            { path: 'visit_plan.html', text: '访视计划', active: false },
            { path: 'visit_record.html', text: '访视记录', active: false },
            { path: 'window_check.html', text: '超窗检查', active: false }
        ];

        onMounted(async () => {
            await initializePage();
        });

        async function initializePage() {
            await loadProjects();
            await loadCenters();
            initializeDatePicker();
            const today = new Date();
            loadSchedule();
        }

        function initializeDatePicker() {
            datePicker = flatpickr(datePickerInput.value, {
                mode: "range",
                dateFormat: "Y-m-d",
                locale: "zh",
                defaultDate: [new Date(), new Date()],
                altInput: true,
                altFormat: "Y年m月d日",
                onChange: function (selectedDates) {
                    if (selectedDates.length === 2) {
                        loadSchedule();
                    }
                }
            });
        }

        async function loadProjects() {
            try {
                projects.value = await ProjectOperations.getAllProjects();
            } catch (error) {
                console.error('加载项目列表失败:', error);
            }
        }

        async function loadCenters() {
            try {
                if (selectedProject.value) {
                    centers.value = await CenterOperations.getCentersForProject(selectedProject.value);
                } else {
                    centers.value = await CenterOperations.getAllCenters();
                }
            } catch (error) {
                console.error('加载中心列表失败:', error);
            }
        }

        async function onProjectChange() {
            await loadCenters();
            selectedCenter.value = '';
            loadSchedule();
        }

        async function loadSchedule() {
            try {
                const dates = datePicker.selectedDates;
                if (dates.length !== 2) {
                    error.value = '请选择完整的日期范围';
                    return;
                }

                const [startDate, endDate] = dates;
                error.value = '';
                scheduleItems.value = [];

                // 获取并筛选受试者
                let subjects = await SubjectOperations.getAllSubjects();
                subjects = subjects.filter(subject => {
                    return (!selectedProject.value || subject.project === selectedProject.value) &&
                           (!selectedCenter.value || subject.center === selectedCenter.value);
                });

                const items = [];
                
                // 使用 SubjectService 处理每个受试者的访视计划
                for (const subject of subjects) {
                    const plannedVisits = SubjectService.calculatePlannedVisits(subject);
                    if (!plannedVisits) continue;

                    // 为每次访视创建日程项
                    plannedVisits.forEach((visit, visitNum) => {
                        const scheduleItem = {
                            project: subject.project,
                            center: subject.center,
                            name: subject.name,
                            visitNumber: visitNum + 1,
                            baseDate: visit.baseDate,
                            earliestDate: visit.earliestDate,
                            latestDate: visit.latestDate
                        };

                        // 检查访视日期是否在选定的日期范围内
                        const dateToCheck = visitNum === 0 ? visit.baseDate : visit.earliestDate;
                        const normalizedDateToCheck = new Date(dateToCheck.setHours(0, 0, 0, 0));
                        const normalizedStartDate = new Date(startDate.setHours(0, 0, 0, 0));
                        const normalizedEndDate = new Date(endDate.setHours(23, 59, 59, 999));

                        if (normalizedDateToCheck >= normalizedStartDate && 
                            normalizedDateToCheck <= normalizedEndDate) {
                            items.push(scheduleItem);
                        }
                    });
                }

                // 排序
                items.sort((a, b) => {
                    const dateCompare = a.baseDate - b.baseDate;
                    if (dateCompare !== 0) return dateCompare;
                    if (a.name !== b.name) return a.name.localeCompare(b.name);
                    return a.visitNumber - b.visitNumber;
                });

                scheduleItems.value = items;

            } catch (error) {
                console.error('加载访视安排失败:', error);
                error.value = '加载访视安排时出错';
            }
        }

        function getVisitGroupClass(item, index) {
            const currentVisitGroup = `${item.project}-${item.center}-${item.name}`;
            if (currentVisitGroup !== lastVisitGroup) {
                isEvenGroup = !isEvenGroup;
                lastVisitGroup = currentVisitGroup;
            }
            return isEvenGroup ? 'visit-group-even' : 'visit-group-odd';
        }

        function getWindowStyle(item) {
            return {
                color: item.earliestDate.getTime() === item.baseDate.getTime() ? '#666' : '#0066cc'
            };
        }

        function formatDate(date) {
            return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
        }

        function formatWindowDate(date, baseDate) {
            return date.getTime() === baseDate.getTime() ? '无窗口期' : formatDate(date);
        }

        return {
            projects,
            centers,
            scheduleItems,
            selectedProject,
            selectedCenter,
            error,
            datePickerInput,
            navItems,
            loadSchedule,
            onProjectChange,
            formatDate,
            formatWindowDate,
            getVisitGroupClass,
            getWindowStyle
        };
    }
};

// 创建 Vue 应用
const app = createApp({
    components: {
        'schedule-page': SchedulePage
    }
});

// 挂载应用
app.mount('#app');