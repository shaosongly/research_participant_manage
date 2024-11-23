import { ProjectOperations, CenterOperations, SubjectOperations, VisitRecordOperations } from '../common/db-operations.js';


// 初始化 Flatpickr
flatpickr("#firstDate", {
    dateFormat: "Y-m-d",
    locale: "zh",
    allowInput: true,
    altInput: true,
    altFormat: "Y年m月d日",
    disableMobile: true
});

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 加载项目列表
        const projects = await ProjectOperations.getAllProjects();
        const projectSelect = document.getElementById('projectSelect');
        projectSelect.innerHTML = '<option value="">请选择项目</option>' +
            projects.map(project => 
                `<option value="${project.projectName}">${project.projectName}</option>`
            ).join('');

        // 如果URL中包含项目和中心参数，自动选择对应选项
        const urlParams = new URLSearchParams(window.location.search);
        const projectFromUrl = urlParams.get('project');
        const centerFromUrl = urlParams.get('center');
        
        if (projectFromUrl) {
            projectSelect.value = projectFromUrl;
            await loadCentersForProject(projectFromUrl);
            if (centerFromUrl) {
                setTimeout(() => {
                    document.getElementById('centerSelect').value = centerFromUrl;
                }, 100);
            }
        }
    } catch (error) {
        console.error('Error initializing:', error);
        alert('初始化失败');
    }
});

// 根据选择的项目加载对应的中心
async function loadCentersForProject(projectName) {
    try {
        const centers = await CenterOperations.getCentersForProject(projectName);
        const centerSelect = document.getElementById('centerSelect');
        centerSelect.innerHTML = '<option value="">请选择中心</option>' +
            centers.map(center => 
                `<option value="${center.centerName}">${center.centerName}</option>`
            ).join('');
    } catch (error) {
        console.error('Error loading centers:', error);
        alert('加载中心列表失败');
    }
}

// 监听项目选择变化
document.getElementById('projectSelect').addEventListener('change', function() {
    const projectName = this.value;
    if (projectName) {
        loadCentersForProject(projectName);
    } else {
        document.getElementById('centerSelect').innerHTML = '<option value="">请先选择项目</option>';
    }
});

// 修改表单提交处理
document.getElementById('subjectForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const projectName = document.getElementById('projectSelect').value;
    const centerName = document.getElementById('centerSelect').value;
    const subjectName = document.getElementById('subjectName').value;
    const firstDate = document.getElementById('firstDate').value;
    const totalVisits = document.getElementById('totalVisits').value;
    const isFixedFrequency = document.getElementById('fixedFrequency').checked;
    
    if (!projectName || !centerName) {
        alert('请选择项目和中心');
        return;
    }

    // 获取访视间隔和窗口
    let frequency, visitWindow;
    if (isFixedFrequency) {
        frequency = document.getElementById('fixedDays').value;
        visitWindow = document.getElementById('fixedWindow').value || '0';
    } else {
        frequency = Array.from(document.querySelectorAll('.visit-frequency'))
            .map(input => input.value)
            .join(',');
        visitWindow = Array.from(document.querySelectorAll('.visit-window'))
            .map(input => input.value || '0')
            .join(',');
    }
    
    const subjectData = {
        project: projectName,
        center: centerName,
        name: subjectName,
        firstDate: firstDate,
        totalVisits: parseInt(totalVisits),
        frequency: frequency,
        visitWindow: visitWindow
    };
    
    try {
        await SubjectOperations.addSubject(subjectData);
        console.log('数据保存成功:', subjectData);
        window.location.href = 'view.html';
    } catch (error) {
        console.error('保存数据时出错:', error);
        alert('保存失败，请重试');
    }
});

// 处理Excel文件上传
document.getElementById('excelFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];

        // 生成字段映射选择
        const mappingHtml = headers.map((header, index) => `
            <div class="mb-2">
                <label class="form-label">Excel列 "${header}" 对应：</label>
                <select class="form-select" data-excel-column="${index}">
                    <option value="">请选择</option>
                    <option value="project">项目（可选）</option>
                    <option value="center">中心（可选）</option>
                    <option value="name">受试者名称</option>
                    <option value="firstDate">首次受试日期</option>
                    <option value="frequency">访视间隔</option>
                    <option value="totalVisits">总访视次数</option>
                    <option value="visitWindow">访视窗口（可选）</option>
                </select>
            </div>
        `).join('');

        document.getElementById('columnMapping').innerHTML = mappingHtml;
    };

    reader.readAsArrayBuffer(file);
});

// 处理批量导入
document.getElementById('batchImportForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const selectedProject = document.getElementById('projectSelect').value;
    const selectedCenter = document.getElementById('centerSelect').value;

    if (!selectedProject || !selectedCenter) {
        alert('请先在页面上方选择项目和中心');
        return;
    }

    const file = document.getElementById('excelFile').files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array', cellDates: true});
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1, raw: false});

        // 获取用户定义的字段映射
        const mapping = {};
        document.querySelectorAll('#columnMapping select').forEach(select => {
            const field = select.value;
            const columnIndex = parseInt(select.dataset.excelColumn);
            if (field) {  // 只保存有效的映射
                mapping[field] = columnIndex;
            }
        });

        // 检查必要字段是否都已映射（项目和中心现在是可选的）
        const requiredFields = ['name', 'firstDate', 'totalVisits'];
        const missingFields = requiredFields.filter(field => mapping[field] === undefined);
        if (missingFields.length > 0) {
            alert(`请映射所有必要字段: ${missingFields.join(', ')}`);
            return;
        }

        // 转换数据
        const subjectsData = jsonData.slice(1).map(row => {
            // 创建基础对象，使用选择框中的项目和中心作为默认值
            const subject = {
                project: selectedProject,
                center: selectedCenter,
                name: null,
                firstDate: null,
                totalVisits: null,
                frequency: null,
                visitWindow: '0'  // 默认访视窗口为0
            };

            // 处理映射的字段
            Object.keys(mapping).forEach(field => {
                const columnIndex = mapping[field];
                if (columnIndex !== undefined && columnIndex < row.length) {
                    if (field === 'firstDate') {
                        const dateValue = row[columnIndex];
                        const parsedDate = parseExcelDate(dateValue);
                        subject[field] = parsedDate ? parsedDate.toISOString().split('T')[0] : null;
                    } else if (field === 'frequency') {
                        // 直接使用Excel中的访视间隔值
                        subject.frequency = row[columnIndex]?.toString().trim() || null;
                    } else if (field === 'visitWindow') {
                        // 访视窗口是可选的，如果有值则使用，否则保持默认值0
                        const windowValue = row[columnIndex]?.toString().trim();
                        if (windowValue && windowValue !== '') {
                            subject.visitWindow = windowValue;
                        }
                    } else if (field === 'totalVisits') {
                        const visits = parseInt(row[columnIndex]);
                        subject[field] = !isNaN(visits) ? visits : null;
                    } else if (field === 'name') {
                        subject[field] = row[columnIndex]?.toString().trim() || null;
                    } else if (field === 'project' || field === 'center') {
                        // 如果Excel中有项目或中心列，则覆盖默认值
                        const value = row[columnIndex]?.toString().trim();
                        if (value) {
                            subject[field] = value;
                        }
                    }
                }
            });

            return subject;
        });

        // 添加调试日志
        console.log('转换后的数据:', subjectsData);

        // 修改验证逻辑
        const invalidSubjects = subjectsData.filter(subject => {
            const isInvalid = !subject.name || 
                              !subject.firstDate || 
                              !subject.totalVisits || 
                              subject.totalVisits <= 0 || 
                              !subject.frequency;
            if (isInvalid) {
                console.log('无效数据:', subject);
                console.log('原因:', {
                    noName: !subject.name,
                    noDate: !subject.firstDate,
                    noVisits: !subject.totalVisits,
                    invalidVisits: subject.totalVisits <= 0,
                    noFrequency: !subject.frequency
                });
            }
            return isInvalid;
        });

        if (invalidSubjects.length > 0) {
            alert(`发现 ${invalidSubjects.length} 条无效数据，请检查Excel文件`);
            console.error('Invalid subjects:', invalidSubjects);
            return;
        }

        // 添加保存数据的逻辑
        try {
            // 使用 Promise.all 批量保存数据
            await Promise.all(subjectsData.map(subject => 
                SubjectOperations.addSubject(subject)
            ));
            
            console.log('批量导入成功，共导入', subjectsData.length, '条数据');
            window.location.href = 'view.html';
        } catch (error) {
            console.error('批量导入失败:', error);
            alert('导入失败，请检查数据是否重复或格式是否正确');
        }
    };

    reader.readAsArrayBuffer(file);
});

// 修改后的日期解析函数
function parseExcelDate(dateValue) {
    console.log("Original date value:", dateValue);
    
    if (dateValue instanceof Date) {
        return new Date(Date.UTC(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate()));
    }
    
    if (typeof dateValue === 'number') {
        // Excel的日期数字是从1900年1月1日开始的天数
        const date = new Date((dateValue - 25569) * 86400 * 1000);
        return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    }
    
    if (typeof dateValue === 'string') {
        // 处理 "MMDD" 格式
        if (/^\d{4}$/.test(dateValue)) {
            const month = parseInt(dateValue.substr(0, 2)) - 1; // JavaScript月份从0开始
            const day = parseInt(dateValue.substr(2, 2));
            const year = new Date().getFullYear(); // 使用当前年份
            return new Date(Date.UTC(year, month, day));
        }
        
        // 处理 "M/D/YY" 格式
        const parts = dateValue.split('/');
        if (parts.length === 3) {
            const month = parseInt(parts[0]) - 1; // JavaScript月份从0开始
            const day = parseInt(parts[1]);
            let year = parseInt(parts[2]);
            
            // 处理两位数年份
            if (year < 100) {
                year += year < 50 ? 2000 : 1900;
            }
            
            return new Date(Date.UTC(year, month, day));
        }
        
        // 如果上面的方法失败，尝试使用 Date 构造函数
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
            return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        }
    }
    
    return null;
}

// 监听访视次数变化
document.getElementById('totalVisits').addEventListener('change', function() {
    updateVisitTable();
});

// 监听间隔类型切换
document.querySelectorAll('input[name="frequencyType"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const isFixed = this.value === 'fixed';
        document.getElementById('fixedFrequencyInput').style.display = isFixed ? 'block' : 'none';
        document.getElementById('variableFrequencyInput').style.display = isFixed ? 'none' : 'block';
        if (!isFixed) {
            updateVisitTable();
        }
    });
});

function updateVisitTable() {
    const totalVisits = parseInt(document.getElementById('totalVisits').value) || 0;
    const tbody = document.getElementById('visitTableBody');
    tbody.innerHTML = '';

    // 从第二次访视开始（跳过首次访视）
    for (let i = 2; i <= totalVisits; i++) {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>第 ${i} 次访视</td>
            <td>
                <input type="number" class="form-control form-control-sm visit-frequency" 
                       min="1" value="1" data-visit="${i}">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm visit-window" 
                       min="0" value="0" data-visit="${i}">
            </td>
        `;
    }
}