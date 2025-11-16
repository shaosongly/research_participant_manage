import { ProjectOperations, CenterOperations, SubjectOperations, HolidayOverrideOperations, VisitPlanSnapshotOperations } from '../common/db-operations.js';
import { SubjectService } from '../common/subject-service.js';

HolidayUtil.fix('202212310120230101202301010120230101202301020120230101202301211120230122202301221120230122202301231120230122202301241120230122202301251120230122202301261120230122202301271120230122202301281020230122202301291020230122202304052120230405202304233020230501202304293120230501202304303120230501202305013120230501202305023120230501202305033120230501202305063020230501202306224120230622202306234120230622202306244120230622202306254020230622202309295120230929202309306120231001202310016120231001202310026120231001202310036120231001202310046120231001202310056120231001202310066120231001202310076020231001202310086020231001');
HolidayUtil.fix('202312300120240101202312310120240101202401010120240101202402041020240210202402101120240210202402111120240210202402121120240210202402131120240210202402141120240210202402151120240210202402161120240210202402171120240210202402181020240210202404042120240404202404052120240404202404062120240404202404072020240404202404283020240501202405013120240501202405023120240501202405033120240501202405043120240501202405053120240501202405113020240501202406084120240610202406094120240610202406104120240610202409145020240917202409155120240917202409165120240917202409175120240917202409296020241001202410016120241001202410026120241001202410036120241001202410046120241001202410056120241001202410066120241001202410076120241001202410126020241001');
HolidayUtil.fix('202501010120250101202501261020250129202501281120250129202501291120250129202501301120250129202501311120250129202502011120250129202502021120250129202502031120250129202502041120250129202502081020250129202504042120250404202504052120250404202504062120250404202504273020250501202505013120250501202505023120250501202505033120250501202505043120250501202505053120250501202505314120250531202506014120250531202506024120250531202509287020251001202510017120251001202510027120251001202510037120251001202510047120251001202510057120251001202510067120251001202510077120251001202510087120251001202510117020251001');
HolidayUtil.fix('202601010120260101202601020120260101202601030120260101202601040020260101202602141020260217202602151120260217202602161120260217202602171120260217202602181120260217202602191120260217202602201120260217202602211120260217202602221120260217202602231120260217202602281020260217202604042120260405202604052120260405202604062120260405202605013120260501202605023120260501202605033120260501202605043120260501202605053120260501202605093020260501202606194120260619202606204120260619202606214120260619202609206020261001202609255120260925202609265120260925202609275120260925202610016120261001202610026120261001202610036120261001202610046120261001202610056120261001202610066120261001202610076120261001202610106020261001');

const { createApp, ref, onMounted, nextTick, onUnmounted } = Vue;

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
        const manualHolidayMap = ref(new Map());

        // 添加新的响应式状态
        const visitStats = ref({
            totalVisits: 0,
            unavoidableHolidayVisits: 0,
            unavoidableHolidayDetails: []
        });

        // 导航项
        const navItems = [
            { path: 'landing.html', text: '首页', active: false },
            { path: 'project_manage.html', text: '项目管理', active: false },
            { path: 'index.html', text: '添加受试者', active: false },
            { path: 'view.html', text: '查看受试者', active: false },
            { path: 'schedule.html', text: '访视安排', active: false },
            { path: 'visit_plan.html', text: '访视计划', active: true },
            { path: 'visit_record.html', text: '访视记录', active: false },
            { path: 'window_check.html', text: '超窗检查', active: false },
            { path: 'visit_plan_history.html', text: '访视计划记录', active: false }
        ];

        // 生命周期钩子
        onMounted(async () => {
            await loadProjects();
            await loadAllSubjects();
            await loadHolidayOverrides();
            initializeDatePicker();

            // 添加点击外部关闭建议列表的事件监听
            document.addEventListener('click', (event) => {
                if (!event.target.closest('#subjectInput') && !event.target.closest('.suggestion-list')) {
                    showSuggestions.value = false;
                }
            });
        });

        onUnmounted(() => {
            if (datePicker) {
                datePicker.destroy();
            }
        });

        // 方法定义
        const loadProjects = async () => {
            try {
                const projectList = await ProjectOperations.getAllProjects();
                projects.value = projectList.map(project => project.projectName);
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

        const loadHolidayOverrides = async () => {
            try {
                const overrides = await HolidayOverrideOperations.getAllOverrides();
                const overrideMap = new Map();
                overrides.forEach(override => {
                    overrideMap.set(override.date, override);
                });
                manualHolidayMap.value = overrideMap;
            } catch (error) {
                console.error('加载自定义节假日失败:', error);
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
                    console.log('Selected project:', selectedProject.value);
                    const centerList = await CenterOperations.getCentersForProject(selectedProject.value);
                    console.log('Center list:', centerList);

                    if (centerList && centerList.length > 0) {
                        centers.value = centerList.map(center => center.centerName);
                    } else {
                        console.warn('No centers found for project:', selectedProject.value);
                    }
                } catch (error) {
                    console.error('加载中心列表失败:', error);
                    alert('加载中心列表失败: ' + error.message);
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
            updateFilteredSubjects(input);
        };

        const updateFilteredSubjects = (input = '') => {
            filteredSubjects.value = allSubjects.value.filter(subject =>
                subject.project === selectedProject.value &&
                subject.center === selectedCenter.value &&
                (!input || subject.name.toLowerCase().includes(input))
            );
            showSuggestions.value = true;
        };

        const onSubjectInputFocus = () => {
            if (!selectedProject.value || !selectedCenter.value) {
                alert('请先选择项目和中心');
                return;
            }
            updateFilteredSubjects();
        };

        const selectSubject = (subject) => {
            subjectInput.value = subject.name;
            currentSubject.value = subject;
            showSuggestions.value = false;
            generateVisitPlan(subject);

            // 等待 DOM 更新后初始化日期选择器
            nextTick(() => {
                initializeDatePicker();
                if (datePicker && subject.firstDate) {
                    datePicker.setDate(new Date(subject.firstDate));
                }
            });
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

                const plan = [];
                let unavoidableHolidayCount = 0;
                const unavoidableDetails = [];

                // 用于临时存储每次访视的所有日期
                const visitDates = new Map();

                plannedVisits.forEach((visit, index) => {
                    const visitNum = index + 1;
                    const window = index === 0 ? 0 :
                        Math.ceil((visit.latestDate - visit.earliestDate) / (1000 * 60 * 60 * 24) / 2);

                    // 收集这次访视的所有可能日期
                    const allDatesInWindow = [];
                    let currentDate = new Date(visit.earliestDate);
                    while (currentDate <= visit.latestDate) {
                        allDatesInWindow.push(new Date(currentDate));
                        currentDate.setDate(currentDate.getDate() + 1);
                    }

                    const dateInfos = allDatesInWindow.map(date => {
                        const isoDate = new Date(date);
                        return {
                            dateISO: isoDate.toISOString(),
                            holidayInfo: getHolidayInfo(date)
                        };
                    });
                    const holidayOnlyDates = dateInfos.filter(info => info.holidayInfo !== '非节假日');

                    // 检查窗口内是否存在有效日期，且全部属于节假日
                    const allHolidays = holidayOnlyDates.length > 0 &&
                        holidayOnlyDates.length === dateInfos.length;

                    if (allHolidays) {
                        unavoidableHolidayCount++;
                        unavoidableDetails.push({
                            visitNumber: visitNum,
                            dates: holidayOnlyDates
                        });
                    }

                    if (window === 0) {
                        // 无窗口期的访视（首次访视或窗口为0）
                        plan.push(createVisitEntry(visitNum, visit.baseDate, '基准日期', true));
                    } else {
                        plan.push(createVisitEntry(visitNum, visit.earliestDate, `提前${window}天`, false));
                        plan.push(createVisitEntry(visitNum, visit.baseDate, '基准日期', true));
                        plan.push(createVisitEntry(visitNum, visit.latestDate, `延后${window}天`, false));
                    }
                });

                visitPlan.value = plan;
                
                // 更新统计信息
                console.log('不可避节假日详情：', unavoidableDetails);
                visitStats.value = {
                    totalVisits: plannedVisits.length,
                    unavoidableHolidayVisits: unavoidableHolidayCount,
                    unavoidableHolidayDetails: unavoidableDetails
                };

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
                    'visit-base-date': isBaseDate,
                    'visit-window-date': !isBaseDate,
                    'font-medium': isBaseDate,
                    'text-gray-900': isBaseDate,
                    'text-gray-600': !isBaseDate,
                    'holiday-row': isHoliday
                },
                dateStyle: {
                    color: !isBaseDate ? '#666' : 'inherit',
                    fontWeight: isBaseDate ? '500' : 'normal'
                },
                holidayStyle: {
                    color: isHoliday ? (isBaseDate ? '#dc2626' : '#ef4444') : 'inherit',
                    fontWeight: isHoliday ? '500' : 'normal'
                }
            };
        };

        const initializeDatePicker = () => {
            nextTick(() => {
                try {
                    const dateInput = document.getElementById('adjustDate');
                    if (!dateInput) {
                        console.error('Date input element not found');
                        return;
                    }

                    if (datePicker) {
                        datePicker.destroy();
                    }

                    datePicker = flatpickr("#adjustDate", {
                        dateFormat: "Y-m-d",
                        locale: "zh",
                        enableTime: false,
                        altInput: true,
                        altFormat: "Y年m月d日",
                        theme: "material_blue",
                        defaultDate: currentSubject.value?.firstDate,
                        onChange: function (selectedDates, dateStr) {
                            console.log('Date selected:', dateStr);
                            dateInput.dataset.selectedDate = dateStr;
                        },
                        onOpen: function () {
                            console.log('Calendar opened');
                        },
                        onClose: function () {
                            console.log('Calendar closed');
                        }
                    });

                    console.log('DatePicker initialized');
                } catch (error) {
                    console.error('Error initializing datepicker:', error);
                }
            });
        };

        const adjustVisitPlan = () => {
            const dateInput = document.getElementById('adjustDate');
            const newDate = dateInput?.dataset.selectedDate;

            if (!newDate) {
                alert('请选择新的访视日期');
                return;
            }

            if (currentSubject.value) {
                try {
                    const adjustedSubject = {
                        ...currentSubject.value,
                        firstDate: new Date(newDate)
                    };

                    currentSubject.value = adjustedSubject;
                    generateVisitPlan(adjustedSubject);
                } catch (error) {
                    console.error('调整访视计划失败:', error);
                    alert('调整访视计划失败: ' + error.message);
                }
            }
        };

        const formatDate = (date) => {
            const d = new Date(date);
            return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
        };

        const saveVisitPlanSnapshot = async () => {
            if (!visitPlan.value.length || !currentSubject.value) {
                alert('请先生成访视计划');
                return;
            }

            try {
                const normalizedDetails = (visitStats.value.unavoidableHolidayDetails || []).map(detail => ({
                    visitNumber: detail.visitNumber,
                    dates: (detail.dates || []).map(dateInfo => ({
                        dateISO: dateInfo.dateISO,
                        holidayInfo: dateInfo.holidayInfo
                    }))
                }));

                const payload = {
                    project: selectedProject.value,
                    center: selectedCenter.value,
                    subjectName: currentSubject.value.name,
                    frequency: currentSubject.value.frequency || '',
                    visitWindow: currentSubject.value.visitWindow || '',
                    firstVisitDate: currentSubject.value.firstDate ? new Date(currentSubject.value.firstDate).toISOString() : null,
                    totalVisits: visitStats.value.totalVisits,
                    unavoidableCount: visitStats.value.unavoidableHolidayVisits,
                    unavoidableDetails: normalizedDetails,
                    createdAt: new Date()
                };

                await VisitPlanSnapshotOperations.addSnapshot(payload);
                alert('访视计划已保存到记录，可在“访视计划记录”页面查看。');
            } catch (error) {
                console.error('保存访视计划失败:', error);
                alert('保存访视计划失败，请稍后重试');
            }
        };

        const getDateKey = (date) => {
            const d = new Date(date);
            if (Number.isNaN(d.getTime())) {
                return '';
            }
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${d.getFullYear()}-${month}-${day}`;
        };

        const refreshHolidayOverrides = async () => {
            await loadHolidayOverrides();
            if (currentSubject.value) {
                generateVisitPlan(currentSubject.value);
            }
        };

        const getHolidayInfo = (date) => {
            try {
                const manualKey = getDateKey(date);
                if (manualKey) {
                    const override = manualHolidayMap.value.get(manualKey);
                    if (override) {
                        return override.isHoliday
                            ? (override.holidayName?.trim() || '自定义节假日')
                            : '非节假日';
                    }
                }

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
            visitStats,

            // 方法
            handleProjectChange,
            handleCenterChange,
            handleSubjectInput,
            onSubjectInputFocus,
            searchSubject,
            selectSubject,
            formatDate,
            saveVisitPlanSnapshot,
            adjustVisitPlan,
            initializeDatePicker,
            refreshHolidayOverrides
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
