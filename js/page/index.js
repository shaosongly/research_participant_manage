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
                window.location.href = 'view.html';
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

        const handleBatchImport = async () => {
            if (!excelFile.value) {
                alert('请选择Excel文件');
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet);

                const subjectsData = [];
                const invalidSubjects = [];

                rows.forEach(row => {
                    const subject = {};
                    columnMappings.value.forEach(mapping => {
                        if (mapping.field) {
                            const value = row[mapping.header];
                            subject[mapping.field] = mapping.field === 'firstDate' 
                                ? parseExcelDate(value)?.toISOString().split('T')[0] 
                                : value;
                        }
                    });

                    if (validateSubjectData(subject)) {
                        subjectsData.push(subject);
                    } else {
                        invalidSubjects.push(row);
                    }
                });

                if (invalidSubjects.length > 0) {
                    alert(`发现 ${invalidSubjects.length} 条无效数据，请检查Excel文件`);
                    console.error('Invalid subjects:', invalidSubjects);
                    return;
                }

                try {
                    await Promise.all(subjectsData.map(subject => 
                        SubjectOperations.addSubject(subject)
                    ));
                    window.location.href = 'view.html';
                } catch (error) {
                    console.error('批量导入失败:', error);
                    alert('导入失败，请检查数据是否重复或格式是否正确');
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
            updateVisitTable
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