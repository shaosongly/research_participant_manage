import { ProjectOperations, CenterOperations, SubjectOperations } from '../common/db-operations.js';
import { SubjectService } from '../common/subject-service.js';

const { createApp, ref, onMounted } = Vue;

const VisitPlanPage = {
    template: '#visit-plan-template',
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
            try {
                // 使用 SubjectService 计算访视计划
                const plannedVisits = SubjectService.calculatePlannedVisits(subject);
                
                if (!plannedVisits) {
                    alert('生成访视计划失败，请检查访视间隔和窗口设置');
                    return;
                }

                // 生成访视计划表格数据
                const plan = [];

                plannedVisits.forEach((visit, index) => {
                    const visitNum = index + 1;
                    const window = index === 0 ? 0 : 
                        Math.ceil((visit.latestDate - visit.earliestDate) / (1000 * 60 * 60 * 24) / 2);

                    if (window === 0) {
                        // 无窗口期的访视（首次访视或窗口为0）
                        plan.push(createVisitEntry(visitNum, visit.baseDate, '基准日期', true));
                    } else {
                        // 有窗口期的访视
                        // 添加最早日期
                        plan.push(createVisitEntry(
                            visitNum, 
                            visit.earliestDate, 
                            `提前${window}天`, 
                            false
                        ));

                        // 添加基准日期
                        plan.push(createVisitEntry(
                            visitNum, 
                            visit.baseDate, 
                            '基准日期', 
                            true
                        ));

                        // 添加最晚日期
                        plan.push(createVisitEntry(
                            visitNum, 
                            visit.latestDate, 
                            `延后${window}天`, 
                            false
                        ));
                    }
                });

                visitPlan.value = plan;
            } catch (error) {
                console.error('生成访视计划失败:', error);
                alert('生成访视计划失败: ' + error.message);
            }
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