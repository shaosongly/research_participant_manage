import { db, ProjectOperations, CenterOperations, SubjectOperations, VisitRecordOperations } from '../common/db-operations.js';

// 日期处理函数
function parseExcelDate(dateValue) {
    if (!dateValue) return null;

    // 如果是 Excel 数字日期（从1900年开始的天数）
    if (typeof dateValue === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const resultDate = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
        return resultDate.toISOString().split('T')[0];
    }

    // 如果是字符串日期
    if (typeof dateValue === 'string') {
        dateValue = dateValue.trim();
        let date;

        // 处理 YYYY/MM/DD 格式
        if (dateValue.includes('/')) {
            date = new Date(dateValue.replace(/\//g, '-'));
        }
        // 处理 YYYY-MM-DD 格式
        else if (dateValue.includes('-')) {
            date = new Date(dateValue);
        }
        // 处理其他可能的格式
        else {
            date = new Date(dateValue);
        }

        if (isNaN(date.getTime())) {
            throw new Error(`无效的日期格式: ${dateValue}`);
        }

        return date.toISOString().split('T')[0];
    }

    throw new Error(`无法解析的日期值: ${dateValue}`);
}

// Vue 应用
const app = Vue.createApp({
    data() {
        return {
            // 导航项
            navItems: [
                { path: 'landing.html', text: '首页' },
                { path: 'project_manage.html', text: '项目管理' },
                { path: 'index.html', text: '添加受试者' },
                { path: 'view.html', text: '查看受试者' },
                { path: 'schedule.html', text: '访视安排' },
                { path: 'visit_plan.html', text: '访视计划' },
                { path: 'visit_record.html', text: '访视记录', active: true },
                { path: 'window_check.html', text: '超窗检查' }
            ],

            // 数据列表
            projects: [],
            centers: [],
            subjects: [],
            visitRecords: [],

            // 选择的值
            selectedProject: '',
            selectedCenter: '',

            // 单次访视记录
            singleVisit: {
                subjectName: '',
                visitNumber: '',
                visitDate: ''
            },

            // 批量导入
            columnMapping: [],
            mappingFields: [
                { key: 'subjectName', label: '受试者姓名', required: true, selected: '' },
                { key: 'visitNumber', label: '访视序号', required: true, selected: '' },
                { key: 'visitDate', label: '访视日期', required: true, selected: '' },
                { key: 'project', label: '项目名称', required: false, selected: '' },
                { key: 'center', label: '中心名称', required: false, selected: '' }
            ],

            // 筛选条件
            filters: {
                project: '',
                center: '',
                subject: ''
            },

            // 批量删除相关
            showBatchDelete: false,
            selectAll: false,

            // 筛选用的数据
            filterCenters: [],
            filterSubjects: [],

            // 添加 tab 状态管理
            activeTab: 'single'
        }
    },

    mounted() {
        this.initializePage();
        this.initializeDatePicker();
    },

    methods: {
        async initializePage() {
            try {
                await this.loadProjects();
                await this.loadVisitRecords();
            } catch (error) {
                console.error('初始化失败:', error);
            }
        },

        initializeDatePicker() {
            this.datePicker = flatpickr(this.$refs.visitDatePicker, {
                dateFormat: "Y-m-d",
                locale: "zh",
                allowInput: true,
                altInput: true,
                altFormat: "Y年m月d日",
                disableMobile: true,
                onChange: (selectedDates) => {
                    if (selectedDates.length > 0) {
                        this.singleVisit.visitDate = selectedDates[0].toISOString().split('T')[0];
                    }
                }
            });
        },

        async loadProjects() {
            try {
                this.projects = await ProjectOperations.getAllProjects();
            } catch (error) {
                console.error('加载项目失败:', error);
                alert('加载项目列表失败');
            }
        },

        async loadCentersForProject(projectName) {
            try {
                if (!projectName) {
                    this.centers = [];
                    return;
                }
                this.centers = await CenterOperations.getCentersForProject(projectName);
            } catch (error) {
                console.error('加载中心失败:', error);
                alert('加载中心列表失败');
                this.centers = [];
            }
        },

        async loadSubjectsForCenter(project, center) {
            try {
                if (!project || !center) {
                    this.subjects = [];
                    return;
                }
                this.subjects = await SubjectOperations.getSubjectsForProjectCenter(project, center);
            } catch (error) {
                console.error('加载受试者失败:', error);
                alert('加载受试者列表失败');
                this.subjects = [];
            }
        },

        async loadVisitRecords() {
            try {
                const records = await VisitRecordOperations.getFilteredVisitRecords(this.filters);
                this.visitRecords = records.map(record => ({
                    ...record,
                    selected: false
                }));
            } catch (error) {
                console.error('加载访视记录失败:', error);
                alert('加载访视记录失败: ' + error.message);
                this.visitRecords = [];
            }
        },

        // 选择变化处理
        async onProjectChange() {
            this.selectedCenter = '';
            this.singleVisit.subjectName = '';
            if (this.selectedProject) {
                await this.loadCentersForProject(this.selectedProject);
            }
        },

        async onCenterChange() {
            this.singleVisit.subjectName = '';
            if (this.selectedProject && this.selectedCenter) {
                await this.loadSubjectsForCenter(this.selectedProject, this.selectedCenter);
            }
        },

        async onFilterProjectChange() {
            try {
                this.filters.center = '';
                this.filters.subject = '';
                this.filterSubjects = [];
                this.filterCenters = [];  // 重置中心列表

                if (this.filters.project) {
                    this.filterCenters = await CenterOperations.getCentersForProject(this.filters.project);
                }
                
                await this.loadVisitRecords();
            } catch (error) {
                console.error('项目筛选失败:', error);
                alert('加载项目相关数据失败');
                this.filterCenters = [];
            }
        },

        async onFilterCenterChange() {
            try {
                this.filters.subject = '';
                this.filterSubjects = [];  // 重置受试者列表

                if (this.filters.project && this.filters.center) {
                    this.filterSubjects = await SubjectOperations.getSubjectsForProjectCenter(
                        this.filters.project,
                        this.filters.center
                    );
                }
                
                await this.loadVisitRecords();
            } catch (error) {
                console.error('中心筛选失败:', error);
                alert('加载中心相关数据失败');
                this.filterSubjects = [];
            }
        },

        // 表单提交处理
        async submitSingleVisit() {
            try {
                const visitData = {
                    project: this.selectedProject,
                    center: this.selectedCenter,
                    ...this.singleVisit,
                    projectCenterSubject: [this.selectedProject, this.selectedCenter, this.singleVisit.subjectName]
                };

                await VisitRecordOperations.addVisitRecord(visitData);
                alert('访视记录添加成功');
                
                // 重置表单
                this.singleVisit = {
                    subjectName: '',
                    visitNumber: '',
                    visitDate: ''
                };
                this.datePicker.clear();
                
                await this.loadVisitRecords();
            } catch (error) {
                console.error('保存访视记录失败:', error);
                alert('保存访视记录失败');
            }
        },

        // 文件处理
        async handleFileChange(event) {
            const file = event.target.files[0];
            if (!file) {
                this.columnMapping = [];
                return;
            }

            try {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                
                // 获取Excel的列名
                const range = XLSX.utils.decode_range(firstSheet['!ref']);
                this.columnMapping = [];
                for (let C = range.s.c; C <= range.e.c; C++) {
                    const cell = firstSheet[XLSX.utils.encode_cell({ r: 0, c: C })];
                    this.columnMapping.push(cell ? cell.v : `列 ${C + 1}`);
                }
            } catch (error) {
                console.error('读取Excel文件失败:', error);
                alert('读取Excel文件失败');
            }
        },

        async submitBatchImport(event) {
            if (!this.selectedProject || !this.selectedCenter) {
                alert('请先选择项目和中心');
                return;
            }

            // 构建映射对象
            const mapping = {};
            this.mappingFields.forEach(field => {
                // 确保 selected 值是数字类型
                mapping[field.key] = field.selected !== '' ? parseInt(field.selected) : null;
            });

            // 检查必需字段的映射
            const missingFields = this.mappingFields
                .filter(field => field.required && mapping[field.key] === null)
                .map(field => field.label);

            if (missingFields.length > 0) {
                alert(`请为以下字段选择对应的Excel列：${missingFields.join(', ')}`);
                return;
            }

            try {
                const file = document.querySelector('input[type="file"]').files[0];
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rawData = XLSX.utils.sheet_to_json(firstSheet, { 
                    header: Array.from(Array(26), (_, i) => i),
                    raw: true
                });
                
                rawData.shift(); // 移除表头行

                const records = rawData.map((row, index) => {
                    try {
                        const rawDate = row[mapping.visitDate];
                        const parsedDate = parseExcelDate(rawDate);
                        
                        if (!parsedDate) {
                            throw new Error(`第 ${index + 2} 行的日期格式无效`);
                        }

                        const record = {
                            project: this.selectedProject, // 使用选择的项目
                            center: this.selectedCenter,   // 使用选择的中心
                            subjectName: String(row[mapping.subjectName] || '').trim(),
                            visitNumber: parseInt(row[mapping.visitNumber]),
                            visitDate: parsedDate
                        };

                        if (!record.subjectName) {
                            throw new Error(`第 ${index + 2} 行: 受试者姓名不能为空`);
                        }

                        if (isNaN(record.visitNumber) || record.visitNumber <= 0) {
                            throw new Error(`第 ${index + 2} 行: 访视序号必须是大于0的数字`);
                        }

                        record.projectCenterSubject = [record.project, record.center, record.subjectName];
                        return record;
                    } catch (error) {
                        throw new Error(`处理第 ${index + 2} 行数据时出错: ${error.message}`);
                    }
                });

                await VisitRecordOperations.batchAddVisitRecords(records);
                alert('批量导入成功');
                
                // 重置表单
                event.target.reset();
                this.columnMapping = [];
                this.mappingFields.forEach(field => field.selected = '');
                
                await this.loadVisitRecords();
            } catch (error) {
                console.error('导入失败:', error);
                alert('导入失败：' + error.message);
            }
        },

        // 删除记录
        async deleteRecord(record) {
            if (!confirm('确定要删除这条访视记录吗？')) {
                return;
            }

            try {
                await VisitRecordOperations.deleteVisitRecord(record);
                await this.loadVisitRecords();
            } catch (error) {
                console.error('删除失败:', error);
                alert('删除失败，请重试');
            }
        },

        // 批量删除
        startBatchDelete() {
            this.showBatchDelete = true;
            this.visitRecords.forEach(record => record.selected = false);
        },

        cancelBatchDelete() {
            this.showBatchDelete = false;
            this.selectAll = false;
            this.visitRecords.forEach(record => record.selected = false);
        },

        async confirmBatchDelete() {
            const selectedRecords = this.visitRecords.filter(record => record.selected);

            if (selectedRecords.length === 0) {
                alert('请至少选择一条记录进行删除');
                return;
            }

            if (!confirm('确定要删除选中的记录吗？')) {
                return;
            }

            try {
                await VisitRecordOperations.batchDeleteVisitRecords(selectedRecords);
                alert('选中的记录已成功删除');
                this.cancelBatchDelete();
                await this.loadVisitRecords();
            } catch (error) {
                console.error('批量删除失败:', error);
                alert('删除失败，请重试');
            }
        },

        toggleSelectAll() {
            this.visitRecords.forEach(record => record.selected = this.selectAll);
        },

        // 添加表单重置方法
        resetSingleForm() {
            this.singleVisit = {
                subjectName: '',
                visitNumber: '',
                visitDate: ''
            };
            if (this.datePicker) {
                this.datePicker.clear();
            }
        },

        resetBatchForm() {
            this.columnMapping = [];
            this.mappingFields.forEach(field => field.selected = '');
            // 重置文件输入
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                fileInput.value = '';
            }
        },

        // 添加 tab 切换处理
        handleTabChange(newTab) {
            if (this.activeTab === newTab) return;
            
            // 重置相应表单
            if (newTab === 'single') {
                this.resetBatchForm();
            } else if (newTab === 'batch') {
                this.resetSingleForm();
            } else if (newTab === 'view') {
                this.resetSingleForm();
                this.resetBatchForm();
                // 刷新记录列表
                this.loadVisitRecords();
            }
            
            this.activeTab = newTab;
        }
    },

    watch: {
        // 添加 activeTab 监听器
        activeTab: {
            immediate: true,
            handler(newTab) {
                // 如果切换到查看记录标签，自动加载记录
                if (newTab === 'view') {
                    this.$nextTick(() => {
                        this.loadVisitRecords();
                    });
                }
            }
        }
    }
});

// 挂载 Vue 应用
app.mount('#app');