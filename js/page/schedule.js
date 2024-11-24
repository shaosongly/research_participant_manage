import { db, ProjectOperations, CenterOperations, SubjectOperations } from '../common/db-operations.js';
import { SubjectService } from '../common/subject-service.js';

const { createApp, ref, onMounted } = Vue;

const SchedulePage = {
    template: `
        <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
            <div class="container">
                <a class="navbar-brand" href="landing.html">受试者管理系统</a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav ms-auto">
                        <li class="nav-item" v-for="item in navItems" :key="item.path">
                            <a class="nav-link" :class="{ active: item.active }" :href="item.path">{{ item.text }}</a>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>

        <div class="container">
            <h1 class="mb-4 text-center">今日访视安排</h1>
            <div class="card mb-4">
                <div class="card-body">
                    <div class="row align-items-end">
                        <div class="col-md-3 mb-3 mb-md-0">
                            <label for="projectFilter" class="form-label">项目筛选:</label>
                            <select class="form-select" id="projectFilter" v-model="selectedProject" @change="onProjectChange">
                                <option value="">全部项目</option>
                                <option v-for="project in projects" :key="project.projectName" :value="project.projectName">
                                    {{ project.projectName }}
                                </option>
                            </select>
                        </div>
                        <div class="col-md-3 mb-3 mb-md-0">
                            <label for="centerFilter" class="form-label">中心筛选:</label>
                            <select class="form-select" id="centerFilter" v-model="selectedCenter" @change="loadSchedule">
                                <option value="">全部中心</option>
                                <option v-for="center in centers" :key="center.centerName" :value="center.centerName">
                                    {{ center.centerName }}
                                </option>
                            </select>
                        </div>
                        <div class="col-md-4 mb-3 mb-md-0">
                            <label for="dateRange" class="form-label">选择日期范围:</label>
                            <input type="text" class="form-control" id="dateRange" ref="datePickerInput">
                        </div>
                        <div class="col-md-2">
                            <button @click="loadSchedule" class="btn btn-primary w-100">刷新访视安排</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <table id="scheduleTable" class="table table-visits table-hover">
                        <thead>
                            <tr>
                                <th>项目</th>
                                <th>中心</th>
                                <th>受试者名称</th>
                                <th>访视次数</th>
                                <th>窗口期最早日期</th>
                                <th>基准日期</th>
                                <th>窗口期最晚日期</th>
                            </tr>
                        </thead>
                        <tbody>
                            <template v-if="scheduleItems.length">
                                <tr v-for="(item, index) in scheduleItems" 
                                    :key="index"
                                    :class="getVisitGroupClass(item, index)">
                                    <td>{{ item.project }}</td>
                                    <td>{{ item.center }}</td>
                                    <td>{{ item.name }}</td>
                                    <td>第 {{ item.visitNumber }} 次访视</td>
                                    <td :style="getWindowStyle(item)">
                                        {{ formatWindowDate(item.earliestDate, item.baseDate) }}
                                    </td>
                                    <td>{{ formatDate(item.baseDate) }}</td>
                                    <td :style="getWindowStyle(item)">
                                        {{ formatWindowDate(item.latestDate, item.baseDate) }}
                                    </td>
                                </tr>
                            </template>
                            <tr v-else>
                                <td colspan="7" class="text-center">
                                    {{ error || '所选日期范围内无访视安排' }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="text-center mt-4">
                <a href="landing.html" class="btn btn-info">返回首页</a>
            </div>
        </div>
    `,

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