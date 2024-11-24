import { ProjectOperations, CenterOperations, SubjectOperations } from '../common/db-operations.js';

const { createApp, ref, computed, onMounted, watch, nextTick } = Vue;

createApp({
    setup() {
        // 状态定义
        const activeTab = ref('single');
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

        // view页面的状态
        const allSubjects = ref([]);
        const selectedProject = ref('');
        const selectedCenter = ref('');
        const batchDeleteMode = ref(false);
        const selectAll = ref(false);

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

        // view页面的计算属性
        const filteredSubjects = computed(() => {
            return allSubjects.value.filter(subject => {
                if (selectedProject.value && subject.project !== selectedProject.value) return false;
                if (selectedCenter.value && subject.center !== selectedCenter.value) return false;
                return true;
            });
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

        const onProjectChange = async (event) => {
            // 判断是哪个页面触发的变更
            const isViewTab = activeTab.value === 'view';
            const projectValue = isViewTab ? selectedProject.value : formData.value.project;
            
            // 重置中心选择
            if (isViewTab) {
                selectedCenter.value = '';
            } else {
                formData.value.center = '';
            }

            // 加载对应项目的中心列表
            if (projectValue) {
                await loadCenters(projectValue);
            } else {
                centers.value = [];
            }
        };

        // 表单重置功能
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

        // 批量导入表单重置
        const resetBatchForm = () => {
            excelFile.value = null;
            columnMappings.value = [];
        };

        // view页面的筛选重置
        const resetFilters = () => {
            selectedProject.value = '';
            selectedCenter.value = '';
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

        // view页面的方法
        const loadSubjects = async () => {
            try {
                const subjects = await SubjectOperations.getAllSubjects();
                allSubjects.value = subjects.map(s => ({
                    ...s,
                    selected: false,
                    editing: false,
                    editData: {}
                }));
            } catch (error) {
                console.error('Error loading subjects:', error);
                alert('加载数据失败');
            }
        };

        const editSubject = (index) => {
            const subject = filteredSubjects.value[index];
            subject.editing = true;
            subject.editData = { ...subject };
        };

        const saveSubject = async (index) => {
            const subject = filteredSubjects.value[index];
            if (!validateSubjectData(subject.editData)) {
                return;
            }

            try {
                const updateData = {
                    project: subject.editData.project,
                    center: subject.editData.center,
                    name: subject.editData.name,
                    firstDate: subject.editData.firstDate,
                    frequency: subject.editData.frequency,
                    totalVisits: subject.editData.totalVisits,
                    visitWindow: subject.editData.visitWindow || '0'
                };

                await SubjectOperations.updateSubject(updateData);
                subject.editing = false;
                await loadSubjects();
            } catch (error) {
                console.error('Error saving subject:', error);
                alert('保存失败');
            }
        };

        const cancelEdit = (index) => {
            const subject = filteredSubjects.value[index];
            subject.editing = false;
            subject.editData = {};
        };

        const deleteSubject = async (index) => {
            const subject = filteredSubjects.value[index];
            if (confirm('确定要删除这条记录吗？')) {
                try {
                    await SubjectOperations.deleteSubject(
                        subject.project,
                        subject.center,
                        subject.name
                    );
                    await loadSubjects();
                } catch (error) {
                    console.error('Error deleting subject:', error);
                    alert('删除失败');
                }
            }
        };

        const toggleBatchDeleteMode = (enabled) => {
            batchDeleteMode.value = enabled;
            if (!enabled) {
                selectAll.value = false;
                allSubjects.value.forEach(s => s.selected = false);
            }
        };

        const toggleSelectAll = () => {
            const selected = selectAll.value;
            filteredSubjects.value.forEach(s => s.selected = selected);
        };

        const batchDelete = async () => {
            const selectedSubjects = filteredSubjects.value.filter(s => s.selected);
            if (selectedSubjects.length === 0) {
                alert('请至少选择一条记录');
                return;
            }

            if (confirm(`确定要删除选中的 ${selectedSubjects.length} 条记录吗？`)) {
                try {
                    for (const subject of selectedSubjects) {
                        await SubjectOperations.deleteSubject(
                            subject.project,
                            subject.center,
                            subject.name
                        );
                    }
                    toggleBatchDeleteMode(false);
                    await loadSubjects();
                } catch (error) {
                    console.error('Error batch deleting subjects:', error);
                    alert('批量删除失败');
                }
            }
        };

        // 原有的表单提交方法
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
                if (activeTab.value === 'view') {
                    await loadSubjects();
                }
            } catch (error) {
                console.error('Error saving subject:', error);
                alert('保存失败，请检查数据是否重复或格式是否正确');
            }
        };

        // 批量导入相关方法
        const handleFileChange = (event) => {
            const file = event.target.files[0];
            if (file) {
                excelFile.value = file;
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
            }
        };

        const handleBatchImport = async (event) => {
            event.preventDefault();
            if (!excelFile.value) {
                alert('请选择Excel文件');
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(firstSheet);

                    const subjects = rows.map(row => {
                        const subject = {
                            project: formData.value.project,
                            center: formData.value.center
                        };
                        let hasError = false;

                        columnMappings.value.forEach(mapping => {
                            if (mapping.field && row[mapping.header] !== undefined) {
                                if (mapping.field === 'firstDate') {
                                    const date = parseExcelDate(row[mapping.header]);
                                    if (date) {
                                        subject[mapping.field] = date.toISOString().split('T')[0];
                                    } else {
                                        hasError = true;
                                    }
                                } else {
                                    subject[mapping.field] = row[mapping.header].toString();
                                }
                            }
                        });

                        return hasError ? null : subject;
                    }).filter(subject => subject !== null);

                    if (subjects.length === 0) {
                        throw new Error('No valid subjects found in the Excel file');
                    }

                    await Promise.all(subjects.map(subject =>
                        SubjectOperations.addSubject(subject)
                    ));

                    alert(`成功导入 ${subjects.length} 条记录！`);
                    resetBatchForm();
                    if (activeTab.value === 'view') {
                        await loadSubjects();
                    }
                } catch (error) {
                    console.error('批量导入失败:', error);
                    alert('导入失败，请检查数据格式是否正确');
                }
            };
            reader.readAsArrayBuffer(excelFile.value);
        };

        const validateSubjectData = (data) => {
            if (!data.project || !data.center || !data.name || !data.firstDate) {
                alert('请填写所有必填字段');
                return false;
            }

            // 验证访视频率格式和数量
            if (!/^\d+(?:,\d+)*$/.test(data.frequency)) {
                alert('访视频率格式不正确，请输入单个数字或用逗号分隔的多个数字');
                return false;
            }

            const frequencyNums = data.frequency.split(',');
            if (frequencyNums.length > 1 && frequencyNums.length !== data.totalVisits - 1) {
                alert(`当使用变化的访视间隔时，数量必须等于总访视次数减1`);
                return false;
            }

            // 验证访视窗口
            if (data.visitWindow !== '0' && !/^\d+(?:,\d+)*$/.test(data.visitWindow)) {
                alert('访视窗口格式不正确');
                return false;
            }

            const windowNums = data.visitWindow === '0' ? [] : data.visitWindow.split(',');
            if (windowNums.length > 1 && windowNums.length !== data.totalVisits - 1) {
                alert(`当使用变化的访视窗口时，数量必须等于总访视次数减1`);
                return false;
            }

            return true;
        };

        // 初始化日期选择器
        const initDatePicker = () => {
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

        // 监听tab切换
        watch(activeTab, async (newTab) => {
            if (newTab === 'single') {
                resetBatchForm();
            } else if (newTab === 'batch') {
                resetForm();
            } else if (newTab === 'view') {
                resetForm();
                resetBatchForm();
                await loadSubjects();
            }
        });

        // 生命周期钩子
        onMounted(async () => {
            try {
                await loadProjects();
                initDatePicker();
                initVisitTable();
                if (activeTab.value === 'view') {
                    await loadSubjects();
                }

                // 检查 URL 参数
                const urlParams = new URLSearchParams(window.location.search);
                const projectFromUrl = urlParams.get('project');
                const centerFromUrl = urlParams.get('center');

                if (projectFromUrl) {
                    formData.value.project = projectFromUrl;
                    selectedProject.value = projectFromUrl;
                    await loadCenters(projectFromUrl);
                    if (centerFromUrl) {
                        formData.value.center = centerFromUrl;
                        selectedCenter.value = centerFromUrl;
                    }
                }
            } catch (error) {
                console.error('Error initializing:', error);
            }
        });

        // 添加 centers 的计算属性
        const availableCenters = computed(() => {
            if (activeTab.value === 'view' && selectedProject.value) {
                return centers.value.filter(center => {
                    return allSubjects.value.some(subject => 
                        subject.project === selectedProject.value && 
                        subject.center === center
                    );
                });
            }
            return centers.value;
        });

        return {
            // 状态
            activeTab,
            projects,
            centers: availableCenters,
            formData,
            visits,
            excelFile,
            columnMappings,
            availableFields,
            datePickerEl,
            // view页面状态
            allSubjects,
            selectedProject,
            selectedCenter,
            batchDeleteMode,
            selectAll,
            filteredSubjects,
            // 方法
            onProjectChange,
            submitForm,
            handleFileChange,
            handleBatchImport,
            updateVisitTable,
            resetForm,
            resetBatchForm,
            resetFilters,
            // view页面方法
            editSubject,
            saveSubject,
            cancelEdit,
            deleteSubject,
            toggleBatchDeleteMode,
            toggleSelectAll,
            batchDelete
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