import { db, ProjectOperations, CenterOperations, SubjectOperations } from '../common/db-operations.js';

// 全局变量声明 - 确保在最顶部
let allSubjects = [];
let currentSubject = null;
let lastVisitGroup = '';
let isEvenGroup = true;

//节假日修正
HolidayUtil.fix('202501010120250101202501261020250129202501281120250129202501291120250129202501301120250129202501311120250129202502011120250129202502021120250129202502031120250129202502041120250129202502081020250129202504042120250404202504052120250404202504062120250404202504273020250501202505013120250501202505023120250501202505033120250501202505043120250501202505053120250501202505314120250531202506014120250531202506024120250531202509287020251001202510017120251001202510027120251001202510037120251001202510047120251001202510057120251001202510067120251001202510077120251001202510087120251001202510117020251001');
HolidayUtil.fix('202312300120240101202312310120240101202401010120240101202402041020240210202402101120240210202402111120240210202402121120240210202402131120240210202402141120240210202402151120240210202402161120240210202402171120240210202402181020240210202404042120240404202404052120240404202404062120240404202404072020240404202404283020240501202405013120240501202405023120240501202405033120240501202405043120240501202405053120240501202405113020240501202406084120240610202406094120240610202406104120240610202409145020240917202409155120240917202409165120240917202409175120240917202409296020241001202410016120241001202410026120241001202410036120241001202410046120241001202410056120241001202410066120241001202410076120241001202410126020241001');

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await loadProjects();
        await loadAllSubjects();
        
        // 初始化事件监听器
        initializeEventListeners();
    } catch (error) {
        console.error('初始化失败:', error);
    }
});

// 加载所有受试者数据
async function loadAllSubjects() {
    try {
        allSubjects = await SubjectOperations.getAllSubjects();
    } catch (error) {
        console.error('加载受试者数据失败:', error);
        allSubjects = [];
    }
}

// 初始化事件监听器
function initializeEventListeners() {
    // 搜索相关
    document.getElementById('searchButton').addEventListener('click', searchSubject);
    document.getElementById('subjectInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            searchSubject();
        }
    });
    
    // 输入框相关
    document.getElementById('subjectInput').addEventListener('input', handleInput);
    document.getElementById('subjectInput').addEventListener('keydown', handleKeydown);
    document.getElementById('subjectInput').addEventListener('focus', function (event) {
        handleInput(event);
    });

    // 点击外部关闭建议列表
    document.addEventListener('click', function (event) {
        const suggestionList = document.getElementById('subjectSuggestions');
        if (!event.target.closest('#subjectInput') && !event.target.closest('#subjectSuggestions')) {
            suggestionList.style.display = 'none';
        }
    });

    // 初始化日期选择器
    initializeDatePicker();

    // 计划调整按钮
    document.getElementById('adjustButton').addEventListener('click', function () {
        if (!currentSubject) {
            alert('请先选择受试者');
            return;
        }

        const newDate = document.getElementById('adjustDate').value;
        if (!newDate) {
            alert('请选择新的访视日期');
            return;
        }

        // 创建新的访视计划
        const adjustedSubject = {
            ...currentSubject,
            firstDate: new Date(newDate)
        };

        // 更新显示
        generateVisitPlan(adjustedSubject);
    });
}

// 初始化日期选择器
function initializeDatePicker() {
    flatpickr('#adjustDate', {
        dateFormat: "Y-m-d",
        locale: "zh",
        enableTime: false,
        altInput: true,
        altFormat: "Y年m月d日",
        theme: "material_blue",
        allowInput: true,
        clickOpens: true,
        disableMobile: false
    });
}

// 加载项目列表
async function loadProjects() {
    try {
        const projects = await ProjectOperations.getAllProjects();
        const projectSelect = document.getElementById('projectSelect');
        projectSelect.innerHTML = '<option value="">请选择项目</option>' +
            projects.map(project =>
                `<option value="${project.projectName}">${project.projectName}</option>`
            ).join('');

        // 添加项目选择事件监听器
        projectSelect.addEventListener('change', function() {
            const selectedProject = this.value;
            document.getElementById('subjectInput').value = '';
            if (selectedProject) {
                loadCenters(selectedProject);
            } else {
                document.getElementById('centerSelect').innerHTML = '<option value="">请先选择项目</option>';
            }
        });
    } catch (error) {
        console.error('加载项目列表失败:', error);
    }
}

// 加载中心列表
async function loadCenters(projectName) {
    try {
        const centers = await CenterOperations.getCentersForProject(projectName);
        const centerSelect = document.getElementById('centerSelect');
        centerSelect.innerHTML = '<option value="">请选择中心</option>' +
            centers.map(center =>
                `<option value="${center.centerName}">${center.centerName}</option>`
            ).join('');

        // 添加中心选择事件监听器
        centerSelect.addEventListener('change', function() {
            document.getElementById('subjectInput').value = '';
        });
    } catch (error) {
        console.error('加载中心列表失败:', error);
    }
}

// 修改搜索函数
async function searchSubject() {
    const projectName = document.getElementById('projectSelect').value;
    const centerName = document.getElementById('centerSelect').value;
    const inputValue = document.getElementById('subjectInput').value.trim();

    if (!projectName || !centerName) {
        alert("请先选择项目和中心");
        return;
    }

    if (!inputValue) {
        alert("请选择或输入受试者姓名");
        return;
    }

    try {
        const subject = await SubjectOperations.getSubject(projectName, centerName, inputValue);
        if (subject) {
            displaySubjectInfo(subject);
            generateVisitPlan(subject);
        } else {
            alert("未找到该受试者");
            document.getElementById('subjectInfo').style.display = 'none';
            document.getElementById('visitPlanTable').style.display = 'none';
        }
    } catch (error) {
        console.error('搜索受试者失败:', error);
        alert('搜索受试者时出错');
    }
}

// 添加输入处理函数
function handleInput(event) {
    const input = event.target;
    const projectName = document.getElementById('projectSelect').value;
    const centerName = document.getElementById('centerSelect').value;
    const suggestionList = document.getElementById('subjectSuggestions');

    if (!projectName || !centerName) {
        alert('请先选择项目和中心');
        input.value = '';
        return;
    }

    // 获取当前中心的所有受试者
    const centerSubjects = allSubjects.filter(subject =>
        subject.project === projectName &&
        subject.center === centerName
    );

    // 如果有输入值，进一步过滤匹配的受试者
    const value = input.value.trim().toLowerCase();
    const matches = value ?
        centerSubjects.filter(subject =>
            subject.name.toLowerCase().startsWith(value)
        ) :
        centerSubjects;

    // 显示建议列表
    displaySuggestions(matches, input, suggestionList);
}

// 添加显示建议列表的辅助函数
function displaySuggestions(subjects, input, suggestionList) {
    if (subjects.length > 0) {
        suggestionList.innerHTML = '';
        subjects.forEach(subject => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = subject.name;
            div.onclick = () => {
                input.value = subject.name;
                suggestionList.style.display = 'none';
                searchSubject();
            };
            suggestionList.appendChild(div);
        });
        suggestionList.style.display = 'block';
    } else {
        suggestionList.style.display = 'none';
    }
}

// 添加键盘导航功能
function handleKeydown(event) {
    const suggestionList = document.getElementById('subjectSuggestions');
    const items = suggestionList.getElementsByClassName('suggestion-item');
    const activeItem = suggestionList.querySelector('.suggestion-item.active');

    if (suggestionList.style.display === 'none') return;

    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            if (!activeItem) {
                items[0].classList.add('active');
            } else {
                const nextItem = activeItem.nextElementSibling;
                if (nextItem) {
                    activeItem.classList.remove('active');
                    nextItem.classList.add('active');
                }
            }
            break;

        case 'ArrowUp':
            event.preventDefault();
            if (activeItem) {
                const prevItem = activeItem.previousElementSibling;
                if (prevItem) {
                    activeItem.classList.remove('active');
                    prevItem.classList.add('active');
                }
            }
            break;

        case 'Enter':
            if (activeItem) {
                event.preventDefault();
                document.getElementById('subjectInput').value = activeItem.textContent;
                suggestionList.style.display = 'none';
                searchSubject();
            }
            break;

        case 'Escape':
            suggestionList.style.display = 'none';
            break;
    }
}

function displaySubjectInfo(subject) {
    currentSubject = subject; // 保存当前受试者数据
    document.getElementById('subjectInfo').style.display = 'block';
    document.getElementById('subjectName').textContent = subject.name;
    document.getElementById('firstVisitDate').textContent = formatDate(subject.firstDate);
    document.getElementById('visitFrequency').textContent = `${subject.frequency}`;
    document.getElementById('totalVisits').textContent = subject.totalVisits;

    // 添加访视口信息显示
    const visitWindowText = subject.visitWindow && subject.visitWindow.trim() !== ''
        ? subject.visitWindow
        : '默认窗口0';
    document.getElementById('visitWindow').textContent = visitWindowText;

    // 更 Flatpickr 日期
    flatpickr('#adjustDate', {
        defaultDate: new Date(subject.firstDate),
        dateFormat: "Y-m-d",
        locale: "zh",
        enableTime: false,
        altInput: true,
        altFormat: "Y年m月d日",
        theme: "material_blue",
        allowInput: true,
        clickOpens: true,
        disableMobile: false,
        onChange: function (selectedDates, dateStr) {
            console.log('选择的日期:', dateStr);
        }
    });
}

// 添加日期格式化函数（用于input type="date"）
function formatDateForInput(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function generateVisitPlan(subject) {
    document.getElementById('visitPlanTable').style.display = 'block';
    const tableBody = document.getElementById('visitTableBody');
    tableBody.innerHTML = '';

    const firstDate = new Date(subject.firstDate);
    const totalVisits = parseInt(subject.totalVisits);

    // 解析访视间隔
    let frequencies = [];
    if (subject.frequency.includes(',')) {
        // 如果是逗号分隔的格式
        frequencies = subject.frequency.split(',').map(Number);
        if (frequencies.length !== totalVisits - 1) {
            alert('访视间隔数量应该等于总访视次数-1');
            return;
        }
    } else {
        // 如果是单个数字，创建相同间隔的数组
        const fixedFrequency = parseInt(subject.frequency);
        frequencies = Array(totalVisits - 1).fill(fixedFrequency);
    }

    // 解析访视窗口
    let visitWindows = [];
    if (subject.visitWindow && subject.visitWindow.trim() !== '') {
        const windowValue = subject.visitWindow.trim();

        if (windowValue.includes(',')) {
            // 如果是逗号分隔的格式
            visitWindows = windowValue.split(',').map(Number);
            if (visitWindows.length !== totalVisits - 1) {
                alert('访视窗口数量应该等于总访视次数-1');
                return;
            }
            // 验证所有窗口值是否为非负数
            if (visitWindows.some(w => w < 0)) {
                alert('访视窗口不能为负数');
                return;
            }
        } else {
            // 如果是单个数字，表示固定窗口大小
            const fixedWindow = parseInt(windowValue);
            if (isNaN(fixedWindow) || fixedWindow < 0) {
                alert('请输入有效的访视窗口天数');
                return;
            }
            visitWindows = Array(totalVisits - 1).fill(fixedWindow);
        }
    } else {
        // 如果未设置访视窗口，则所有访视的窗口期都是0
        visitWindows = Array(totalVisits - 1).fill(0);
    }

    // 计算每次访视的基准日期
    let visitDates = [firstDate];  // 存储每次访视的基准日期
    let currentDate = new Date(firstDate);

    // 计算后续访视的基准日期
    for (let i = 0; i < frequencies.length; i++) {
        currentDate = new Date(currentDate.getTime() + frequencies[i] * 24 * 60 * 60 * 1000);
        visitDates.push(currentDate);
    }

    // 遍历每次访视生成计划
    visitDates.forEach((baseDate, visitNum) => {
        const groupClass = visitNum % 2 === 0 ? 'visit-group-even' : 'visit-group-odd';
        let rows = [];  // 存储当前访视组的所有行

        if (visitNum === 0 || visitWindows[visitNum - 1] === 0) {
            // 单行访视
            addVisitRow(tableBody, visitNum + 1, baseDate, '基准日期', groupClass, true, true);
        } else {
            // 多行访视
            const window = visitWindows[visitNum - 1];
            for (let offset = -window; offset <= window; offset++) {
                const visitDate = new Date(baseDate.getTime() + offset * 24 * 60 * 60 * 1000);
                let dateType = '基准日期';
                if (offset < 0) {
                    dateType = `提前${Math.abs(offset)}天`;
                } else if (offset > 0) {
                    dateType = `延后${offset}天`;
                }

                // 是否是视组的第一行或最后一行
                const isFirst = offset === -window;
                const isLast = offset === window;

                addVisitRow(tableBody, visitNum + 1, visitDate, dateType, groupClass, isFirst, isLast);
            }
        }
    });
}

// 添加访视行的辅助函数
function addVisitRow(tableBody, visitNumber, date, dateType, groupClass, isGroupStart, isGroupEnd) {
    const row = tableBody.insertRow();
    row.className = groupClass;

    // 添加访视组开始和结束的标记
    if (isGroupStart) {
        row.classList.add('visit-group-start');
    }
    if (isGroupEnd) {
        row.classList.add('visit-group-end');
    }

    // 添加基准日期或窗口期的样式
    if (dateType === '基准日期') {
        row.classList.add('visit-base-date');
    } else {
        row.classList.add('visit-window-date');
    }

    // 访视次数
    const visitCell = row.insertCell(0);
    visitCell.textContent = `第 ${visitNumber} 次访视`;

    // 计划访视日期
    const dateCell = row.insertCell(1);
    dateCell.textContent = `${formatDate(date)} (${dateType})`;
    if (dateType !== '基准日期') {
        dateCell.style.color = '#666'; // 窗口期日期使用灰色
    }

    // 节假日信息
    const holidayInfo = getHolidayInfo(date);
    const holidayCell = row.insertCell(2);
    holidayCell.textContent = holidayInfo;
    if (holidayInfo !== '非节假日') {
        holidayCell.style.color = dateType === '基准日期' ? 'red' : '#d32f2f'; // 基准日期的节假日更醒目
    }
}

function getHolidayInfo(date) {
    try {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();

        // 使用 HolidayUtil 获取节假日信息
        const holiday = HolidayUtil.getHoliday(year, month, day);

        if (holiday) {
            // 如果是调休工作日，返回调休信息
            if (holiday.isWork()) {
                return `${holiday.getName()}调休`;
            }
            // 如果是节假日，返回节日名称
            return holiday.getName();
        }

        // 如果不是法定节假日检查是否为普通周末
        const weekDay = date.getDay();
        if (weekDay === 0 || weekDay === 6) {
            return weekDay === 0 ? '周日' : '周六';
        }

        return '非节假日';
    } catch (error) {
        console.error('Error in getHolidayInfo:', error);
        return '非节假日';
    }
}

function formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}