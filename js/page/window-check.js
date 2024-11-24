let db;
const dbName = "ResearchDB";

// 初始化数据库连接
const request = indexedDB.open(dbName);
request.onerror = event => console.error("数据库错误:", event.target.error);
request.onsuccess = event => {
    db = event.target.result;
    loadProjects();
    loadCenters();
};

// 加载项目列表
async function loadProjects() {
    try {
        const transaction = db.transaction(['projects'], 'readonly');
        const projectStore = transaction.objectStore('projects');
        const projects = await new Promise((resolve) => {
            projectStore.getAll().onsuccess = (event) => resolve(event.target.result);
        });

        const projectOptions = '<option value="">全部项目</option>' +
            projects.map(project =>
                `<option value="${project.projectName}">${project.projectName}</option>`
            ).join('');

        document.getElementById('projectFilter').innerHTML = projectOptions;
        document.getElementById('reminderProjectFilter').innerHTML = projectOptions;
    } catch (error) {
        console.error('加载项目列表失败:', error);
    }
}

// 加载中心列表
async function loadCenters(projectName = '', targetId = 'centerFilter') {
    try {
        const transaction = db.transaction(['centers'], 'readonly');
        const centerStore = transaction.objectStore('centers');
        let centers;

        if (projectName) {
            const centerIndex = centerStore.index('projectName');
            centers = await new Promise((resolve) => {
                centerIndex.getAll(projectName).onsuccess = (event) => resolve(event.target.result);
            });
        } else {
            centers = await new Promise((resolve) => {
                centerStore.getAll().onsuccess = (event) => resolve(event.target.result);
            });
        }

        document.getElementById(targetId).innerHTML = '<option value="">全部中心</option>' +
            centers.map(center =>
                `<option value="${center.centerName}">${center.centerName}</option>`
            ).join('');
    } catch (error) {
        console.error('加载中心列表失败:', error);
    }
}

// 检查超窗访视记录
async function checkWindowViolations() {
    const projectFilter = document.getElementById('projectFilter').value;
    const centerFilter = document.getElementById('centerFilter').value;
    const tableBody = document.getElementById('checkResultBody');
    tableBody.innerHTML = '';

    try {
        // 1. 获取符合条件的受试者
        const subjectTx = db.transaction(['subjects'], 'readonly');
        const subjectStore = subjectTx.objectStore('subjects');
        const subjects = await new Promise((resolve) => {
            subjectStore.getAll().onsuccess = (event) => resolve(event.target.result);
        });

        // 筛选符合条件的受试者
        const filteredSubjects = subjects.filter(subject =>
            (!projectFilter || subject.project === projectFilter) &&
            (!centerFilter || subject.center === centerFilter)
        );

        // 2. 获取所有访视记录
        const visitTx = db.transaction(['visitRecords'], 'readonly');
        const visitStore = visitTx.objectStore('visitRecords');
        const allVisits = await new Promise((resolve) => {
            visitStore.getAll().onsuccess = (event) => resolve(event.target.result);
        });

        const violations = [];

        // 3. 检查每个受试者的访视记录
        for (const subject of filteredSubjects) {
            // 计算计划访视日期
            const plannedVisits = calculatePlannedVisits(subject);

            // 获取该受试者的实际访视记录
            const subjectVisits = allVisits.filter(visit =>
                visit.project === subject.project &&
                visit.center === subject.center &&
                visit.subjectName === subject.name
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

        // 4. 显示超窗记录
        if (violations.length === 0) {
            const row = tableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 8;
            cell.textContent = "未发现超窗访视记录";
            cell.classList.add("text-center");
        } else {
            violations.sort((a, b) => b.overdueDays - a.overdueDays);
            violations.forEach(violation => {
                const row = tableBody.insertRow();
                row.insertCell().textContent = violation.project;
                row.insertCell().textContent = violation.center;
                row.insertCell().textContent = violation.subject;
                row.insertCell().textContent = `第 ${violation.visitNumber} 次访视`;
                row.insertCell().textContent = formatDate(violation.actualDate);
                row.insertCell().textContent = formatDate(violation.earliestDate);
                row.insertCell().textContent = formatDate(violation.latestDate);
                const overdueCell = row.insertCell();
                overdueCell.textContent = `${violation.overdueDays} 天`;
                overdueCell.classList.add('overdue');
            });
        }
    } catch (error) {
        console.error('检查超窗记录失败:', error);
        alert('检查失败，请重试');
    }
}

// 计算计划访视日期
function calculatePlannedVisits(subject) {
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
}

function formatDate(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

// 事件监听
document.getElementById('projectFilter').addEventListener('change', function () {
    loadCenters(this.value);
});

document.getElementById('checkButton').addEventListener('click', checkWindowViolations);

// 初始化日期选择器为今天
document.addEventListener('DOMContentLoaded', function () {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    document.getElementById('reminderDate').value = dateStr;

    // 复用项目列表加载
    loadProjects();
    loadCenters();

    // 为提醒模块的项目选择添加事件监听
    document.getElementById('reminderProjectFilter').addEventListener('change', function () {
        loadCenters(this.value, 'reminderCenterFilter');
    });
});

// 添加超窗提醒检查函数
async function checkWindowReminders() {
    const projectFilter = document.getElementById('reminderProjectFilter').value;
    const centerFilter = document.getElementById('reminderCenterFilter').value;
    const checkDate = new Date(document.getElementById('reminderDate').value);
    const tableBody = document.getElementById('reminderResultBody');
    tableBody.innerHTML = '';

    try {
        // 1. 获取符合条件的受试者
        const subjectTx = db.transaction(['subjects'], 'readonly');
        const subjectStore = subjectTx.objectStore('subjects');
        const subjects = await new Promise((resolve) => {
            subjectStore.getAll().onsuccess = (event) => resolve(event.target.result);
        });

        // 筛选符合条件的受试者
        const filteredSubjects = subjects.filter(subject =>
            (!projectFilter || subject.project === projectFilter) &&
            (!centerFilter || subject.center === centerFilter)
        );

        // 2. 获取所有访视记录
        const visitTx = db.transaction(['visitRecords'], 'readonly');
        const visitStore = visitTx.objectStore('visitRecords');
        const allVisits = await new Promise((resolve) => {
            visitStore.getAll().onsuccess = (event) => resolve(event.target.result);
        });

        const reminders = [];

        // 3. 检查每个受试者的访视记录
        for (const subject of filteredSubjects) {
            const plannedVisits = calculatePlannedVisits(subject);

            // 获取该受试者的实际访视记录
            const subjectVisits = allVisits.filter(visit =>
                visit.project === subject.project &&
                visit.center === subject.center &&
                visit.subjectName === subject.name
            );

            // 检查每次计划访视是否已完成
            plannedVisits.forEach((plannedVisit, index) => {
                // 跳过首次访视（index === 0）
                if (index === 0) return;

                const visitNumber = index + 1;

                // 检查这次访视是否已经完成
                const hasVisitRecord = subjectVisits.some(visit =>
                    visit.visitNumber === visitNumber
                );

                // 如果访视未完成且已超过最晚日期
                if (!hasVisitRecord && plannedVisit.latestDate < checkDate) {
                    const overdueDays = Math.ceil((checkDate - plannedVisit.latestDate) / (1000 * 60 * 60 * 24));
                    reminders.push({
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

        // 4. 显示提醒记录
        if (reminders.length === 0) {
            const row = tableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 7;
            cell.textContent = "未发现超窗访视";
            cell.classList.add("text-center");
        } else {
            reminders.sort((a, b) => b.overdueDays - a.overdueDays);
            reminders.forEach(reminder => {
                const row = tableBody.insertRow();
                row.insertCell().textContent = reminder.project;
                row.insertCell().textContent = reminder.center;
                row.insertCell().textContent = reminder.subject;
                row.insertCell().textContent = `第 ${reminder.visitNumber} 次访视`;
                row.insertCell().textContent = formatDate(reminder.earliestDate);
                row.insertCell().textContent = formatDate(reminder.latestDate);
                const overdueCell = row.insertCell();
                overdueCell.textContent = `${reminder.overdueDays} 天`;
                overdueCell.classList.add('overdue');
            });
        }
    } catch (error) {
        console.error('检查超窗提醒失败:', error);
        alert('检查失败，请重试');
    }
}

// 添加提醒按钮事件监听
document.getElementById('reminderButton').addEventListener('click', checkWindowReminders);