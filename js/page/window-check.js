import { ProjectOperations, CenterOperations, SubjectOperations, VisitRecordOperations } from '../common/db-operations.js';

// 确保 Dexie 已初始化
if (!window.Dexie) {
    throw new Error('Dexie is not loaded');
}

// 加载项目列表
async function loadProjects() {
    try {
        const projects = await ProjectOperations.getAllProjects();
        
        const projectOptions = '<option value="">全部项目</option>' +
            projects.map(project =>
                `<option value="${project.projectName}">${project.projectName}</option>`
            ).join('');

        document.getElementById('projectFilter').innerHTML = projectOptions;
        document.getElementById('reminderProjectFilter').innerHTML = projectOptions;
    } catch (error) {
        console.error('加载项目列表失败:', error);
        alert('加载项目列表失败，请刷新页面重试');
    }
}

// 加载中心列表
async function loadCenters(projectName = '', targetId = 'centerFilter') {
    try {
        let centers;
        if (projectName) {
            centers = await CenterOperations.getCentersForProject(projectName);
        } else {
            centers = await CenterOperations.getAllCenters();
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
        let subjects;
        if (projectFilter && centerFilter) {
            subjects = await SubjectOperations.getSubjectsForProjectCenter(projectFilter, centerFilter);
        } else {
            subjects = await SubjectOperations.getAllSubjects();
            if (projectFilter) {
                subjects = subjects.filter(subject => subject.project === projectFilter);
            }
            if (centerFilter) {
                subjects = subjects.filter(subject => subject.center === centerFilter);
            }
        }

        // 2. 获取访视记录
        const allVisits = await VisitRecordOperations.getAllVisitRecords();

        const violations = [];

        // 3. 检查每个受试者的访视记录
        for (const subject of subjects) {
            const plannedVisits = calculatePlannedVisits(subject);

            // 获取该受试者的实际访视记录
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
        displayViolations(violations, tableBody);
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

// 检查超窗提醒
async function checkWindowReminders() {
    const projectFilter = document.getElementById('reminderProjectFilter').value;
    const centerFilter = document.getElementById('reminderCenterFilter').value;
    const checkDate = new Date(document.getElementById('reminderDate').value);
    const tableBody = document.getElementById('reminderResultBody');
    tableBody.innerHTML = '';

    try {
        // 1. 获取符合条件的受试者
        let subjects;
        if (projectFilter && centerFilter) {
            subjects = await SubjectOperations.getSubjectsForProjectCenter(projectFilter, centerFilter);
        } else {
            subjects = await SubjectOperations.getAllSubjects();
            if (projectFilter) {
                subjects = subjects.filter(subject => subject.project === projectFilter);
            }
            if (centerFilter) {
                subjects = subjects.filter(subject => subject.center === centerFilter);
            }
        }

        // 2. 获取访视记录
        const allVisits = await VisitRecordOperations.getAllVisitRecords();
        const reminders = [];

        // 3. 检查每个受试者的访视记录
        for (const subject of subjects) {
            const plannedVisits = calculatePlannedVisits(subject);
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
        displayReminders(reminders, tableBody);
    } catch (error) {
        console.error('检查超窗提醒失败:', error);
        alert('检查失败，请重试');
    }
}

// 初始化页面
async function initializePage() {
    try {
        await loadProjects();
        await loadCenters();

        // 添加事件监听器
        document.getElementById('projectFilter').addEventListener('change', (e) => 
            loadCenters(e.target.value, 'centerFilter'));
        document.getElementById('reminderProjectFilter').addEventListener('change', (e) => 
            loadCenters(e.target.value, 'reminderCenterFilter'));
        document.getElementById('checkButton').addEventListener('click', checkWindowViolations);
        document.getElementById('reminderButton').addEventListener('click', checkWindowReminders);
    } catch (error) {
        console.error('页面初始化失败:', error);
        alert('页面初始化失败，请刷新重试');
    }
}

// 等待 DOM 和 Dexie 都准备好
document.addEventListener('DOMContentLoaded', () => {
    // 确保 Dexie 已加载
    if (window.Dexie) {
        initializePage();
    } else {
        console.error('Dexie not found');
        alert('数据库初始化失败，请刷新页面重试');
    }
});