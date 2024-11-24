import { ProjectOperations, CenterOperations, SubjectOperations } from '../common/db-operations.js';

const { createApp, ref, computed, onMounted, watch, nextTick } = Vue;

createApp({
    setup() {
        // 状态定义
        const projects = ref([]);
        const centers = ref([]);
        const formData = ref({
            project: '',
            center: '',
            name: '',
            firstDate: '',
            totalVisits: 2,
            frequencyType: 'fixed',
            fixedDays: 1,
            fixedWindow: 0,
        });

        const visits = ref([]);
        const excelFile = ref(null);
        const columnMappings = ref([]);
        const datePickerEl = ref(null);

        // 可用的Excel字段映射
        const availableFields = [
            { value: 'project', label: '项目' },
            { value: 'center', label: '中心' },
            { value: 'name', label: '受试者编号' },
            { value: 'firstDate', label: '首次受试日期' },
            { value: 'totalVisits', label: '总访视次数' },
            { value: 'frequency', label: '访视间隔' },
            { value: 'visitWindow', label: '访视窗口' }
        ];

        // 添加 tab 状态管理
        const activeTab = ref('single');
        
        // 添加表单重置功能
        const resetForm = () => {
            formData.value = {
                project: '',
                center: '',
                name: '',
                firstDate: '',
                totalVisits: 2,
                frequencyType: 'fixed',
                fixedDays: 1,
                fixedWindow: 0,
            };
            visits.value = [];
            updateVisitTable();
        };

        // 添加批量导入表单重置功能
        const resetBatchForm = () => {
            excelFile.value = null;
            columnMappings.value = [];
        };

        // 监听 tab 切换，重置相应表单
        watch(activeTab, (newTab) => {
            if (newTab === 'single') {
                resetBatchForm();
            } else {
                resetForm();
            }
        });

        // 方法定义
        const loadProjects = async () => {
            try {
                const projectList = await ProjectOperations.getAllProjects();
                projects.value = projectList.map(p => p.projectName);
            } catch (error) {
                console.error('Error loading projects:', error);
                alert('加载项目列表失败');
            }
        };

        const loadCenters = async (projectName) => {
            try {
                const centerList = await CenterOperations.getCentersForProject(projectName);
                centers.value = centerList.map(c => c.centerName);
            } catch (error) {
                console.error('Error loading centers:', error);
                alert('加载中心列表失败');
            }
        };

        const onProjectChange = async () => {
            formData.value.center = '';
            if (formData.value.project) {
                await loadCenters(formData.value.project);
            } else {
                centers.value = [];
            }
        };

        // 初始化访视表格
        const initVisitTable = () => {
            updateVisitTable();
            watch(() => formData.value.totalVisits, updateVisitTable);
        };

        // 更新访视表格
        const updateVisitTable = () => {
            const totalVisits = formData.value.totalVisits;
            if (totalVisits >= 2) {
                visits.value = Array.from({ length: totalVisits - 1 }, () => ({
                    frequency: 1,
                    window: 0
                }));
            }
        };

        const submitForm = async () => {
            try {
                const subjectData = {
                    project: formData.value.project,
                    center: formData.value.center,
                    name: formData.value.name,
                    firstDate: formData.value.firstDate,
                    totalVisits: formData.value.totalVisits,
                    frequency: formData.value.frequencyType === 'fixed'
                        ? formData.value.fixedDays.toString()
                        : visits.value.map(v => v.frequency).join(','),
                    visitWindow: formData.value.frequencyType === 'fixed'
                        ? formData.value.fixedWindow.toString()
                        : visits.value.map(v => v.window).join(',')
                };

                await SubjectOperations.addSubject(subjectData);
                alert('添加成功！');
                resetForm();
            } catch (error) {
                console.error('Error saving subject:', error);
                alert('保存失败，请检查数据是否重复或格式是否正确');
            }
        };

        const handleFileChange = (event) => {
            excelFile.value = event.target.files[0];
            if (excelFile.value) {
                parseExcelHeaders(excelFile.value);
            }
        };

        const parseExcelHeaders = (file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const headers = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })[0];

                columnMappings.value = headers.map(header => ({
                    header,
                    field: ''
                }));
            };
            reader.readAsArrayBuffer(file);
        };

        // 处理批量导入
        const handleBatchImport = async (event) => {
            event.preventDefault();

            const selectedProject = formData.value.project;
            const selectedCenter = formData.value.center;

            if (!selectedProject || !selectedCenter) {
                alert('请先选择项目和中心');
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(firstSheet);

                    // 根据列映射转换数据
                    const subjects = rows.map((row, index) => {
                        const subject = {
                            project: selectedProject,
                            center: selectedCenter
                        };
                        let hasError = false;

                        // 遍历映射关系，构建数据
                        columnMappings.value.forEach(mapping => {
                            if (mapping.field && row[mapping.header] !== undefined) {
                                let value = row[mapping.header];

                                // 特殊字段处理
                                switch (mapping.field) {
                                    case 'firstDate':
                                        // 处理日期
                                        const date = parseExcelDate(value);
                                        if (date) {
                                            value = date.toISOString().split('T')[0];
                                        } else {
                                            console.error(`Row ${index + 1}: Invalid date format`);
                                            hasError = true;
                                        }
                                        break;
                                    case 'totalVisits':
                                        // 确保是数字
                                        value = parseInt(value);
                                        if (isNaN(value) || value < 2) {
                                            console.error(`Row ${index + 1}: Invalid total visits`);
                                            hasError = true;
                                        }
                                        break;
                                    case 'frequency':
                                        // 确保是数字或逗号分隔的数字
                                        if (typeof value === 'number') {
                                            value = value.toString();
                                        } else if (typeof value === 'string') {
                                            value = value.trim();
                                            if (!/^\d+(?:,\d+)*$/.test(value)) {
                                                console.error(`Row ${index + 1}: Invalid frequency format`);
                                                hasError = true;
                                            }
                                        } else {
                                            hasError = true;
                                        }
                                        break;
                                    case 'visitWindow':
                                        // 处理访视窗口
                                        if (value === undefined || value === '') {
                                            value = '0';
                                        } else if (typeof value === 'number') {
                                            value = value.toString();
                                        } else if (typeof value === 'string') {
                                            value = value.trim();
                                            if (!/^\d+(?:,\d+)*$/.test(value)) {
                                                console.error(`Row ${index + 1}: Invalid visit window format`);
                                                hasError = true;
                                            }
                                        } else {
                                            hasError = true;
                                        }
                                        break;
                                }
                                subject[mapping.field] = value;
                            }
                        });

                        // 验证必填字段
                        const requiredFields = ['name', 'firstDate', 'totalVisits', 'frequency'];
                        const missingFields = requiredFields.filter(field => !subject[field]);
                        if (missingFields.length > 0) {
                            console.error(`Row ${index + 1}: Missing required fields: ${missingFields.join(', ')}`);
                            hasError = true;
                        }

                        // 验证频率和窗口的数量
                        if (!hasError && subject.frequency.includes(',')) {
                            const frequencyCount = subject.frequency.split(',').length;
                            if (frequencyCount !== subject.totalVisits - 1) {
                                console.error(`Row ${index + 1}: Frequency count doesn't match total visits`);
                                hasError = true;
                            }
                        }

                        if (!hasError && subject.visitWindow && subject.visitWindow !== '0' && subject.visitWindow.includes(',')) {
                            const windowCount = subject.visitWindow.split(',').length;
                            if (windowCount !== subject.totalVisits - 1) {
                                console.error(`Row ${index + 1}: Visit window count doesn't match total visits`);
                                hasError = true;
                            }
                        }

                        return hasError ? null : subject;
                    }).filter(subject => subject !== null);

                    if (subjects.length === 0) {
                        throw new Error('No valid subjects found in the Excel file');
                    }

                    // 批量保存
                    await Promise.all(subjects.map(subject =>
                        SubjectOperations.addSubject(subject)
                    ));

                    alert(`成功导入 ${subjects.length} 条记录！`);
                    resetBatchForm();
                } catch (error) {
                    console.error('批量导入失败:', error);
                    alert('导入失败，请检查数据格式是否正确');
                }
            };
            reader.readAsArrayBuffer(excelFile.value);
        };

        const validateSubjectData = (data) => {
            if (!data.project || !data.center || !data.name || !data.firstDate) {
                return false;
            }
            return true;
        };

        // 初始化日期选择器
        const initDatePicker = () => {
            // 使用 nextTick 确保 DOM 已更新
            nextTick(() => {
                if (datePickerEl.value) {
                    flatpickr(datePickerEl.value, {
                        dateFormat: "Y-m-d",
                        locale: "zh",
                        allowInput: true,
                        altInput: true,
                        altFormat: "Y年m月d日",
                        disableMobile: true,
                        onChange: (selectedDates) => {
                            formData.value.firstDate = selectedDates[0]?.toISOString().split('T')[0] || '';
                        }
                    });
                }
            });
        };

        // 生命周期钩子
        onMounted(async () => {
            try {
                await loadProjects();
                initDatePicker();
                initVisitTable();

                // 检查 URL 参数
                const urlParams = new URLSearchParams(window.location.search);
                const projectFromUrl = urlParams.get('project');
                const centerFromUrl = urlParams.get('center');

                if (projectFromUrl) {
                    formData.value.project = projectFromUrl;
                    await loadCenters(projectFromUrl);
                    if (centerFromUrl) {
                        formData.value.center = centerFromUrl;
                    }
                }
            } catch (error) {
                console.error('Error initializing:', error);
            }
        });

        return {
            // 状态
            activeTab,
            projects,
            centers,
            formData,
            visits,
            excelFile,
            columnMappings,
            availableFields,
            datePickerEl,
            // 方法
            onProjectChange,
            submitForm,
            handleFileChange,
            handleBatchImport,
            updateVisitTable,
            // 添加新的方法
            resetForm,
            resetBatchForm
        };
    }
}).mount('#app');

// 辅助函数：解析Excel日期
function parseExcelDate(dateValue) {
    if (dateValue instanceof Date) {
        return new Date(Date.UTC(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate()));
    }

    if (typeof dateValue === 'number') {
        const date = new Date((dateValue - 25569) * 86400 * 1000);
        return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    }

    if (typeof dateValue === 'string') {
        if (/^\d{4}$/.test(dateValue)) {
            const month = parseInt(dateValue.substr(0, 2)) - 1;
            const day = parseInt(dateValue.substr(2, 2));
            const year = new Date().getFullYear();
            return new Date(Date.UTC(year, month, day));
        }

        const parts = dateValue.split('/');
        if (parts.length === 3) {
            const month = parseInt(parts[0]) - 1;
            const day = parseInt(parts[1]);
            let year = parseInt(parts[2]);

            if (year < 100) {
                year += year < 50 ? 2000 : 1900;
            }

            return new Date(Date.UTC(year, month, day));
        }

        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
            return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        }
    }

    return null;
}