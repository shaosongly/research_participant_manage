import { db, ProjectOperations, CenterOperations, SubjectOperations } from '../common/db-operations.js';

const { createApp, ref, onMounted, watch } = Vue;

const VisitPlanPage = {
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
            <!-- 搜索卡片 -->
            <div class="card mb-4">
                <div class="card-body">
                    <div class="row align-items-end">
                        <div class="col-md-3 mb-3 mb-md-0">
                            <label for="projectSelect" class="form-label">选择项目:</label>
                            <select class="form-select" v-model="selectedProject" @change="handleProjectChange">
                                <option value="">请选择项目</option>
                                <option v-for="project in projects" :key="project.projectName" :value="project.projectName">
                                    {{ project.projectName }}
                                </option>
                            </select>
                        </div>
                        <div class="col-md-3 mb-3 mb-md-0">
                            <label for="centerSelect" class="form-label">选择中心:</label>
                            <select class="form-select" v-model="selectedCenter" @change="handleCenterChange">
                                <option value="">请先选择项目</option>
                                <option v-for="center in centers" :key="center.centerName" :value="center.centerName">
                                    {{ center.centerName }}
                                </option>
                            </select>
                        </div>
                        <div class="col-md-4 mb-3 mb-md-0">
                            <label for="subjectInput" class="form-label">输入受试者:</label>
                            <input class="form-control" v-model="subjectInput" 
                                   @input="handleSubjectInput"
                                   @focus="showSuggestions = true"
                                   type="text" 
                                   placeholder="请输入受试者姓名" 
                                   autocomplete="off">
                            <div class="suggestion-list" v-show="showSuggestions && filteredSubjects.length > 0"
                                 style="display: block;">
                                <div v-for="subject in filteredSubjects" 
                                     :key="subject.id"
                                     class="suggestion-item"
                                     @click="selectSubject(subject)">
                                    {{ subject.name }}
                                </div>
                            </div>
                        </div>
                        <div class="col-md-2">
                            <button class="btn btn-primary w-100" @click="searchSubject">查询</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 受试者信息卡片 -->
            <div class="card mb-4" v-if="currentSubject" style="display: block;">
                <div class="card-header">
                    <h5 class="card-title mb-0">受试者基本信息</h5>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-4">
                            <p><strong>姓名：</strong>{{ currentSubject.name }}</p>
                        </div>
                        <div class="col-md-4">
                            <p><strong>首次访视日期：</strong>{{ formatDate(currentSubject.firstDate) }}</p>
                        </div>
                        <div class="col-md-4">
                            <p><strong>访视间隔(天)：</strong>{{ currentSubject.frequency }}</p>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-4">
                            <p><strong>总访视次数：</strong>{{ currentSubject.totalVisits }}</p>
                        </div>
                        <div class="col-md-8">
                            <p><strong>访视窗口(天)：</strong>{{ currentSubject.visitWindow || '未设置' }}</p>
                        </div>
                    </div>

                    <!-- 计划调整部分 -->
                    <hr>
                    <div class="row">
                        <div class="col-12">
                            <h6 class="mb-3">计划调整</h6>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="adjustDate" class="form-label">调整首次访视日期：</label>
                                <input type="text" class="form-control" id="adjustDate" placeholder="选择日期">
                            </div>
                        </div>
                        <div class="col-md-6 d-flex align-items-end">
                            <button class="btn btn-primary mb-3" @click="adjustVisitPlan">更新访视计划</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 访视计划表格 -->
            <div class="card" v-if="visitPlan.length > 0" style="display: block;">
                <div class="card-header">
                    <h5 class="card-title mb-0">访视计划详情</h5>
                </div>
                <div class="card-body">
                    <table class="table table-visits">
                        <thead>
                            <tr>
                                <th>访视次数</th>
                                <th>计划访视日期</th>
                                <th>节假日信息</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="visit in visitPlan" 
                                :key="visit.visitNumber"
                                :class="visit.rowClasses">
                                <td>第 {{ visit.visitNumber }} 次访视</td>
                                <td :style="visit.dateStyle">
                                    {{ formatDate(visit.date) }} ({{ visit.dateType }})
                                </td>
                                <td :style="visit.holidayStyle">{{ visit.holidayInfo }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 导航按钮 -->
            <div class="text-center mt-4">
                <a href="landing.html" class="btn btn-info">返回首页</a>
            </div>
        </div>
    `,

    setup() {
        // 响应式状态
        const projects = ref([]);
        const centers = ref([]);
        const selectedProject = ref('');
        const selectedCenter = ref('');
        const subjectInput = ref('');
        const currentSubject = ref(null);
        const visitPlan = ref([]);
        const showSuggestions = ref(false);
        const filteredSubjects = ref([]);
        const allSubjects = ref([]);
        let datePicker = null;

        // 导航项
        const navItems = [
            { path: 'landing.html', text: '首页', active: false },
            { path: 'project_manage.html', text: '项目管理', active: false },
            { path: 'index.html', text: '添加受试者', active: false },
            { path: 'view.html', text: '查看受试者', active: false },
            { path: 'schedule.html', text: '访视安排', active: false },
            { path: 'visit_plan.html', text: '访视计划', active: true },
            { path: 'visit_record.html', text: '访视记录', active: false },
            { path: 'window_check.html', text: '超窗检查', active: false }
        ];

        // 生命周期钩子
        onMounted(async () => {
            await loadProjects();
            await loadAllSubjects();
            initializeDatePicker();

            // 添加点击外部关闭建议列表的事件监听
            document.addEventListener('click', (event) => {
                if (!event.target.closest('#subjectInput') && !event.target.closest('.suggestion-list')) {
                    showSuggestions.value = false;
                }
            });
        });

        // 方法定义
        const loadProjects = async () => {
            try {
                projects.value = await ProjectOperations.getAllProjects();
            } catch (error) {
                console.error('加载项目列表失败:', error);
                alert('加载项目列表失败');
            }
        };

        const loadAllSubjects = async () => {
            try {
                allSubjects.value = await SubjectOperations.getAllSubjects();
            } catch (error) {
                console.error('加载受试者数据失败:', error);
                allSubjects.value = [];
            }
        };

        const handleProjectChange = async () => {
            selectedCenter.value = '';
            subjectInput.value = '';
            currentSubject.value = null;
            visitPlan.value = [];
            centers.value = [];

            if (selectedProject.value) {
                try {
                    centers.value = await CenterOperations.getCentersForProject(selectedProject.value);
                } catch (error) {
                    console.error('加载中心列表失败:', error);
                    alert('加载中心列表失败');
                }
            }
        };

        const handleCenterChange = () => {
            subjectInput.value = '';
            currentSubject.value = null;
            visitPlan.value = [];
        };

        const handleSubjectInput = () => {
            if (!selectedProject.value || !selectedCenter.value) {
                alert('请先选择项目和中心');
                subjectInput.value = '';
                return;
            }

            const input = subjectInput.value.toLowerCase();
            filteredSubjects.value = allSubjects.value.filter(subject => 
                subject.project === selectedProject.value &&
                subject.center === selectedCenter.value &&
                subject.name.toLowerCase().includes(input)
            );
            showSuggestions.value = true;
        };

        const selectSubject = (subject) => {
            subjectInput.value = subject.name;
            currentSubject.value = subject;
            showSuggestions.value = false;
            generateVisitPlan(subject);
        };

        const searchSubject = async () => {
            if (!selectedProject.value || !selectedCenter.value || !subjectInput.value) {
                alert('请填写完整的搜索条件');
                return;
            }

            const subject = allSubjects.value.find(s => 
                s.project === selectedProject.value &&
                s.center === selectedCenter.value &&
                s.name === subjectInput.value
            );

            if (subject) {
                currentSubject.value = subject;
                generateVisitPlan(subject);
            } else {
                alert('未找到匹配的受试者');
                currentSubject.value = null;
                visitPlan.value = [];
            }
        };

        const generateVisitPlan = (subject) => {
            const firstDate = new Date(subject.firstDate);
            const totalVisits = parseInt(subject.totalVisits);
            let frequencies = [];
            let visitWindows = [];

            // 解析访视间隔
            if (subject.frequency.includes(',')) {
                frequencies = subject.frequency.split(',').map(Number);
                if (frequencies.length !== totalVisits - 1) {
                    alert('访视间隔数量应该等于总访视次数-1');
                    return;
                }
            } else {
                const fixedFrequency = parseInt(subject.frequency);
                frequencies = Array(totalVisits - 1).fill(fixedFrequency);
            }

            // 解析访视窗口
            if (subject.visitWindow && subject.visitWindow.trim() !== '') {
                const windowValue = subject.visitWindow.trim();
                if (windowValue.includes(',')) {
                    visitWindows = windowValue.split(',').map(Number);
                    if (visitWindows.length !== totalVisits - 1) {
                        alert('访视窗口数量应该等于总访视次数-1');
                        return;
                    }
                } else {
                    const fixedWindow = parseInt(windowValue);
                    visitWindows = Array(totalVisits - 1).fill(fixedWindow);
                }
            } else {
                visitWindows = Array(totalVisits - 1).fill(0);
            }

            // 生成访视计划
            const plan = [];
            let currentDate = new Date(firstDate);

            // 添加首次访视
            plan.push(createVisitEntry(1, currentDate, '基准日期', true));

            // 生成后续访视
            for (let i = 0; i < frequencies.length; i++) {
                currentDate = new Date(currentDate.getTime() + frequencies[i] * 24 * 60 * 60 * 1000);
                const visitNum = i + 2;
                const window = visitWindows[i];

                if (window === 0) {
                    plan.push(createVisitEntry(visitNum, currentDate, '基准日期', true));
                } else {
                    // 添加窗口期访视
                    for (let offset = -window; offset <= window; offset++) {
                        const windowDate = new Date(currentDate.getTime() + offset * 24 * 60 * 60 * 1000);
                        const dateType = offset === 0 ? '基准日期' : 
                                       offset < 0 ? `提前${Math.abs(offset)}天` : `延后${offset}天`;
                        const isBaseDate = offset === 0;
                        plan.push(createVisitEntry(visitNum, windowDate, dateType, isBaseDate));
                    }
                }
            }

            visitPlan.value = plan;
        };

        const createVisitEntry = (visitNumber, date, dateType, isBaseDate) => {
            const holidayInfo = getHolidayInfo(date);
            const isHoliday = holidayInfo !== '非节假日';

            return {
                visitNumber,
                date,
                dateType,
                holidayInfo,
                rowClasses: {
                    'visit-group-even': visitNumber % 2 === 0,
                    'visit-group-odd': visitNumber % 2 !== 0,
                    'visit-base-date': isBaseDate,
                    'visit-window-date': !isBaseDate
                },
                dateStyle: {
                    color: !isBaseDate ? '#666' : 'inherit'
                },
                holidayStyle: {
                    color: isHoliday ? (isBaseDate ? 'red' : '#d32f2f') : 'inherit'
                }
            };
        };

        const initializeDatePicker = () => {
            datePicker = flatpickr('#adjustDate', {
                dateFormat: "Y-m-d",
                locale: "zh",
                enableTime: false,
                altInput: true,
                altFormat: "Y年m月d日",
                theme: "material_blue"
            });
        };

        const adjustVisitPlan = () => {
            const newDate = document.getElementById('adjustDate').value;
            if (!newDate) {
                alert('请选择新的访视日期');
                return;
            }

            if (currentSubject.value) {
                const adjustedSubject = {
                    ...currentSubject.value,
                    firstDate: new Date(newDate)
                };
                generateVisitPlan(adjustedSubject);
            }
        };

        const formatDate = (date) => {
            const d = new Date(date);
            return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
        };

        const getHolidayInfo = (date) => {
            try {
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                const day = date.getDate();
                const holiday = HolidayUtil.getHoliday(year, month, day);

                if (holiday) {
                    return holiday.isWork() ? `${holiday.getName()}调休` : holiday.getName();
                }

                const weekDay = date.getDay();
                if (weekDay === 0 || weekDay === 6) {
                    return weekDay === 0 ? '周日' : '周六';
                }

                return '非节假日';
            } catch (error) {
                console.error('获取节假日信息失败:', error);
                return '非节假日';
            }
        };

        return {
            // 状态
            projects,
            centers,
            selectedProject,
            selectedCenter,
            subjectInput,
            currentSubject,
            visitPlan,
            showSuggestions,
            filteredSubjects,
            navItems,

            // 方法
            handleProjectChange,
            handleCenterChange,
            handleSubjectInput,
            searchSubject,
            selectSubject,
            formatDate,
            adjustVisitPlan
        };
    }
};

// 创建 Vue 应用
const app = createApp({
    components: {
        'visit-plan-page': VisitPlanPage
    }
});

// 挂载应用
app.mount('#app');