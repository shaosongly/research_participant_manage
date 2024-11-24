import { SubjectOperations } from '../common/db-operations.js';

const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        // 状态定义
        const allSubjects = ref([]);
        const selectedProject = ref('');
        const selectedCenter = ref('');
        const batchDeleteMode = ref(false);
        const selectAll = ref(false);

        // 计算属性
        const projects = computed(() => {
            const projectSet = new Set(allSubjects.value.map(s => s.project));
            return Array.from(projectSet).sort();
        });

        const centers = computed(() => {
            if (!selectedProject.value) {
                return Array.from(new Set(allSubjects.value.map(s => s.center))).sort();
            }
            return Array.from(new Set(
                allSubjects.value
                    .filter(s => s.project === selectedProject.value)
                    .map(s => s.center)
            )).sort();
        });

        const filteredSubjects = computed(() => {
            return allSubjects.value.filter(subject => {
                if (selectedProject.value && subject.project !== selectedProject.value) return false;
                if (selectedCenter.value && subject.center !== selectedCenter.value) return false;
                return true;
            });
        });

        // 方法定义
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

        const resetFilters = () => {
            selectedProject.value = '';
            selectedCenter.value = '';
        };

        const onProjectChange = () => {
            selectedCenter.value = '';
        };

        const editSubject = (index) => {
            const subject = filteredSubjects.value[index];
            subject.editing = true;
            subject.editData = { ...subject };
        };

        const validateSubjectData = (data) => {
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

            if (!data.name || !data.firstDate || !data.frequency || !data.totalVisits || data.totalVisits <= 0) {
                alert('请填写所有必填字段，且总访视次数必须大于0');
                return false;
            }

            return true;
        };

        const saveSubject = async (index) => {
            const subject = filteredSubjects.value[index];
            if (!validateSubjectData(subject.editData)) {
                return;
            }

            try {
                // 创建一个只包含需要的属性的对象
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

        // 检查 URL 参数
        const checkUrlParams = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const projectFromUrl = urlParams.get('project');
            const centerFromUrl = urlParams.get('center');

            if (projectFromUrl) {
                selectedProject.value = projectFromUrl;
                if (centerFromUrl) {
                    selectedCenter.value = centerFromUrl;
                }
            }
        };

        // 生命周期钩子
        onMounted(async () => {
            await loadSubjects();
            checkUrlParams();
        });

        return {
            // 状态
            selectedProject,
            selectedCenter,
            batchDeleteMode,
            selectAll,
            // 计算属性
            projects,
            centers,
            filteredSubjects,
            // 方法
            resetFilters,
            onProjectChange,
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
